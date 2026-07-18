-- 0094_atomic_staff_walk_in.sql
-- Walk-ins are real bookings with a real tenant customer relation. Customer
-- identity and booking are written in one transaction: a collision can never
-- leave an orphan customer, and contact data never uses bookings.note.

begin;

-- A private, transaction-scoped capability lets the existing booking trigger
-- identify this one RPC call. Authenticated/public callers cannot manufacture
-- the capability, so the notice exception cannot become a general insert path.
create table if not exists private.staff_walk_in_intents (
  booking_id uuid primary key,
  transaction_id bigint not null,
  actor_user_id uuid not null,
  tenant_id uuid not null,
  location_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null
);
revoke all on table private.staff_walk_in_intents
  from public, anon, authenticated, service_role;

-- Keep the shared trigger chain as the single final fence. The only behavioral
-- difference from 0077 is that a valid private walk-in capability skips the
-- tenant's public min-notice/max-advance window. Resource, opening-hours,
-- working-hours, closure, time-off, buffer and collision checks stay identical.
create or replace function private.assert_booking_available(
  p_booking uuid,
  p_tenant uuid,
  p_location uuid,
  p_staff uuid,
  p_service uuid,
  p_start timestamptz,
  p_end timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday int;
  v_step int;
  v_buffer int;
  v_min_notice int;
  v_max_advance int;
  v_reserved_end timestamptz;
  v_admin boolean := coalesce((select auth.role()), '') = 'service_role'
    or (
      coalesce(private.tenant_id() = p_tenant, false)
      and coalesce((select private.role_level()), 0) >= 3
    );
  v_staff_walk_in boolean := exists (
    select 1
      from private.staff_walk_in_intents wi
     where wi.booking_id = p_booking
       and wi.transaction_id = pg_catalog.txid_current()
       and wi.actor_user_id = (select auth.uid())
       and wi.tenant_id = p_tenant
       and wi.location_id = p_location
       and wi.staff_id = p_staff
       and wi.service_id = p_service
       and wi.start_ts = p_start
       and wi.end_ts = p_end
  );
begin
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'invalid_booking_interval' using errcode = '22023';
  end if;

  select coalesce(svc.slot_step_min, st.slot_step_min, l.slot_step_min, 15),
         coalesce(svc.buffer_min, st.buffer_min, 0),
         l.timezone, l.min_notice_min, l.max_advance_days
    into v_step, v_buffer, v_timezone, v_min_notice, v_max_advance
    from public.staff st
    join public.staff_services ss
      on ss.tenant_id = p_tenant
     and ss.staff_id = st.id
     and ss.service_id = p_service
    join public.services svc
      on svc.id = ss.service_id
     and svc.tenant_id = p_tenant
    join public.locations l
      on l.id = p_location
     and l.tenant_id = p_tenant
     and l.active = true
   where st.id = p_staff
     and st.tenant_id = p_tenant
     and st.location_id = p_location
     and st.active = true
     and svc.active = true
     and (svc.location_id is null or svc.location_id = p_location);
  if v_step is null or v_timezone is null then
    raise exception 'invalid_booking_resources' using errcode = 'P0002';
  end if;

  if not v_staff_walk_in then
    if p_start < pg_catalog.statement_timestamp()
         + pg_catalog.make_interval(mins => v_min_notice) then
      raise exception 'booking_inside_min_notice' using errcode = 'P0001';
    end if;
    if p_start > pg_catalog.statement_timestamp()
         + pg_catalog.make_interval(days => v_max_advance) then
      raise exception 'booking_outside_advance_window' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
      from public.location_closures lc
     where lc.tenant_id = p_tenant
       and lc.location_id = p_location
       and tstzrange(lc.start_ts, lc.end_ts, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'booking_overlaps_location_closure' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.location_opening_hours loh
     where loh.tenant_id = p_tenant
       and loh.location_id = p_location
       and loh.confirmed_at is not null
  ) then
    v_local_start := p_start at time zone v_timezone;
    v_local_end := p_end at time zone v_timezone;
    v_weekday := extract(dow from v_local_start)::int;

    if v_local_start::date <> v_local_end::date or not exists (
      select 1 from public.location_opening_hours loh
       where loh.tenant_id = p_tenant
         and loh.location_id = p_location
         and loh.confirmed_at is not null
         and loh.weekday = v_weekday
         and v_local_start::time >= loh.start_time
         and v_local_end::time <= loh.end_time
    ) then
      raise exception 'booking_outside_location_opening_hours' using errcode = 'P0001';
    end if;
  end if;

  v_local_start := p_start at time zone v_timezone;
  v_local_end := p_end at time zone v_timezone;
  v_weekday := extract(dow from v_local_start)::int;

  if v_local_start::date <> v_local_end::date or not exists (
    select 1
      from public.working_hours wh
     where wh.tenant_id = p_tenant
       and wh.location_id = p_location
       and wh.staff_id = p_staff
       and wh.weekday = v_weekday
       and v_local_start::time >= wh.start_time
       and v_local_end::time <= wh.end_time
  ) then
    raise exception 'booking_outside_working_hours' using errcode = 'P0001';
  end if;

  if not v_admin then
    if exists (
      select 1 from public.working_hour_slots s
       where s.tenant_id = p_tenant
         and s.location_id = p_location
         and s.staff_id = p_staff
         and s.weekday = v_weekday
         and s.active = true
    ) then
      if not exists (
        select 1 from public.working_hour_slots s
         where s.tenant_id = p_tenant
           and s.location_id = p_location
           and s.staff_id = p_staff
           and s.weekday = v_weekday
           and s.active = true
           and s.start_time = v_local_start::time
      ) then
        raise exception 'booking_not_explicit_slot' using errcode = 'P0001';
      end if;
    elsif not exists (
      select 1
        from public.working_hours wh
       where wh.tenant_id = p_tenant
         and wh.location_id = p_location
         and wh.staff_id = p_staff
         and wh.weekday = v_weekday
         and v_local_start::time >= wh.start_time
         and v_local_end::time <= wh.end_time
         and mod(
           (extract(epoch from (v_local_start::time - wh.start_time)) / 60)::int,
           v_step
         ) = 0
    ) then
      raise exception 'booking_not_on_slot_step' using errcode = 'P0001';
    end if;
  end if;

  v_reserved_end := p_end + pg_catalog.make_interval(mins => v_buffer);

  if exists (
    select 1 from public.time_off t
     where t.tenant_id = p_tenant
       and t.staff_id = p_staff
       and (t.location_id is null or t.location_id = p_location)
       and tstzrange(t.start_ts, t.end_ts, '[)')
           && tstzrange(p_start, v_reserved_end, '[)')
  ) then
    raise exception 'booking_overlaps_time_off' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.bookings b
      join public.staff bst
        on bst.id = b.staff_id
       and bst.tenant_id = b.tenant_id
      join public.services bsvc
        on bsvc.id = b.service_id
       and bsvc.tenant_id = b.tenant_id
     where b.tenant_id = p_tenant
       and b.staff_id = p_staff
       and b.id <> p_booking
       and b.status in ('pending', 'confirmed', 'completed')
       and tstzrange(
             b.start_ts,
             b.end_ts + pg_catalog.make_interval(
               mins => coalesce(bsvc.buffer_min, bst.buffer_min, 0)
             ),
             '[)'
           ) && tstzrange(p_start, v_reserved_end, '[)')
  ) then
    raise exception 'booking_overlaps_reserved_time' using errcode = '23P01';
  end if;
end;
$$;
revoke all on function private.assert_booking_available(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.create_staff_walk_in(
  p_staff uuid,
  p_location uuid,
  p_service uuid,
  p_start timestamptz,
  p_name text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_name text := nullif(pg_catalog.btrim(p_name), '');
  v_start timestamptz;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_duration int;
  v_price int;
  v_end timestamptz;
  v_customer uuid;
  v_booking uuid;
begin
  if (select auth.uid()) is null or v_tenant is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_start is null then
    raise exception 'walk_in_start_required' using errcode = '22023';
  end if;
  v_start := pg_catalog.date_trunc('minute', p_start);
  if v_start < pg_catalog.date_trunc('minute', v_now) - interval '4 hours' then
    raise exception 'walk_in_start_too_old' using errcode = '22023';
  end if;
  if v_start > pg_catalog.date_trunc('minute', v_now) + interval '30 minutes' then
    raise exception 'walk_in_start_too_far_ahead' using errcode = '22023';
  end if;
  if pg_catalog.length(v_name) > 200 then
    raise exception 'walk_in_name_too_long' using errcode = '22023';
  end if;

  -- Every resource is proven against the caller's tenant and own staff profile.
  -- The staff-service/location joins also prevent a caller from selecting an
  -- arbitrary service or a resource from another tenant.
  select svc.duration_min, svc.price_cents
    into v_duration, v_price
    from public.staff st
    join public.locations loc
      on loc.id = p_location
     and loc.tenant_id = st.tenant_id
     and loc.active = true
    join public.staff_services ss
      on ss.tenant_id = st.tenant_id
     and ss.staff_id = st.id
     and ss.service_id = p_service
    join public.services svc
      on svc.id = ss.service_id
     and svc.tenant_id = st.tenant_id
     and svc.active = true
     and (svc.location_id is null or svc.location_id = p_location)
   where st.id = p_staff
     and st.tenant_id = v_tenant
     and st.location_id = p_location
     and st.active = true
     and st.profile_id = (select auth.uid());
  if not found then
    raise exception 'staff_walk_in_resources_forbidden' using errcode = '42501';
  end if;

  v_end := v_start + pg_catalog.make_interval(mins => v_duration);
  v_booking := gen_random_uuid();

  if v_name is not null then
    insert into public.customers (tenant_id, full_name, last_seen_at)
    values (v_tenant, v_name, pg_catalog.now())
    returning id into v_customer;
  end if;

  insert into private.staff_walk_in_intents (
    booking_id, transaction_id, actor_user_id, tenant_id,
    location_id, staff_id, service_id, start_ts, end_ts
  ) values (
    v_booking, pg_catalog.txid_current(), (select auth.uid()), v_tenant,
    p_location, p_staff, p_service, v_start, v_end
  );

  -- The existing booking resource trigger is the final race-safe availability
  -- fence. If it rejects the insert, this function's customer insert rolls back.
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id,
    customer_id, start_ts, end_ts, status, price_cents, note
  ) values (
    v_booking, v_tenant, p_location, p_staff, p_service,
    v_customer, v_start, v_end, 'confirmed', v_price, null
  )
  returning id into v_booking;

  delete from private.staff_walk_in_intents wi
   where wi.booking_id = v_booking
     and wi.transaction_id = pg_catalog.txid_current();

  return v_booking;
end;
$$;

revoke all on function public.create_staff_walk_in(
  uuid,uuid,uuid,timestamptz,text
) from public, anon, authenticated, service_role;
grant execute on function public.create_staff_walk_in(
  uuid,uuid,uuid,timestamptz,text
) to authenticated;

comment on function public.create_staff_walk_in(
  uuid,uuid,uuid,timestamptz,text
) is 'Atomisk walk-in för inloggad personal: egen tenant/staff, name-only customer_id och aldrig kontaktdata i bookings.note.';

commit;
