-- 0077 — Atomiska bokningsflöden för organisationsägare och platsadmin.
--
-- Alla mutationer här är smala SECURITY DEFINER-RPC:er. De litar varken på
-- klientens tenant eller på en gammal JWT-scope: platsåtkomsten läses via
-- 0076-helpers från databasen vid varje anrop. Bokningstriggers/FSM från 0072
-- förblir den enda vägen för resurs-, krock- och statusvalidering.

-- 0075:s enda skrivvakt för tillgänglighet utökas i stället för att
-- skapa en parallell adminmotor. Både publik create och admin create/move går
-- redan genom booking-triggern som anropar denna funktion.
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

  if p_start < pg_catalog.statement_timestamp()
       + pg_catalog.make_interval(mins => v_min_notice) then
    raise exception 'booking_inside_min_notice' using errcode = 'P0001';
  end if;
  if p_start > pg_catalog.statement_timestamp()
       + pg_catalog.make_interval(days => v_max_advance) then
    raise exception 'booking_outside_advance_window' using errcode = 'P0001';
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

  -- Bekräftade platsöppettider är en extra yttre ram. Innan platsens tider
  -- har bekräftats fortsätter personalens arbetstid (0072) att vara sanningen.
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

  -- Admin kan välja en fri minut inom verklig availability. Publik bokning
  -- respekterar uttryckliga specialstarter eller platsens upplösta rastersteg.
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

-- Samma busy-readmodell används av storefront och admin. En platsstängning
-- projiceras som upptagen tid för varje efterfrågad personal på platsen.
create or replace function public.get_busy_intervals(
  p_tenant uuid,
  p_staff_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
) returns table (staff_id uuid, start_ts timestamptz, end_ts timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_tenant is null
     or p_from is null or p_to is null or p_from >= p_to
     or p_to - p_from > interval '370 days'
     or coalesce(pg_catalog.cardinality(p_staff_ids), 0) not between 1 and 50
     or not exists (
       select 1 from public.tenants t where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'invalid_availability_window' using errcode = '22023';
  end if;

  return query
  select b.staff_id,
         b.start_ts,
         b.end_ts + pg_catalog.make_interval(
           mins => coalesce(svc.buffer_min, st.buffer_min, 0)
         )
    from public.bookings b
    join public.staff st
      on st.id = b.staff_id and st.tenant_id = b.tenant_id
    join public.services svc
      on svc.id = b.service_id and svc.tenant_id = b.tenant_id
   where b.tenant_id = p_tenant
     and b.staff_id = any(p_staff_ids)
     and b.status in ('pending', 'confirmed', 'completed')
     and b.start_ts < p_to
     and b.end_ts + pg_catalog.make_interval(
       mins => coalesce(svc.buffer_min, st.buffer_min, 0)
     ) > p_from
  union all
  select o.staff_id, o.start_ts, o.end_ts
    from public.time_off o
   where o.tenant_id = p_tenant
     and o.staff_id = any(p_staff_ids)
     and o.start_ts < p_to and o.end_ts > p_from
  union all
  select st.id, lc.start_ts, lc.end_ts
    from public.location_closures lc
    join public.staff st
      on st.tenant_id = lc.tenant_id
     and st.location_id = lc.location_id
   where lc.tenant_id = p_tenant
     and st.id = any(p_staff_ids)
     and lc.start_ts < p_to and lc.end_ts > p_from;
end;
$$;
revoke all on function public.get_busy_intervals(uuid,uuid[],timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_busy_intervals(uuid,uuid[],timestamptz,timestamptz)
  to authenticated;

-- Anon får aldrig råa upptagenintervall. Storefront skickar de starter som dess
-- öppettidsraster har tagit fram och får endast tillbaka de par som den privata,
-- atomiska availability-vakten fortfarande godkänner.
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
  if v_min_start is null or v_max_start - v_min_start > interval '370 days' then
    raise exception 'invalid_public_availability_window' using errcode = '22023';
  end if;

  for v_staff in
    select distinct x from pg_catalog.unnest(p_staff_ids) as x order by x
  loop
    for v_start in
      select distinct x from pg_catalog.unnest(p_starts) as x order by x
    loop
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

-- Publik slotberäkning behöver endast bekräftade klockslag. Proveniens,
-- bekräftande användare och stängningsorsaker exponeras inte.
drop policy if exists location_opening_hours_public_read
  on public.location_opening_hours;
create policy location_opening_hours_public_read
  on public.location_opening_hours
  for select to anon
  using (
    confirmed_at is not null
    and exists (
      select 1
        from public.locations l
        join public.tenants t on t.id = l.tenant_id and t.status = 'active'
       where l.id = location_opening_hours.location_id
         and l.tenant_id = location_opening_hours.tenant_id
         and l.active = true
    )
  );
grant select (tenant_id, location_id, weekday, start_time, end_time, confirmed_at)
  on public.location_opening_hours to anon;

-- Ersätter 0070-wrappern med samma publika signatur, men stänger det gamla
-- tenant-adminundantaget: endast admin med aktuell åtkomst till bokningens plats.
create or replace function public.create_admin_booking(
  p_service     uuid,
  p_staff       uuid,
  p_start       timestamptz,
  p_request_id  uuid,
  p_customer_id uuid default null,
  p_guest_name  text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_note        text default null,
  p_location    uuid default null
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

  select t.slug into v_slug
    from public.tenants t
   where t.id = v_tenant and t.status = 'active';
  if v_slug is null then
    raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002';
  end if;
  if p_request_id is null then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  -- Lås samma intent innan nulägets schema valideras. En lyckad bokning ska
  -- kunna kvitteras idempotent även om tiderna ändrats efter första anropet.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_tenant::text || ':' || p_request_id::text, 0)
  );
  select b.id, b.location_id into v_booking_id, v_location
    from public.bookings b
   where b.tenant_id = v_tenant and b.request_id = p_request_id;
  if v_booking_id is not null then
    perform private.require_location_admin(v_location);
    return pg_catalog.jsonb_build_object('booking_id', v_booking_id, 'created', false);
  end if;

  select st.location_id into v_staff_location
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

  select svc.duration_min into v_duration
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
    select c.id into v_customer_id
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

  v_booking_id := public.create_public_booking(
    p_tenant_slug => v_slug,
    p_service      => p_service,
    p_staff        => p_staff,
    p_start        => p_start,
    p_note         => p_note,
    p_customer     => null,
    p_guest_name   => case when p_customer_id is null then v_guest_name else null end,
    p_guest_email  => case when p_customer_id is null then v_guest_email else null end,
    p_guest_phone  => case when p_customer_id is null then v_guest_phone else null end,
    p_location     => v_location,
    p_request_id   => p_request_id
  );

  if v_customer_id is null then
    select b.customer_id into v_customer_id
      from public.bookings b
     where b.id = v_booking_id and b.tenant_id = v_tenant;

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
     where c.id = v_customer_id and c.tenant_id = v_tenant;
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

-- Rensa den kortlivade femargumentsvarianten om migrationen redan provkörts i
-- en lokal verifieringsdatabas.
drop function if exists public.reschedule_admin_booking(
  uuid,uuid,uuid,uuid,timestamptz
);

create or replace function public.reschedule_admin_booking(
  p_booking uuid,
  p_location uuid,
  p_staff uuid,
  p_service uuid,
  p_start timestamptz,
  p_expected_start timestamptz,
  p_expected_staff uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_current_location uuid;
  v_service uuid;
  v_status text;
  v_old_start timestamptz;
  v_old_staff uuid;
  v_duration interval;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select b.location_id, b.service_id, b.status, b.start_ts, b.staff_id,
         b.end_ts - b.start_ts
    into v_current_location, v_service, v_status, v_old_start, v_old_staff,
         v_duration
    from public.bookings b
   where b.id = p_booking and b.tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  perform private.require_location_admin(v_current_location);
  if p_location is distinct from v_current_location then
    raise exception 'cross_location_reschedule_forbidden' using errcode = '42501';
  end if;
  if p_expected_start is distinct from v_old_start
     or p_expected_staff is distinct from v_old_staff then
    raise exception 'booking_changed_concurrently' using errcode = '40001';
  end if;
  if p_service is distinct from v_service then
    raise exception 'booking_service_snapshot_immutable' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'confirmed') then
    raise exception 'booking_not_reschedulable' using errcode = 'P0001';
  end if;
  if p_start is null or p_start < pg_catalog.statement_timestamp() then
    raise exception 'historical_booking_reschedule_forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.staff st
      join public.staff_services ss
        on ss.tenant_id = st.tenant_id
       and ss.staff_id = st.id
       and ss.service_id = v_service
      join public.services svc
        on svc.id = ss.service_id
       and svc.tenant_id = ss.tenant_id
     where st.id = p_staff
       and st.tenant_id = v_tenant
       and st.location_id = p_location
       and st.active = true
       and svc.active = true
       and (svc.location_id is null or svc.location_id = p_location)
  ) then
    raise exception 'invalid_booking_resources' using errcode = 'P0002';
  end if;
  update public.bookings b
     set location_id = p_location,
         staff_id = p_staff,
         start_ts = p_start,
         end_ts = p_start + v_duration
   where b.id = p_booking
     and b.tenant_id = v_tenant
     and b.status = v_status
     and b.start_ts = v_old_start
     and b.staff_id = v_old_staff;
  if not found then
    raise exception 'booking_changed_concurrently' using errcode = '40001';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'booking.rescheduled', 'booking', p_booking,
    pg_catalog.jsonb_build_object(
      'location_id', v_current_location,
      'from_staff_id', v_old_staff,
      'to_staff_id', p_staff,
      'from_start', v_old_start,
      'to_start', p_start
    )
  );

  return pg_catalog.jsonb_build_object(
    'booking_id', p_booking,
    'from_start', v_old_start,
    'start', p_start,
    'status', v_status
  );
end;
$$;

create or replace function public.set_admin_booking_status(
  p_booking uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_old_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show') then
    raise exception 'invalid_booking_status' using errcode = '22023';
  end if;

  select b.location_id, b.status into v_location, v_old_status
    from public.bookings b
   where b.id = p_booking and b.tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);

  if v_old_status = p_status then
    return pg_catalog.jsonb_build_object(
      'booking_id', p_booking,
      'from_status', v_old_status,
      'status', p_status,
      'changed', false
    );
  end if;

  if p_status = 'cancelled' then
    update public.bookings b
       set status = p_status,
           cancelled_by = 'business',
           cancelled_at = pg_catalog.statement_timestamp()
     where b.id = p_booking and b.tenant_id = v_tenant and b.status = v_old_status;
  elsif v_old_status = 'cancelled' then
    update public.bookings b
       set status = p_status,
           cancelled_by = null,
           cancelled_at = null
     where b.id = p_booking and b.tenant_id = v_tenant and b.status = v_old_status;
  else
    update public.bookings b
       set status = p_status
     where b.id = p_booking and b.tenant_id = v_tenant and b.status = v_old_status;
  end if;
  if not found then
    raise exception 'booking_changed_concurrently' using errcode = '40001';
  end if;

  return pg_catalog.jsonb_build_object(
    'booking_id', p_booking,
    'from_status', v_old_status,
    'status', p_status,
    'changed', true
  );
end;
$$;

create or replace function public.create_admin_time_off(
  p_location uuid,
  p_staff uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_kind text,
  p_reason text default null,
  p_series_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_id uuid;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  perform private.require_location_admin(p_location);
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'invalid_time_off_interval' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('break', 'leave', 'sick', 'other') then
    raise exception 'invalid_time_off_kind' using errcode = '22023';
  end if;
  if pg_catalog.length(v_reason) > 500 then
    raise exception 'time_off_reason_too_long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff st
     where st.id = p_staff
       and st.tenant_id = v_tenant
       and st.location_id = p_location
  ) then
    raise exception 'invalid_time_off_staff' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_staff::text, 0));
  insert into public.time_off (
    tenant_id, location_id, staff_id, start_ts, end_ts, kind, reason, series_id
  ) values (
    v_tenant, p_location, p_staff, p_start, p_end, p_kind, v_reason, p_series_id
  ) returning id into v_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'time_off.created', 'time_off', v_id,
    pg_catalog.jsonb_build_object(
      'location_id', p_location,
      'staff_id', p_staff,
      'kind', p_kind,
      'start', p_start,
      'end', p_end
    )
  );
  return v_id;
end;
$$;

create or replace function public.delete_admin_time_off(
  p_time_off uuid,
  p_delete_series boolean default false
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_staff uuid;
  v_series uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_kind text;
  v_deleted int;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select t.location_id, t.staff_id, t.series_id, t.start_ts, t.end_ts, t.kind
    into v_location, v_staff, v_series, v_start, v_end, v_kind
    from public.time_off t
   where t.id = p_time_off and t.tenant_id = v_tenant
   for update;
  if not found then
    raise exception 'time_off_not_found' using errcode = 'P0002';
  end if;
  if v_location is null then
    raise exception 'legacy_time_off_owner_only' using errcode = '42501';
  end if;
  perform private.require_location_admin(v_location);

  if coalesce(p_delete_series, false) and v_series is not null then
    delete from public.time_off t
     where t.tenant_id = v_tenant
       and t.location_id = v_location
       and t.staff_id = v_staff
       and t.series_id = v_series
       and t.start_ts >= v_start;
  else
    delete from public.time_off t
     where t.id = p_time_off and t.tenant_id = v_tenant;
  end if;
  get diagnostics v_deleted = row_count;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'time_off.deleted', 'time_off', p_time_off,
    pg_catalog.jsonb_build_object(
      'location_id', v_location,
      'staff_id', v_staff,
      'kind', v_kind,
      'start', v_start,
      'end', v_end,
      'deleted_count', v_deleted,
      'series', coalesce(p_delete_series, false) and v_series is not null
    )
  );
  return v_deleted;
end;
$$;

create or replace function public.create_admin_time_off_series(
  p_location uuid,
  p_staff uuid,
  p_occurrences jsonb,
  p_kind text,
  p_reason text default null,
  p_series_id uuid default null
) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_ids uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  perform private.require_location_admin(p_location);
  if pg_catalog.jsonb_typeof(p_occurrences) <> 'array'
     or pg_catalog.jsonb_array_length(p_occurrences) not between 1 and 400 then
    raise exception 'invalid_time_off_occurrences' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('break', 'leave', 'sick', 'other') then
    raise exception 'invalid_time_off_kind' using errcode = '22023';
  end if;
  if pg_catalog.length(v_reason) > 120 then
    raise exception 'time_off_reason_too_long' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_occurrences) > 1 and p_series_id is null then
    raise exception 'time_off_series_id_required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff st
     where st.id = p_staff
       and st.tenant_id = v_tenant
       and st.location_id = p_location
  ) then
    raise exception 'invalid_time_off_staff' using errcode = 'P0002';
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_to_recordset(p_occurrences)
        as o(start_ts timestamptz, end_ts timestamptz)
     where o.start_ts is null or o.end_ts is null or o.end_ts <= o.start_ts
  ) then
    raise exception 'invalid_time_off_interval' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_staff::text, 0));
  with inserted as (
    insert into public.time_off (
      tenant_id, location_id, staff_id, start_ts, end_ts, kind, reason, series_id
    )
    select v_tenant, p_location, p_staff, o.start_ts, o.end_ts,
           p_kind, v_reason, p_series_id
      from pg_catalog.jsonb_to_recordset(p_occurrences)
        as o(start_ts timestamptz, end_ts timestamptz)
     order by o.start_ts
    returning id
  )
  select pg_catalog.array_agg(i.id) into v_ids from inserted i;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'time_off.created', 'time_off', v_ids[1],
    pg_catalog.jsonb_build_object(
      'location_id', p_location,
      'staff_id', p_staff,
      'kind', p_kind,
      'count', pg_catalog.cardinality(v_ids),
      'series_id', p_series_id
    )
  );
  return v_ids;
end;
$$;

create index if not exists audit_log_absence_lookup_idx
  on public.audit_log (
    tenant_id,
    (meta ->> 'time_off_id'),
    (meta ->> 'booking_id'),
    created_at desc
  )
  where action = 'absence.booking_handled';

create or replace function public.preview_admin_time_off_impacts(
  p_location uuid,
  p_staff uuid,
  p_start timestamptz,
  p_end timestamptz
) returns table (
  booking_id uuid,
  start_ts timestamptz,
  end_ts timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_name text,
  status text,
  handled boolean,
  resolution text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  perform private.require_location_admin(p_location);
  if p_start is null or p_end is null or p_end <= p_start
     or p_end - p_start > interval '370 days' then
    raise exception 'invalid_time_off_interval' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff st
     where st.id = p_staff
       and st.tenant_id = v_tenant
       and st.location_id = p_location
  ) then
    raise exception 'invalid_time_off_staff' using errcode = 'P0002';
  end if;

  return query
  select b.id,
         b.start_ts,
         b.end_ts,
         coalesce(
           nullif(pg_catalog.btrim(c.display_name), ''),
           case when c.name_hidden then
             nullif(pg_catalog.substr(pg_catalog.btrim(c.full_name), 1, 1) || '.', '.')
           else nullif(pg_catalog.btrim(c.full_name), '') end,
           'Kund'
         ),
         c.email,
         c.phone,
         svc.name,
         b.status,
         false,
         null::text
    from public.bookings b
    join public.services svc
      on svc.id = b.service_id and svc.tenant_id = b.tenant_id
    left join public.customers c
      on c.id = b.customer_id and c.tenant_id = b.tenant_id
   where b.tenant_id = v_tenant
     and b.location_id = p_location
     and b.staff_id = p_staff
     and b.status in ('pending', 'confirmed')
     and tstzrange(b.start_ts, b.end_ts, '[)') && tstzrange(p_start, p_end, '[)')
   order by b.start_ts
   limit 100;
end;
$$;

create or replace function public.get_admin_time_off_impacts(
  p_time_off uuid
) returns table (
  booking_id uuid,
  start_ts timestamptz,
  end_ts timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_name text,
  status text,
  handled boolean,
  resolution text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_staff uuid;
  v_start timestamptz;
  v_end timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select t.location_id, t.staff_id, t.start_ts, t.end_ts
    into v_location, v_staff, v_start, v_end
    from public.time_off t
   where t.id = p_time_off and t.tenant_id = v_tenant;
  if not found then
    raise exception 'time_off_not_found' using errcode = 'P0002';
  end if;
  if v_location is null then
    raise exception 'legacy_time_off_owner_only' using errcode = '42501';
  end if;
  perform private.require_location_admin(v_location);

  return query
  select b.id,
         b.start_ts,
         b.end_ts,
         coalesce(
           nullif(pg_catalog.btrim(c.display_name), ''),
           case when c.name_hidden then
             nullif(pg_catalog.substr(pg_catalog.btrim(c.full_name), 1, 1) || '.', '.')
           else nullif(pg_catalog.btrim(c.full_name), '') end,
           'Kund'
         ),
         c.email,
         c.phone,
         svc.name,
         b.status,
         h.resolution is not null,
         h.resolution
    from public.bookings b
    join public.services svc
      on svc.id = b.service_id and svc.tenant_id = b.tenant_id
    left join public.customers c
      on c.id = b.customer_id and c.tenant_id = b.tenant_id
    left join lateral (
      select a.meta ->> 'resolution' as resolution
        from public.audit_log a
       where a.tenant_id = v_tenant
         and a.action = 'absence.booking_handled'
         and a.meta ->> 'time_off_id' = p_time_off::text
         and a.meta ->> 'booking_id' = b.id::text
       order by a.created_at desc
       limit 1
    ) h on true
   where b.tenant_id = v_tenant
     and b.location_id = v_location
     and b.staff_id = v_staff
     and b.status in ('pending', 'confirmed')
     and tstzrange(b.start_ts, b.end_ts, '[)') && tstzrange(v_start, v_end, '[)')
   order by b.start_ts
   limit 100;
end;
$$;

create or replace function public.mark_admin_time_off_booking_handled(
  p_time_off uuid,
  p_booking uuid,
  p_resolution text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_staff uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_resolution is null
     or p_resolution not in ('contacted', 'rescheduled', 'cancelled', 'handled') then
    raise exception 'invalid_absence_resolution' using errcode = '22023';
  end if;
  if pg_catalog.length(v_note) > 200 then
    raise exception 'absence_note_too_long' using errcode = '22023';
  end if;
  select t.location_id, t.staff_id, t.start_ts, t.end_ts
    into v_location, v_staff, v_start, v_end
    from public.time_off t
   where t.id = p_time_off and t.tenant_id = v_tenant;
  if not found or v_location is null then
    raise exception 'time_off_not_found' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);
  if not exists (
    select 1 from public.bookings b
     where b.id = p_booking
       and b.tenant_id = v_tenant
       and b.location_id = v_location
       and b.staff_id = v_staff
       and (
         b.status in ('pending', 'confirmed')
         or (p_resolution = 'cancelled' and b.status = 'cancelled')
       )
       and tstzrange(b.start_ts, b.end_ts, '[)') && tstzrange(v_start, v_end, '[)')
  ) then
    raise exception 'absence_booking_not_active' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'absence.booking_handled', 'booking', p_booking,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'time_off_id', p_time_off,
      'booking_id', p_booking,
      'resolution', p_resolution,
      'note', v_note,
      'location_id', v_location
    ))
  );
end;
$$;

-- PostgreSQL ger annars EXECUTE till PUBLIC på nya funktioner. Ta bort alla
-- implicita/explicita arv och öppna endast det avsedda admin-API:t.
revoke all on function public.create_admin_booking(
  uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.reschedule_admin_booking(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.set_admin_booking_status(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_admin_time_off(
  uuid,uuid,timestamptz,timestamptz,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.delete_admin_time_off(uuid,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.create_admin_time_off_series(
  uuid,uuid,jsonb,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.preview_admin_time_off_impacts(uuid,uuid,timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.get_admin_time_off_impacts(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_admin_time_off_booking_handled(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_admin_booking(
  uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid
) to authenticated;
grant execute on function public.reschedule_admin_booking(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid
) to authenticated;
grant execute on function public.set_admin_booking_status(uuid,text) to authenticated;
grant execute on function public.create_admin_time_off(
  uuid,uuid,timestamptz,timestamptz,text,text,uuid
) to authenticated;
grant execute on function public.delete_admin_time_off(uuid,boolean) to authenticated;
grant execute on function public.create_admin_time_off_series(
  uuid,uuid,jsonb,text,text,uuid
) to authenticated;
grant execute on function public.preview_admin_time_off_impacts(uuid,uuid,timestamptz,timestamptz)
  to authenticated;
grant execute on function public.get_admin_time_off_impacts(uuid) to authenticated;
grant execute on function public.mark_admin_time_off_booking_handled(uuid,uuid,text,text)
  to authenticated;

comment on function public.create_admin_booking(
  uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid
) is 'Atomisk adminbokning med databasfärsk platsåtkomst och stabil kundlänk.';
comment on function public.reschedule_admin_booking(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid
) is 'Atomisk ombokning inom samma plats med stale-vakt och serverägd audit.';
comment on function public.set_admin_booking_status(uuid,text)
  is 'Serialiserad adminstatusåtgärd; 0072-FSM och refundvakt gäller.';
comment on function public.create_admin_time_off(
  uuid,uuid,timestamptz,timestamptz,text,text,uuid
) is 'Strukturerad blockering/frånvaro inom adminens platsscope.';
comment on function public.create_admin_time_off_series(
  uuid,uuid,jsonb,text,text,uuid
) is 'Atomisk materialiserad serie av strukturerad time_off inom en plats.';
comment on function public.preview_admin_time_off_impacts(uuid,uuid,timestamptz,timestamptz)
  is 'Smal platsfencad preview av aktiva bokningar som en blockering träffar.';
comment on function public.get_admin_time_off_impacts(uuid)
  is 'Smal platsfencad arbetskö för en time_off-rad, inklusive serverloggad hantering.';
comment on function public.mark_admin_time_off_booking_handled(uuid,uuid,text,text)
  is 'Loggar validerad hantering av en frånvarodrabbad bokning med serverägd aktör.';
