-- Goal 87 follow-up: SECURITY DEFINER RPCs bypass table RLS, so every public
-- module read/action must apply the same central module gate before delegating.

begin;

-- Booking availability is a public read: live and paused are readable, while
-- off/draft/inactive return the same empty result as unavailable resources.
alter function public.get_public_bookable_starts(
  uuid, uuid, uuid, uuid[], timestamptz[]
) set schema private;
alter function private.get_public_bookable_starts(
  uuid, uuid, uuid, uuid[], timestamptz[]
) rename to get_public_bookable_starts_goal87_impl;

revoke all on function private.get_public_bookable_starts_goal87_impl(
  uuid, uuid, uuid, uuid[], timestamptz[]
) from public, anon, authenticated, service_role;

create function public.get_public_bookable_starts(
  p_tenant uuid,
  p_location uuid,
  p_service uuid,
  p_staff_ids uuid[],
  p_starts timestamptz[]
) returns table (staff_id uuid, start_ts timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_public_readable(p_tenant, 'booking') then
    return;
  end if;

  return query
  select available.staff_id, available.start_ts
    from private.get_public_bookable_starts_goal87_impl(
      p_tenant, p_location, p_service, p_staff_ids, p_starts
    ) available;
end;
$$;

revoke all on function public.get_public_bookable_starts(
  uuid, uuid, uuid, uuid[], timestamptz[]
) from public, anon, authenticated, service_role;
grant execute on function public.get_public_bookable_starts(
  uuid, uuid, uuid, uuid[], timestamptz[]
) to anon, authenticated;

-- Starting PIN verification creates a hold, challenge and outbox row. Keep its
-- original validation order, then require booking live with green readiness at
-- the privileged DB boundary.
alter function public.start_booking_verification(
  text, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid
) set schema private;
alter function private.start_booking_verification(
  text, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid
) rename to start_booking_verification_goal87_impl;

revoke all on function private.start_booking_verification_goal87_impl(
  text, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid
) from public, anon, authenticated, service_role;

create function public.start_booking_verification(
  p_tenant_slug text,
  p_staff uuid,
  p_service uuid,
  p_start timestamptz,
  p_session_token uuid,
  p_channel text,
  p_contact_digest text,
  p_contact_masked text,
  p_pin_digest text,
  p_previous_challenge uuid default null
) returns table (
  challenge_id uuid,
  hold_id uuid,
  pin_outbox_id uuid,
  expires_at timestamptz,
  resend_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if p_session_token is null
     or p_channel not in ('sms', 'email')
     or p_contact_digest !~ '^[a-f0-9]{64}$'
     or p_pin_digest !~ '^[a-f0-9]{64}$'
     or nullif(pg_catalog.btrim(p_contact_masked), '') is null
     or pg_catalog.length(p_contact_masked) > 200 then
    raise exception 'booking_verification_invalid_input' using errcode = '22023';
  end if;

  select t.id
    into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  if not private.module_public_action_allowed(v_tenant, 'booking') then
    raise exception 'module_public_action_denied' using errcode = '55000';
  end if;

  return query
  select started.challenge_id,
         started.hold_id,
         started.pin_outbox_id,
         started.expires_at,
         started.resend_after
    from private.start_booking_verification_goal87_impl(
      p_tenant_slug,
      p_staff,
      p_service,
      p_start,
      p_session_token,
      p_channel,
      p_contact_digest,
      p_contact_masked,
      p_pin_digest,
      p_previous_challenge
    ) started;
end;
$$;

revoke all on function public.start_booking_verification(
  text, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.start_booking_verification(
  text, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid
) to service_role;

-- Course capacity is a public read and must not reveal off/draft events.
alter function public.event_seats_left(uuid) set schema private;
alter function private.event_seats_left(uuid)
  rename to event_seats_left_goal87_impl;

revoke all on function private.event_seats_left_goal87_impl(uuid)
  from public, anon, authenticated, service_role;

create function public.event_seats_left(p_event uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select e.tenant_id
    into v_tenant
    from public.tenant_events e
   where e.id = p_event;

  if v_tenant is null
     or not private.module_public_readable(v_tenant, 'kurser') then
    return 0;
  end if;

  return private.event_seats_left_goal87_impl(p_event);
end;
$$;

revoke all on function public.event_seats_left(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.event_seats_left(uuid)
  to anon, authenticated, service_role;

-- Existing booking confirmations are public reads keyed by an unguessable UUID.
alter function public.get_public_booking(uuid) set schema private;
alter function private.get_public_booking(uuid)
  rename to get_public_booking_goal87_impl;

revoke all on function private.get_public_booking_goal87_impl(uuid)
  from public, anon, authenticated, service_role;

create function public.get_public_booking(p_id uuid)
returns table (
  id uuid,
  status text,
  start_ts timestamptz,
  end_ts timestamptz,
  price_cents int,
  service_name text,
  staff_title text,
  location_name text,
  location_timezone text,
  payment_mode text,
  tenant_name text,
  tenant_slug text,
  payments_enabled boolean,
  stripe_charges_enabled boolean,
  payment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select b.tenant_id
    into v_tenant
    from public.bookings b
   where b.id = p_id;

  if v_tenant is null
     or not private.module_public_readable(v_tenant, 'booking') then
    return;
  end if;

  return query
  select booking.*
    from private.get_public_booking_goal87_impl(p_id) booking;
end;
$$;

revoke all on function public.get_public_booking(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_booking(uuid)
  to anon, authenticated;

-- Shop receipts remain readable while paused, but disappear with off/draft.
alter function public.get_public_shop_order(uuid, text) set schema private;
alter function private.get_public_shop_order(uuid, text)
  rename to get_public_shop_order_goal87_impl;

revoke all on function private.get_public_shop_order_goal87_impl(uuid, text)
  from public, anon, authenticated, service_role;

create function public.get_public_shop_order(p_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select o.tenant_id
    into v_tenant
    from public.shop_orders o
   where o.id = p_id;

  if v_tenant is null
     or not private.module_public_readable(v_tenant, 'shop') then
    return null;
  end if;

  return private.get_public_shop_order_goal87_impl(p_id, p_token);
end;
$$;

revoke all on function public.get_public_shop_order(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_shop_order(uuid, text)
  to anon, authenticated;

-- Admin booking is a module mutation, not a public action. Keep the original
-- location/customer fences and idempotent replay, allow new writes only in
-- draft/live, and delegate directly to the preserved booking implementation.
create or replace function public.create_admin_booking(
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_request_id uuid,
  p_customer_id uuid default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_note text default null,
  p_location uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_slug text;
  v_location uuid;
  v_staff_location uuid;
  v_duration int;
  v_booking_id uuid;
  v_customer_id uuid;
  v_guest_name text := nullif(pg_catalog.btrim(p_guest_name), '');
  v_guest_email text := nullif(pg_catalog.btrim(p_guest_email), '');
  v_guest_phone text := nullif(pg_catalog.btrim(p_guest_phone), '');
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select t.slug
    into v_slug
    from public.tenants t
   where t.id = v_tenant
     and t.status = 'active';
  if v_slug is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;
  if p_request_id is null then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_tenant::text || ':' || p_request_id::text, 0)
  );
  select b.id, b.location_id
    into v_booking_id, v_location
    from public.bookings b
   where b.tenant_id = v_tenant
     and b.request_id = p_request_id;
  if v_booking_id is not null then
    perform private.require_location_admin(v_location);
    return pg_catalog.jsonb_build_object(
      'booking_id', v_booking_id, 'created', false
    );
  end if;

  if private.module_state(v_tenant, 'booking') not in ('draft', 'live') then
    raise exception 'module_admin_action_denied' using errcode = '55000';
  end if;

  select st.location_id
    into v_staff_location
    from public.staff st
   where st.id = p_staff
     and st.tenant_id = v_tenant
     and st.active = true;
  if p_location is null then
    raise exception 'admin_booking_location_required' using errcode = '22023';
  end if;
  v_location := p_location;
  if v_staff_location is distinct from v_location then
    raise exception 'invalid_booking_staff_location' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);

  select svc.duration_min
    into v_duration
    from public.services svc
    join public.staff_services ss
      on ss.tenant_id = svc.tenant_id
     and ss.service_id = svc.id
     and ss.staff_id = p_staff
   where svc.id = p_service
     and svc.tenant_id = v_tenant
     and svc.active = true
     and (svc.location_id is null or svc.location_id = v_location);
  if v_duration is null then
    raise exception 'invalid_booking_service' using errcode = 'P0002';
  end if;
  if p_start < pg_catalog.statement_timestamp() then
    raise exception 'historical_booking_insert_forbidden' using errcode = '42501';
  end if;
  if p_customer_id is not null then
    select c.id
      into v_customer_id
      from public.customers c
     where c.id = p_customer_id
       and c.tenant_id = v_tenant
       and c.status = 'active'
       and (select private.can_access_customer(p_customer_id));
    if v_customer_id is null then
      raise exception 'invalid_or_forbidden_customer' using errcode = '42501';
    end if;
  elsif v_guest_name is null then
    raise exception 'customer_name_required' using errcode = '22023';
  end if;

  v_booking_id := private.create_public_booking_goal87_impl(
    p_tenant_slug => v_slug,
    p_service => p_service,
    p_staff => p_staff,
    p_start => p_start,
    p_note => p_note,
    p_customer => null,
    p_guest_name => case
      when p_customer_id is null then v_guest_name else null
    end,
    p_guest_email => case
      when p_customer_id is null then v_guest_email else null
    end,
    p_guest_phone => case
      when p_customer_id is null then v_guest_phone else null
    end,
    p_location => v_location,
    p_request_id => p_request_id
  );

  if v_customer_id is null then
    select b.customer_id
      into v_customer_id
      from public.bookings b
     where b.id = v_booking_id
       and b.tenant_id = v_tenant;

    if v_customer_id is null then
      if v_guest_email is not null or v_guest_phone is not null then
        raise exception 'customer_resolution_failed' using errcode = 'P0002';
      end if;
      insert into public.customers (tenant_id, full_name, last_seen_at)
      values (v_tenant, v_guest_name, pg_catalog.now())
      returning id into v_customer_id;
    end if;
  else
    update public.customers c
       set last_seen_at = pg_catalog.now()
     where c.id = v_customer_id
       and c.tenant_id = v_tenant;
  end if;

  update public.bookings b
     set customer_id = v_customer_id,
         status = 'confirmed'
   where b.id = v_booking_id
     and b.tenant_id = v_tenant
     and b.location_id = v_location;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'booking_id', v_booking_id,
    'customer_id', v_customer_id,
    'created', true
  );
end;
$$;

revoke all on function public.create_admin_booking(
  uuid, uuid, timestamptz, uuid, uuid, text, text, text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_admin_booking(
  uuid, uuid, timestamptz, uuid, uuid, text, text, text, text, uuid
) to authenticated;

commit;
