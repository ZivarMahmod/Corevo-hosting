-- 0079 — Staff readiness remains true after onboarding and later resource edits.
-- 0076–0078 are already production history; this migration only replaces the
-- affected functions and adds deferred cross-table guards.

begin;

create or replace function private.assert_staff_readiness(p_staff_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff record;
begin
  for v_staff in
    select st.id, st.tenant_id, st.location_id, st.active
      from public.staff st
     where st.id = any(coalesce(p_staff_ids, array[]::uuid[]))
     order by st.id
     for update
  loop
    if v_staff.active then
      if v_staff.location_id is null or not exists (
        select 1 from public.location_opening_hours loh
         where loh.tenant_id = v_staff.tenant_id
           and loh.location_id = v_staff.location_id
           and loh.confirmed_at is not null
      ) then
        raise exception 'active_staff_requires_confirmed_opening_hours' using errcode = 'P0001';
      end if;
      if not exists (
        select 1 from public.working_hours wh
         where wh.tenant_id = v_staff.tenant_id
           and wh.staff_id = v_staff.id
           and wh.location_id = v_staff.location_id
      ) then
        raise exception 'active_staff_requires_working_hours' using errcode = 'P0001';
      end if;
      if not exists (
        select 1
          from public.staff_services ss
          join public.services svc
            on svc.id = ss.service_id
           and svc.tenant_id = ss.tenant_id
           and svc.active = true
         where ss.tenant_id = v_staff.tenant_id
           and ss.staff_id = v_staff.id
           and (svc.location_id is null or svc.location_id = v_staff.location_id)
      ) then
        raise exception 'active_staff_requires_matching_service' using errcode = 'P0001';
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function private.assert_staff_readiness(uuid[])
  from public, anon, authenticated, service_role;

create or replace function private.enforce_staff_activation_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and (
    tg_op = 'INSERT'
    or old.active is distinct from new.active
    or old.tenant_id is distinct from new.tenant_id
    or old.location_id is distinct from new.location_id
  ) then
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
  before insert or update of active, tenant_id, location_id on public.staff
  for each row execute function private.enforce_staff_activation_readiness();

create or replace function public.create_staff_with_defaults(
  p_title text,
  p_location uuid default null,
  p_profile uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_staff uuid;
  v_confirmed boolean;
begin
  if nullif(pg_catalog.btrim(p_title), '') is null then
    raise exception 'staff_title_required' using errcode = '22023';
  end if;

  select l.id into v_location
    from public.locations l
    left join public.users u on u.id = (select auth.uid())
   where l.tenant_id = v_tenant
     and l.active = true
     and l.id = coalesce(p_location, u.primary_location_id)
   limit 1;
  if v_location is null then
    raise exception 'invalid_or_missing_location' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);

  if p_profile is not null and not exists (
    select 1 from public.users u
     where u.id = p_profile and u.tenant_id = v_tenant
  ) then
    raise exception 'invalid_staff_profile' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.location_opening_hours loh
     where loh.tenant_id = v_tenant
       and loh.location_id = v_location
       and loh.confirmed_at is not null
  ) into v_confirmed;

  -- The row must exist before its child resources can reference it. Keep it a
  -- draft until those children exist; the shared activation trigger validates
  -- the final transition.
  insert into public.staff (tenant_id, location_id, profile_id, title, active)
  values (v_tenant, v_location, p_profile, pg_catalog.btrim(p_title), false)
  returning id into v_staff;

  insert into public.staff_services (tenant_id, staff_id, service_id)
  select v_tenant, v_staff, svc.id
    from public.services svc
   where svc.tenant_id = v_tenant
     and svc.active = true
     and (svc.location_id is null or svc.location_id = v_location);

  if v_confirmed then
    insert into public.working_hours (
      tenant_id, staff_id, location_id, weekday, start_time, end_time
    )
    select v_tenant, v_staff, v_location,
           loh.weekday, loh.start_time, loh.end_time
      from public.location_opening_hours loh
     where loh.tenant_id = v_tenant
       and loh.location_id = v_location
       and loh.confirmed_at is not null;
  else
    insert into public.working_hours (
      tenant_id, staff_id, location_id, weekday, start_time, end_time
    )
    select v_tenant, v_staff, v_location, d.weekday, time '09:00', time '17:00'
      from pg_catalog.generate_series(1, 5) as d(weekday);
  end if;

  if v_confirmed and exists (
    select 1
      from public.staff_services ss
      join public.services svc
        on svc.id = ss.service_id
       and svc.tenant_id = ss.tenant_id
       and svc.active = true
     where ss.tenant_id = v_tenant
       and ss.staff_id = v_staff
       and (svc.location_id is null or svc.location_id = v_location)
  ) and exists (
    select 1 from public.working_hours wh
     where wh.tenant_id = v_tenant
       and wh.staff_id = v_staff
       and wh.location_id = v_location
  ) then
    update public.staff st
       set active = true
     where st.id = v_staff and st.tenant_id = v_tenant;
  end if;

  return v_staff;
end;
$$;

revoke all on function public.create_staff_with_defaults(text,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_staff_with_defaults(text,uuid,uuid)
  to authenticated;

create or replace function private.enforce_staff_readiness_after_resource_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_staff_readiness(
    case tg_op
      when 'INSERT' then array[new.staff_id]
      when 'DELETE' then array[old.staff_id]
      else array[old.staff_id, new.staff_id]
    end
  );
  return null;
end;
$$;

revoke all on function private.enforce_staff_readiness_after_resource_change()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_staff_services_readiness on public.staff_services;
create constraint trigger trg_staff_services_readiness
  after insert or update or delete on public.staff_services
  deferrable initially deferred
  for each row execute function private.enforce_staff_readiness_after_resource_change();

drop trigger if exists trg_working_hours_readiness on public.working_hours;
create constraint trigger trg_working_hours_readiness
  after insert or update or delete on public.working_hours
  deferrable initially deferred
  for each row execute function private.enforce_staff_readiness_after_resource_change();

create or replace function private.enforce_staff_readiness_after_service_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_ids uuid[];
begin
  select pg_catalog.array_agg(distinct ss.staff_id)
    into v_staff_ids
    from public.staff_services ss
   where ss.service_id = any(
     case tg_op
       when 'DELETE' then array[old.id]
       else array[old.id, new.id]
     end
   );
  perform private.assert_staff_readiness(v_staff_ids);
  return null;
end;
$$;

revoke all on function private.enforce_staff_readiness_after_service_change()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_services_staff_readiness on public.services;
create constraint trigger trg_services_staff_readiness
  after update or delete on public.services
  deferrable initially deferred
  for each row execute function private.enforce_staff_readiness_after_service_change();

comment on function private.assert_staff_readiness(uuid[]) is
  'Deferred final-state invariant: active staff retain confirmed hours, work hours and an active matching service.';

commit;
