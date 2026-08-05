-- Exact Corevo tenant hosts. Cloudflare attaches one <slug>.corevo.se Worker Domain
-- at onboarding; these public URLs must use that exact host, never the retired Boka branch.

create or replace function private.customer_portal_booking_origin(p_tenant uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_domain text;
begin
  select t.slug into v_slug
  from public.tenants t
  where t.id = p_tenant and t.status = 'active';

  if v_slug is null then return null; end if;

  select d.domain into v_domain
  from public.tenant_domains d
  where d.tenant_id = p_tenant
    and d.verified
    and d.domain = lower(d.domain)
    and length(d.domain) between 4 and 253
    and d.domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    and d.domain !~ '(^|\.)(xn--|admin|internal|localhost|portal|sms)(\.|$)'
    and pg_catalog.strpos(d.domain, 'corevo') = 0
    and d.domain <> 'corevo.se'
    and d.domain !~ '\.corevo\.se$'
  order by d.is_primary desc, d.created_at, d.id
  limit 1;

  if v_domain is not null then return 'https://' || v_domain; end if;

  if v_slug = lower(v_slug)
     and length(v_slug) between 1 and 63
     and v_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
     and v_slug !~ '^xn--'
     and v_slug not in (
       'booking', 'admin', 'app', 'www', 'api', 'superadmin', 'kiosk', 'dev',
       'odoo', 'superbooking', 'minbooking', 'boka', 'mina', 'internal',
       'localhost', 'portal', 'sms'
     ) then
    return 'https://' || v_slug || '.corevo.se';
  end if;
  return null;
end;
$$;

revoke all on function private.customer_portal_booking_origin(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.finalize_verified_storefront_booking(
  p_challenge uuid,
  p_session_token uuid,
  p_contact_digest text,
  p_pin_digest text,
  p_tenant_slug text,
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_note text default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location uuid default null,
  p_request_id uuid default null,
  p_online_payment_released boolean default false
) returns table (
  outcome text,
  booking_id uuid,
  outbox_id uuid,
  requires_payment boolean,
  booking_status text,
  attempts_remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.booking_verification_challenges%rowtype;
  v_hold public.slot_holds%rowtype;
  v_tenant uuid;
  v_booking uuid;
  v_customer uuid;
  v_outbox uuid;
  v_requires_payment boolean;
  v_booking_status text;
  v_event_type text;
  v_event_key text;
  v_template text;
begin
  select c.* into v_challenge
    from private.booking_verification_challenges c
   where c.id = p_challenge
   for update;
  if not found
     or p_session_token is null
     or v_challenge.session_token <> p_session_token then
    return query select 'invalid_challenge', null::uuid, null::uuid, false, null::text, 0;
    return;
  end if;

  if v_challenge.consumed_at is not null then
    select b.requires_online_payment, b.status
      into v_requires_payment, v_booking_status
      from public.bookings b
     where b.id = v_challenge.booking_id;
    return query select 'booked', v_challenge.booking_id, v_challenge.outbox_id,
      coalesce(v_requires_payment, false), v_booking_status, 0;
    return;
  end if;
  if v_challenge.expires_at <= pg_catalog.statement_timestamp() then
    return query select 'expired', null::uuid, null::uuid, false, null::text,
      greatest(0, 3 - v_challenge.attempt_count);
    return;
  end if;
  if v_challenge.delivery_state <> 'delivered' then
    return query select 'not_delivered', null::uuid, null::uuid, false, null::text,
      greatest(0, 3 - v_challenge.attempt_count);
    return;
  end if;
  if v_challenge.attempt_count >= 3 then
    return query select 'attempts_exhausted', null::uuid, null::uuid, false, null::text, 0;
    return;
  end if;
  if p_contact_digest is null
     or v_challenge.contact_digest <> p_contact_digest then
    return query select 'contact_mismatch', null::uuid, null::uuid, false, null::text, 0;
    return;
  end if;
  if p_pin_digest is null or v_challenge.pin_digest <> p_pin_digest then
    update private.booking_verification_challenges c
       set attempt_count = c.attempt_count + 1,
           updated_at = pg_catalog.statement_timestamp()
     where c.id = v_challenge.id;
    return query select
      case when v_challenge.attempt_count + 1 >= 3 then 'attempts_exhausted' else 'invalid_pin' end,
      null::uuid, null::uuid, false, null::text,
      greatest(0, 3 - (v_challenge.attempt_count + 1));
    return;
  end if;

  select t.id into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';
  if v_tenant is null
     or v_tenant <> v_challenge.tenant_id
     or p_service <> v_challenge.service_id
     or p_staff <> v_challenge.staff_id
     or p_start <> v_challenge.start_ts then
    return query select 'selection_mismatch', null::uuid, null::uuid, false, null::text, 0;
    return;
  end if;
  if nullif(pg_catalog.btrim(p_guest_name), '') is null
     or (v_challenge.channel = 'sms' and nullif(pg_catalog.btrim(p_guest_phone), '') is null)
     or (v_challenge.channel = 'email' and nullif(pg_catalog.btrim(p_guest_email), '') is null) then
    return query select 'contact_mismatch', null::uuid, null::uuid, false, null::text, 0;
    return;
  end if;

  select h.* into v_hold
    from public.slot_holds h
   where h.id = v_challenge.hold_id
   for update;
  if not found
     or v_hold.expires_at <= pg_catalog.statement_timestamp()
     or v_hold.tenant_id <> v_tenant
     or v_hold.staff_id <> p_staff
     or v_hold.service_id <> p_service
     or v_hold.start_ts <> p_start
     or v_hold.session_token <> p_session_token::text then
    return query select 'hold_expired', null::uuid, null::uuid, false, null::text, 0;
    return;
  end if;

  select r.booking_id, r.requires_payment, r.booking_status
    into v_booking, v_requires_payment, v_booking_status
    from public.create_storefront_booking_with_release(
      p_tenant_slug, p_service, p_staff, p_start, p_note, p_guest_name,
      case when v_challenge.channel = 'email' then p_guest_email else null end,
      case when v_challenge.channel = 'sms' then p_guest_phone else null end,
      p_location, p_request_id, p_online_payment_released
    ) r;

  select b.customer_id into v_customer
    from public.bookings b
   where b.id = v_booking and b.tenant_id = v_tenant;
  if v_customer is null then
    raise exception 'verified_booking_customer_missing' using errcode = 'P0002';
  end if;

  v_event_type := case when v_booking_status = 'confirmed'
    then 'booking_confirmation' else 'booking_request_received' end;
  v_template := v_event_type;
  v_event_key := 'booking:' || v_booking::text || case
    when v_booking_status = 'confirmed' then ':confirmation' else ':request-received' end;

  select n.id into v_outbox
    from public.enqueue_notification(
      v_tenant,
      v_customer,
      v_booking,
      p_staff,
      v_event_type,
      v_event_key,
      'transactional',
      v_challenge.channel,
      null,
      pg_catalog.jsonb_build_object(
        'category', 'transactional',
        'type', v_event_type,
        'verified_channel', true
      ),
      pg_catalog.jsonb_build_object(
        'template', v_template,
        'booking_id', v_booking,
        'occurred_at', pg_catalog.statement_timestamp(),
        'start_iso', p_start,
        'origin', 'https://' || pg_catalog.lower(pg_catalog.btrim(p_tenant_slug)) || '.corevo.se',
        'include_manage_link', true,
        'include_account_claim', true
      ),
      5
    ) n;

  update private.booking_verification_challenges c
     set consumed_at = pg_catalog.statement_timestamp(),
         booking_id = v_booking,
         outbox_id = v_outbox,
         updated_at = pg_catalog.statement_timestamp()
   where c.id = v_challenge.id;

  delete from public.slot_holds h where h.id = v_hold.id;

  return query select 'booked', v_booking, v_outbox, v_requires_payment,
    v_booking_status, 3 - v_challenge.attempt_count;
end;
$$;

revoke all on function public.finalize_verified_storefront_booking(
  uuid, uuid, text, text, text, uuid, uuid, timestamptz, text, text, text,
  text, uuid, uuid, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_verified_storefront_booking(
  uuid, uuid, text, text, text, uuid, uuid, timestamptz, text, text, text,
  text, uuid, uuid, boolean
) to service_role;

create or replace function public.tenant_launch_readiness(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_status text;
  v_missing text[];
  v_booking_required boolean;
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
begin
  if not v_service and (
    (select auth.uid()) is null
    or not (select private.can_access_tenant(p_tenant))
  ) then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select t.slug, t.status
    into v_slug, v_status
    from public.tenants t
   where t.id = p_tenant;
  if not found then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  v_missing := private.tenant_launch_missing(p_tenant);
  select coalesce((
    select tm.state = 'live'
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant and tm.module_key = 'booking'
    limit 1
  ), true) into v_booking_required;

  return pg_catalog.jsonb_build_object(
    'ready', pg_catalog.cardinality(v_missing) = 0,
    'booking_required', v_booking_required,
    'canonical_host', v_slug || '.corevo.se',
    'tenant_status', v_status,
    'missing', pg_catalog.to_jsonb(v_missing)
  );
end;
$$;

revoke all on function public.tenant_launch_readiness(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.tenant_launch_readiness(uuid)
  to authenticated, service_role;

create or replace function public.publish_tenant(p_tenant uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_status text;
  v_missing text[];
  v_booking_required boolean;
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
begin
  if not v_service and (
    (select auth.uid()) is null
    or not (select private.can_access_tenant(p_tenant))
  ) then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select t.slug, t.status
    into v_slug, v_status
    from public.tenants t
   where t.id = p_tenant
   for update;
  if not found then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select coalesce((
    select tm.state = 'live'
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant and tm.module_key = 'booking'
    limit 1
  ), true) into v_booking_required;

  if v_status = 'active' then
    return pg_catalog.jsonb_build_object(
      'ready', true,
      'booking_required', v_booking_required,
      'canonical_host', v_slug || '.corevo.se',
      'tenant_status', 'active',
      'missing', '[]'::jsonb,
      'transitioned', false
    );
  end if;

  v_missing := private.tenant_launch_missing(p_tenant);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'tenant_not_ready'
      using errcode = '55000',
            detail = pg_catalog.array_to_string(v_missing, ',');
  end if;

  update public.tenants
     set status = 'active'
   where id = p_tenant;

  return pg_catalog.jsonb_build_object(
    'ready', true,
    'booking_required', v_booking_required,
    'canonical_host', v_slug || '.corevo.se',
    'tenant_status', 'active',
    'missing', '[]'::jsonb,
    'transitioned', true
  );
end;
$$;

revoke all on function public.publish_tenant(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_tenant(uuid)
  to authenticated, service_role;