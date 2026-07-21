-- Goal 74: verified storefront booking through SMS or e-mail.
-- The private table stores HMAC digests only. Every callable write function is
-- service-role-only; the browser never receives database credentials.

begin;

create table private.booking_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hold_id uuid references public.slot_holds(id) on delete set null,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  start_ts timestamptz not null,
  session_token uuid not null,
  channel text not null check (channel in ('sms', 'email')),
  contact_digest text not null check (contact_digest ~ '^[a-f0-9]{64}$'),
  contact_masked text not null check (length(contact_masked) between 3 and 200),
  pin_digest text not null check (pin_digest ~ '^[a-f0-9]{64}$'),
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  resend_after timestamptz not null default (statement_timestamp() + interval '30 seconds'),
  expires_at timestamptz not null default (statement_timestamp() + interval '5 minutes'),
  consumed_at timestamptz,
  booking_id uuid references public.bookings(id) on delete set null,
  outbox_id uuid references public.notifications_outbox(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (expires_at > created_at)
);

create index booking_verification_session_idx
  on private.booking_verification_challenges (tenant_id, session_token, created_at desc);
create index booking_verification_expiry_idx
  on private.booking_verification_challenges (expires_at)
  where consumed_at is null;

alter table private.booking_verification_challenges enable row level security;
revoke all on table private.booking_verification_challenges
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table private.booking_verification_challenges
  to service_role;

-- Storefront contact is now one verified channel, not two mandatory fields.
-- The rest of the 0093 integrity body remains unchanged.
create or replace function public.create_storefront_booking(
  p_tenant_slug text,
  p_service uuid,
  p_staff uuid,
  p_start timestamptz,
  p_note text default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_location uuid default null,
  p_request_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_location uuid;
  v_duration int;
  v_existing uuid;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  select t.id into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  if p_request_id is not null then
    select b.id into v_existing
      from public.bookings b
     where b.tenant_id = v_tenant and b.request_id = p_request_id;
    if v_existing is not null then return v_existing; end if;
  end if;

  if nullif(pg_catalog.btrim(p_guest_name), '') is null
     or (
       nullif(pg_catalog.btrim(p_guest_email), '') is null
       and nullif(pg_catalog.btrim(p_guest_phone), '') is null
     ) then
    raise exception 'guest_contact_required' using errcode = '22023';
  end if;
  if pg_catalog.length(v_note) > 2000 then
    raise exception 'booking_note_too_long' using errcode = '22023';
  end if;
  if v_note ~* '^Gäst:\s*[^<\r\n]+\s*<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*([+0-9][+0-9() .-]{3,})?(\s+—\s+.*)?$' then
    raise exception 'booking_note_contains_legacy_contact' using errcode = '22023';
  end if;

  if p_location is not null then
    select l.id into v_location
      from public.locations l
     where l.id = p_location
       and l.tenant_id = v_tenant
       and l.active = true;
  else
    select l.id into v_location
      from public.locations l
     where l.tenant_id = v_tenant
       and l.is_primary = true
       and l.active = true
     limit 1;
  end if;
  if v_location is null then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;

  select s.duration_min into v_duration
    from public.services s
   where s.id = p_service
     and s.tenant_id = v_tenant
     and s.active = true
     and (s.location_id is null or s.location_id = v_location);
  if v_duration is null then
    raise exception 'invalid_service' using errcode = 'P0002';
  end if;

  perform private.assert_booking_available(
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_tenant,
    v_location,
    p_staff,
    p_service,
    p_start,
    p_start + pg_catalog.make_interval(mins => v_duration)
  );
  perform private.assert_storefront_booking_start(
    v_tenant,
    v_location,
    p_staff,
    p_service,
    p_start,
    p_start + pg_catalog.make_interval(mins => v_duration)
  );

  return public.create_public_booking(
    p_tenant_slug => p_tenant_slug,
    p_service => p_service,
    p_staff => p_staff,
    p_start => p_start,
    p_note => v_note,
    p_customer => null,
    p_guest_name => p_guest_name,
    p_guest_email => nullif(pg_catalog.btrim(p_guest_email), ''),
    p_guest_phone => nullif(pg_catalog.btrim(p_guest_phone), ''),
    p_location => v_location,
    p_request_id => p_request_id
  );
end;
$$;

revoke all on function public.create_storefront_booking(
  text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid
) from public, anon, authenticated, service_role;

-- Public availability remains a boolean projection, now also excluding every
-- active verification hold. Raw hold/customer data is never exposed.
create or replace function public.get_public_bookable_starts(
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
declare
  v_duration int;
  v_staff uuid;
  v_start timestamptz;
  v_staff_count int;
  v_min_start timestamptz;
  v_max_start timestamptz;
begin
  if p_tenant is null or p_location is null or p_service is null
     or coalesce(pg_catalog.cardinality(p_staff_ids), 0) not between 1 and 50
     or coalesce(pg_catalog.cardinality(p_starts), 0) not between 1 and 500
     or pg_catalog.cardinality(p_staff_ids) * pg_catalog.cardinality(p_starts) > 1000
     or pg_catalog.array_position(p_staff_ids, null) is not null
     or pg_catalog.array_position(p_starts, null) is not null then
    raise exception 'invalid_public_availability_request' using errcode = '22023';
  end if;

  select svc.duration_min into v_duration
    from public.services svc
    join public.locations l
      on l.id = p_location
     and l.tenant_id = p_tenant
     and l.active = true
    join public.tenants t
      on t.id = p_tenant
     and t.status = 'active'
   where svc.id = p_service
     and svc.tenant_id = p_tenant
     and svc.active = true
     and (svc.location_id is null or svc.location_id = p_location);
  if v_duration is null then
    raise exception 'invalid_public_availability_resources' using errcode = 'P0002';
  end if;

  select pg_catalog.count(distinct st.id)::int into v_staff_count
    from public.staff st
    join public.staff_services ss
      on ss.tenant_id = p_tenant
     and ss.staff_id = st.id
     and ss.service_id = p_service
   where st.tenant_id = p_tenant
     and st.location_id = p_location
     and st.active = true
     and st.id = any(p_staff_ids);
  if v_staff_count <> (
    select pg_catalog.count(distinct x)::int from pg_catalog.unnest(p_staff_ids) as x
  ) then
    raise exception 'invalid_public_availability_resources' using errcode = 'P0002';
  end if;

  select pg_catalog.min(x), pg_catalog.max(x)
    into v_min_start, v_max_start
    from pg_catalog.unnest(p_starts) as x;
  if v_min_start is null or v_max_start - v_min_start > interval '2 days' then
    raise exception 'invalid_public_availability_window' using errcode = '22023';
  end if;

  for v_staff in
    select distinct x from pg_catalog.unnest(p_staff_ids) as x order by x
  loop
    for v_start in
      select distinct x from pg_catalog.unnest(p_starts) as x order by x
    loop
      if not exists (
        select 1
          from public.slot_holds h
         where h.tenant_id = p_tenant
           and h.staff_id = v_staff
           and h.expires_at > pg_catalog.statement_timestamp()
           and tstzrange(h.start_ts, h.end_ts)
               && tstzrange(v_start, v_start + pg_catalog.make_interval(mins => v_duration))
      ) then
        begin
          perform private.assert_booking_available(
            '00000000-0000-0000-0000-000000000000'::uuid,
            p_tenant,
            p_location,
            v_staff,
            p_service,
            v_start,
            v_start + pg_catalog.make_interval(mins => v_duration)
          );
          staff_id := v_staff;
          start_ts := v_start;
          return next;
        exception
          when sqlstate 'P0001' or sqlstate 'P0002' or sqlstate '23P01' then
            null;
        end;
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.get_public_bookable_starts(
  uuid,uuid,uuid,uuid[],timestamptz[]
) from public, anon, authenticated, service_role;
grant execute on function public.get_public_bookable_starts(
  uuid,uuid,uuid,uuid[],timestamptz[]
) to anon, authenticated;

-- Create/replace one five-minute challenge and its slot hold in one transaction.
create or replace function public.start_booking_verification(
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
  expires_at timestamptz,
  resend_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_previous private.booking_verification_challenges%rowtype;
  v_hold uuid;
  v_challenge uuid;
  v_expires timestamptz := pg_catalog.statement_timestamp() + interval '5 minutes';
  v_resend timestamptz := pg_catalog.statement_timestamp() + interval '30 seconds';
begin
  if p_session_token is null
     or p_channel not in ('sms', 'email')
     or p_contact_digest !~ '^[a-f0-9]{64}$'
     or p_pin_digest !~ '^[a-f0-9]{64}$'
     or nullif(pg_catalog.btrim(p_contact_masked), '') is null
     or pg_catalog.length(p_contact_masked) > 200 then
    raise exception 'booking_verification_invalid_input' using errcode = '22023';
  end if;

  select t.id into v_tenant
    from public.tenants t
   where t.slug = pg_catalog.lower(pg_catalog.btrim(p_tenant_slug))
     and t.status = 'active';
  if v_tenant is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;

  if p_previous_challenge is not null then
    select c.* into v_previous
      from private.booking_verification_challenges c
     where c.id = p_previous_challenge
       and c.tenant_id = v_tenant
       and c.session_token = p_session_token
       and c.consumed_at is null
     for update;
    if not found then
      raise exception 'booking_verification_not_found' using errcode = 'P0002';
    end if;
    if v_previous.channel <> p_channel
       or v_previous.contact_digest <> p_contact_digest
       or v_previous.staff_id <> p_staff
       or v_previous.service_id <> p_service
       or v_previous.start_ts <> p_start then
      raise exception 'booking_verification_resend_mismatch' using errcode = '42501';
    end if;
    if v_previous.resend_after > pg_catalog.statement_timestamp() then
      raise exception 'booking_verification_resend_too_soon' using errcode = 'P0001';
    end if;
  end if;

  v_hold := public.place_slot_hold(
    p_tenant_slug, p_staff, p_service, p_start, p_session_token::text, 5
  );

  update private.booking_verification_challenges c
     set expires_at = greatest(c.created_at + interval '1 second', pg_catalog.statement_timestamp()),
         updated_at = pg_catalog.statement_timestamp()
   where c.tenant_id = v_tenant
     and c.session_token = p_session_token
     and c.consumed_at is null;

  insert into private.booking_verification_challenges (
    tenant_id, hold_id, staff_id, service_id, start_ts, session_token,
    channel, contact_digest, contact_masked, pin_digest,
    expires_at, resend_after
  ) values (
    v_tenant, v_hold, p_staff, p_service, p_start, p_session_token,
    p_channel, p_contact_digest, pg_catalog.btrim(p_contact_masked), p_pin_digest,
    v_expires, v_resend
  ) returning id into v_challenge;

  return query select v_challenge, v_hold, v_expires, v_resend;
end;
$$;

create or replace function public.record_booking_verification_delivery(
  p_challenge uuid,
  p_session_token uuid,
  p_delivered boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  update private.booking_verification_challenges c
     set delivery_state = case when p_delivered then 'delivered' else 'failed' end,
         updated_at = pg_catalog.statement_timestamp()
   where c.id = p_challenge
     and c.session_token = p_session_token
     and c.consumed_at is null
     and c.expires_at > pg_catalog.statement_timestamp()
  returning c.id into v_updated;
  return v_updated is not null;
end;
$$;

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
      greatest(0, 5 - v_challenge.attempt_count);
    return;
  end if;
  if v_challenge.delivery_state <> 'delivered' then
    return query select 'not_delivered', null::uuid, null::uuid, false, null::text,
      greatest(0, 5 - v_challenge.attempt_count);
    return;
  end if;
  if v_challenge.attempt_count >= 5 then
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
      case when v_challenge.attempt_count + 1 >= 5 then 'attempts_exhausted' else 'invalid_pin' end,
      null::uuid, null::uuid, false, null::text,
      greatest(0, 5 - (v_challenge.attempt_count + 1));
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
    v_booking_status, 5 - v_challenge.attempt_count;
end;
$$;

-- The booking request immediately dispatches exactly the outbox row returned by
-- finalize. It must never sweep unrelated tenants/events or wait for a batch cron.
create or replace function public.claim_notification_outbox_by_id(
  p_id uuid,
  p_lease_token uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns setof public.notifications_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_lease_token is null or p_now is null then
    raise exception 'notification_claim_by_id_invalid' using errcode = '22023';
  end if;

  update public.notifications_outbox o
     set status = 'failed',
         last_error = 'lease_expired_after_max_attempts',
         lease_token = null,
         lease_expires_at = null,
         updated_at = p_now
   where o.id = p_id
     and o.status = 'attempting'
     and o.lease_expires_at <= p_now
     and o.attempt_count >= o.max_attempts;

  return query
  with due as (
    select o.id
      from public.notifications_outbox o
     where o.id = p_id
       and o.category = 'transactional'
       and o.event_type in ('booking_confirmation', 'booking_request_received')
       and o.chosen_channel in ('sms', 'email')
       and o.attempt_count < o.max_attempts
       and (
         (o.status = 'queued' and o.available_at <= p_now)
         or (o.status = 'attempting' and o.lease_expires_at <= p_now)
       )
     for update skip locked
  )
  update public.notifications_outbox o
     set status = 'attempting',
         attempt_count = o.attempt_count + 1,
         lease_token = p_lease_token,
         lease_expires_at = p_now + pg_catalog.make_interval(
           secs => pg_catalog.least(pg_catalog.greatest(pg_catalog.coalesce(p_lease_seconds, 120), 30), 900)
         ),
         updated_at = p_now
    from due
   where o.id = due.id
  returning o.*;
end;
$$;

-- Re-state the overlap backstop so the activated hold path is self-contained.
-- place_slot_hold already uses this exact half-open range check under an advisory lock.
comment on function public.place_slot_hold(text,uuid,uuid,timestamptz,text,integer) is
  'Service-only hold. Rejects when tstzrange(h.start_ts, h.end_ts) && tstzrange(p_start, v_end).';

revoke all on function public.start_booking_verification(
  text,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.record_booking_verification_delivery(
  uuid,uuid,boolean
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_verified_storefront_booking(
  uuid,uuid,text,text,text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean
) from public, anon, authenticated, service_role;
revoke all on function public.claim_notification_outbox_by_id(
  uuid,uuid,timestamptz,integer
) from public, anon, authenticated, service_role;

grant execute on function public.start_booking_verification(
  text,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid
) to service_role;
grant execute on function public.record_booking_verification_delivery(
  uuid,uuid,boolean
) to service_role;
grant execute on function public.finalize_verified_storefront_booking(
  uuid,uuid,text,text,text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean
) to service_role;
grant execute on function public.claim_notification_outbox_by_id(
  uuid,uuid,timestamptz,integer
) to service_role;

commit;
