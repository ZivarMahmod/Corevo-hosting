-- 0075 — Adminundantaget för fria startminuter gäller bara den egna tenanten.
--
-- create_public_booking är avsiktligt körbar för authenticated. En användare i
-- tenant A får därför aldrig ärva adminundantaget när p_tenant pekar på tenant B.

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
  v_reserved_end timestamptz;
  v_admin boolean := coalesce((select auth.role()), '') = 'service_role'
    or (
      coalesce(private.tenant_id() = p_tenant, false)
      and coalesce((select private.role_level()), 0) >= 3
    );
begin
  select l.timezone into v_timezone
    from public.locations l
   where l.id = p_location
     and l.tenant_id = p_tenant
     and l.active = true;
  if v_timezone is null then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;

  select coalesce(svc.slot_step_min, st.slot_step_min, 15),
         coalesce(svc.buffer_min, st.buffer_min, 0)
    into v_step, v_buffer
    from public.staff st
    join public.staff_services ss
      on ss.tenant_id = p_tenant
     and ss.staff_id = st.id
     and ss.service_id = p_service
    join public.services svc
      on svc.id = ss.service_id
     and svc.tenant_id = p_tenant
   where st.id = p_staff
     and st.tenant_id = p_tenant
     and st.active = true
     and svc.active = true;
  if v_step is null then
    raise exception 'invalid_staff' using errcode = 'P0002';
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

  -- Service role får göra serverkontrollerade adminbokningar. En inloggad
  -- admin/personal får samma undantag endast när JWT-tenanten matchar raden.
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

  v_reserved_end := p_end + make_interval(mins => v_buffer);

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
             b.end_ts + make_interval(mins => coalesce(bsvc.buffer_min, bst.buffer_min, 0)),
             '[)'
           )
           && tstzrange(p_start, v_reserved_end, '[)')
  ) then
    raise exception 'booking_overlaps_reserved_time' using errcode = '23P01';
  end if;
end;
$$;

revoke all on function private.assert_booking_available(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz
) from public;

comment on function private.assert_booking_available(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz
) is 'Atomisk bokningsvakt; fria adminminuter kräver service role eller samma tenant.';
