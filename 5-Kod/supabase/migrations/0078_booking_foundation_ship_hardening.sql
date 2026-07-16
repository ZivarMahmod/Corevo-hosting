-- 0078 — Ship hardening for the location-scoped booking foundation.
-- Closes direct-write escape hatches, fences raw availability reads and removes
-- the silent absence-queue cap discovered by the independent release review.

begin;

-- ── Raw busy intervals are an authenticated back-office read model only. ───
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
declare
  v_requested_count int;
begin
  if p_tenant is null
     or p_from is null or p_to is null or p_from >= p_to
     or p_to - p_from > interval '370 days'
     or coalesce(pg_catalog.cardinality(p_staff_ids), 0) not between 1 and 50
     or pg_catalog.array_position(p_staff_ids, null) is not null
     or not exists (
       select 1 from public.tenants t where t.id = p_tenant and t.status = 'active'
     ) then
    raise exception 'invalid_availability_window' using errcode = '22023';
  end if;

  select pg_catalog.count(distinct x)::int
    into v_requested_count
    from pg_catalog.unnest(p_staff_ids) as x;

  if (select auth.uid()) is null
     or (
       not (select private.is_platform_admin())
       and (
         (select private.tenant_id()) is distinct from p_tenant
         or (select private.role_level()) < 3
         or v_requested_count <> (
           select pg_catalog.count(distinct st.id)::int
             from public.staff st
            where st.tenant_id = p_tenant
              and st.id = any(p_staff_ids)
              and st.location_id is not null
              and (select private.can_access_location(st.location_id))
         )
       )
     ) then
    raise exception 'busy_intervals_forbidden' using errcode = '42501';
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

-- Public availability returns booleans-by-projection, never raw intervals. A
-- hard pair cap prevents one anonymous request from multiplying into 25k
-- serial availability checks.
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

-- ── A confirmed location schedule may never silently become empty. ─────────
create or replace function public.save_location_booking_settings(
  p_location uuid,
  p_hours jsonb,
  p_slot_step_min int,
  p_min_notice_min int,
  p_max_advance_days int
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.require_location_admin(p_location));
begin
  if pg_catalog.jsonb_typeof(p_hours) <> 'array'
     or pg_catalog.jsonb_array_length(p_hours) not between 1 and 28
     or p_slot_step_min not between 1 and 240
     or p_min_notice_min not between 0 and 525600
     or p_max_advance_days not between 1 and 1095 then
    raise exception 'invalid_location_booking_settings' using errcode = '22023';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_to_recordset(p_hours)
        as h(weekday int, start_time time, end_time time)
     where h.weekday not between 0 and 6
        or h.start_time is null
        or h.end_time is null
        or h.end_time <= h.start_time
  ) then
    raise exception 'invalid_location_opening_hours' using errcode = '22023';
  end if;

  update public.locations l
     set slot_step_min = p_slot_step_min,
         min_notice_min = p_min_notice_min,
         max_advance_days = p_max_advance_days,
         updated_at = pg_catalog.now()
   where l.id = p_location and l.tenant_id = v_tenant;

  delete from public.location_opening_hours loh
   where loh.tenant_id = v_tenant and loh.location_id = p_location;

  insert into public.location_opening_hours (
    tenant_id, location_id, weekday, start_time, end_time,
    source, confirmed_at, confirmed_by
  )
  select v_tenant, p_location, h.weekday, h.start_time, h.end_time,
         'confirmed', pg_catalog.now(), (select auth.uid())
    from pg_catalog.jsonb_to_recordset(p_hours)
      as h(weekday int, start_time time, end_time time);
end;
$$;

drop policy if exists location_opening_hours_write on public.location_opening_hours;
revoke insert, update, delete on public.location_opening_hours from authenticated;
revoke all on function public.save_location_booking_settings(uuid,jsonb,int,int,int)
  from public, anon, authenticated, service_role;
grant execute on function public.save_location_booking_settings(uuid,jsonb,int,int,int)
  to authenticated;

-- ── Readiness is a table invariant, not merely a UI/RPC convention. ─────────
create or replace function private.enforce_staff_activation_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and (tg_op = 'INSERT' or old.active is distinct from new.active) then
    if new.location_id is null or not exists (
      select 1 from public.locations l
       where l.id = new.location_id and l.tenant_id = new.tenant_id
    ) then
      raise exception 'staff_activation_requires_location' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.location_opening_hours loh
       where loh.tenant_id = new.tenant_id
         and loh.location_id = new.location_id
         and loh.confirmed_at is not null
    ) then
      raise exception 'staff_activation_requires_confirmed_opening_hours' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.working_hours wh
       where wh.tenant_id = new.tenant_id
         and wh.staff_id = new.id
         and wh.location_id = new.location_id
    ) then
      raise exception 'staff_activation_requires_working_hours' using errcode = 'P0001';
    end if;
    if not exists (
      select 1
        from public.staff_services ss
        join public.services svc
          on svc.id = ss.service_id
         and svc.tenant_id = ss.tenant_id
         and svc.active = true
       where ss.tenant_id = new.tenant_id
         and ss.staff_id = new.id
         and (svc.location_id is null or svc.location_id = new.location_id)
    ) then
      raise exception 'staff_activation_requires_matching_service' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_staff_activation_readiness()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_staff_activation_readiness on public.staff;
create trigger trg_staff_activation_readiness
  before insert or update of active on public.staff
  for each row execute function private.enforce_staff_activation_readiness();

create or replace function private.sync_staff_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.profile_id is distinct from new.profile_id
     and old.profile_id is not null then
    update public.users u
       set status = 'inactive'
      from public.roles r
     where u.id = old.profile_id
       and u.tenant_id = old.tenant_id
       and r.id = u.role_id
       and r.tenant_id = old.tenant_id
       and r.level = 3
       and not exists (
         select 1 from public.staff other_staff
          where other_staff.tenant_id = old.tenant_id
            and other_staff.profile_id = old.profile_id
            and other_staff.active = true
       );
  end if;

  if new.profile_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.active is not distinct from new.active
     and old.profile_id is not distinct from new.profile_id then
    return new;
  end if;

  if new.active then
    update public.users u
       set status = 'active'
      from public.roles r
     where u.id = new.profile_id
       and u.tenant_id = new.tenant_id
       and r.id = u.role_id
       and r.tenant_id = new.tenant_id
       and r.level = 3
       and u.status = 'inactive';
  else
    update public.users u
       set status = 'inactive'
      from public.roles r
     where u.id = new.profile_id
       and u.tenant_id = new.tenant_id
       and r.id = u.role_id
       and r.tenant_id = new.tenant_id
       and r.level = 3
       and not exists (
         select 1 from public.staff other_staff
          where other_staff.tenant_id = new.tenant_id
            and other_staff.profile_id = new.profile_id
            and other_staff.active = true
       );
  end if;
  return new;
end;
$$;

revoke all on function private.sync_staff_account_status()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_staff_account_status on public.staff;
create trigger trg_staff_account_status
  after insert or update of active, profile_id on public.staff
  for each row execute function private.sync_staff_account_status();

create or replace function public.set_staff_active(
  p_staff uuid,
  p_active boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_profile uuid;
  v_account_linked boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select s.location_id, s.profile_id
    into v_location, v_profile
    from public.staff s
   where s.id = p_staff and s.tenant_id = v_tenant;
  if v_location is null then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);

  if v_profile is not null then
    select exists (
      select 1
        from public.users u
        join public.roles r
          on r.id = u.role_id and r.tenant_id = u.tenant_id and r.level = 3
       where u.id = v_profile and u.tenant_id = v_tenant
    ) into v_account_linked;
  end if;

  update public.staff s
     set active = p_active
   where s.id = p_staff and s.tenant_id = v_tenant;
  return v_account_linked;
end;
$$;

revoke all on function public.set_staff_active(uuid,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_staff_active(uuid,boolean) to authenticated;

-- ── Customer identity links are immutable to authenticated admin DML. ──────
create or replace function private.protect_customer_auth_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.tenant_id is distinct from new.tenant_id then
    raise exception 'customer_tenant_immutable' using errcode = '42501';
  end if;
  if old.auth_user_id is distinct from new.auth_user_id
     and coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not ((select auth.uid()) is null and session_user in ('postgres', 'supabase_admin')) then
    raise exception 'customer_auth_binding_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_customer_auth_binding()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_customers_protect_auth_binding on public.customers;
create trigger trg_customers_protect_auth_binding
  before update of tenant_id, auth_user_id on public.customers
  for each row execute function private.protect_customer_auth_binding();

-- ── Time-off mutations go through audited, purpose-specific RPCs. ──────────
create or replace function public.create_my_time_off(
  p_staff uuid,
  p_location uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end <= p_start
     or p_end - p_start > interval '370 days' then
    raise exception 'invalid_time_off_interval' using errcode = '22023';
  end if;
  if pg_catalog.length(v_reason) > 500 then
    raise exception 'time_off_reason_too_long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff st
     where st.id = p_staff
       and st.tenant_id = v_tenant
       and st.location_id = p_location
       and st.profile_id = (select auth.uid())
  ) then
    raise exception 'staff_time_off_forbidden' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_staff::text, 0));
  insert into public.time_off (
    tenant_id, location_id, staff_id, start_ts, end_ts, kind, reason
  ) values (
    v_tenant, p_location, p_staff, p_start, p_end, 'other', v_reason
  ) returning id into v_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'time_off.created_by_staff', 'time_off', v_id,
    pg_catalog.jsonb_build_object(
      'location_id', p_location,
      'staff_id', p_staff,
      'start', p_start,
      'end', p_end
    )
  );
  return v_id;
end;
$$;

create or replace function public.delete_my_time_off(
  p_time_off uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_row public.time_off%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select t.* into v_row
    from public.time_off t
    join public.staff st
      on st.id = t.staff_id
     and st.tenant_id = t.tenant_id
     and st.location_id = t.location_id
     and st.profile_id = (select auth.uid())
   where t.id = p_time_off and t.tenant_id = v_tenant
   for update of t;
  if not found then
    raise exception 'staff_time_off_not_found' using errcode = 'P0002';
  end if;

  delete from public.time_off t
   where t.id = p_time_off and t.tenant_id = v_tenant;
  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'time_off.deleted_by_staff', 'time_off', p_time_off,
    pg_catalog.jsonb_build_object(
      'location_id', v_row.location_id,
      'staff_id', v_row.staff_id,
      'start', v_row.start_ts,
      'end', v_row.end_ts
    )
  );
  return true;
end;
$$;

drop policy if exists time_off_admin_write on public.time_off;
drop policy if exists time_off_location_admin_write on public.time_off;
revoke insert, update, delete on public.time_off from authenticated;
revoke all on function public.create_my_time_off(uuid,uuid,timestamptz,timestamptz,text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_my_time_off(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_my_time_off(uuid,uuid,timestamptz,timestamptz,text)
  to authenticated;
grant execute on function public.delete_my_time_off(uuid) to authenticated;

-- Ombokning från frånvarokön håller ursprungsöverlappet och auditmarkeringen i
-- samma transaktion. Efter flytten överlappar bokningen avsiktligt inte längre,
-- så en separat "markera"-request kan aldrig validera rätt historik.
create or replace function public.reschedule_admin_absence_booking(
  p_time_off uuid,
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
  v_absence_location uuid;
  v_absence_staff uuid;
  v_absence_start timestamptz;
  v_absence_end timestamptz;
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select t.location_id, t.staff_id, t.start_ts, t.end_ts
    into v_absence_location, v_absence_staff, v_absence_start, v_absence_end
    from public.time_off t
   where t.id = p_time_off and t.tenant_id = v_tenant
   for update;
  if not found or v_absence_location is null then
    raise exception 'time_off_not_found' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_absence_location);

  if not exists (
    select 1 from public.bookings b
     where b.id = p_booking
       and b.tenant_id = v_tenant
       and b.location_id = v_absence_location
       and b.staff_id = v_absence_staff
       and b.status in ('pending', 'confirmed')
       and b.start_ts = p_expected_start
       and b.staff_id = p_expected_staff
       and pg_catalog.tstzrange(b.start_ts, b.end_ts, '[)')
           && pg_catalog.tstzrange(v_absence_start, v_absence_end, '[)')
  ) then
    raise exception 'absence_booking_not_active' using errcode = 'P0002';
  end if;

  v_result := public.reschedule_admin_booking(
    p_booking,
    p_location,
    p_staff,
    p_service,
    p_start,
    p_expected_start,
    p_expected_staff
  );

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'absence.booking_handled', 'booking', p_booking,
    pg_catalog.jsonb_build_object(
      'time_off_id', p_time_off,
      'booking_id', p_booking,
      'resolution', 'rescheduled',
      'location_id', v_absence_location,
      'from_staff_id', v_absence_staff,
      'from_start', p_expected_start,
      'to_staff_id', p_staff,
      'to_start', p_start
    )
  );
  return v_result;
end;
$$;

revoke all on function public.reschedule_admin_absence_booking(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid
) from public, anon, authenticated, service_role;
grant execute on function public.reschedule_admin_absence_booking(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid
) to authenticated;

-- ── Absence queues are complete; unhandled bookings sort first. ────────────
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
     and pg_catalog.tstzrange(b.start_ts, b.end_ts, '[)')
         && pg_catalog.tstzrange(p_start, p_end, '[)')
   order by b.start_ts;
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
     and pg_catalog.tstzrange(b.start_ts, b.end_ts, '[)')
         && pg_catalog.tstzrange(v_start, v_end, '[)')
   order by (h.resolution is not null), b.start_ts;
end;
$$;

revoke all on function public.preview_admin_time_off_impacts(uuid,uuid,timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.get_admin_time_off_impacts(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.preview_admin_time_off_impacts(uuid,uuid,timestamptz,timestamptz)
  to authenticated;
grant execute on function public.get_admin_time_off_impacts(uuid) to authenticated;

comment on function public.get_busy_intervals(uuid,uuid[],timestamptz,timestamptz) is
  'Rå busy-readmodell endast för tenant- och platsfencad back-office personal.';
comment on function public.get_public_bookable_starts(uuid,uuid,uuid,uuid[],timestamptz[]) is
  'Publik availability-projektion med hårt tak på totalt antal staff/start-par.';
comment on function public.create_my_time_off(uuid,uuid,timestamptz,timestamptz,text) is
  'Personalens smala, platsfencade och auditerade väg för egen frånvaro.';
comment on function public.reschedule_admin_absence_booking(
  uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid
) is 'Atomisk ombokning och frånvaro-resolution från arbetskön.';

commit;
