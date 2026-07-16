-- 0073 — Atomiska personal-/schemaåtgärder och same-tenant-integritet.
--
-- Kundadmin ska aldrig lämna en halv personalpost eller ett halvt återställt
-- schema efter nätverks-/insertfel. Funktionerna nedan gör varje fler-tabellsflöde
-- till en DB-transaktion och triggrarna stänger direkta kors-tenant-referenser.

create or replace function private.require_tenant_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid := (select private.tenant_id());
begin
  if v_tenant is null or coalesce((select private.role_level()), 0) < 6 then
    raise exception 'owner_required' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;
revoke all on function private.require_tenant_owner() from public;

-- ── Hårda same-tenant-staket för personalens resurser. ─────────────────────
create or replace function private.enforce_staff_location_fence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l
     where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_staff_location' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_staff_location_fence() from public;
drop trigger if exists trg_staff_location_fence on public.staff;
create trigger trg_staff_location_fence
  before insert or update of tenant_id, location_id on public.staff
  for each row execute function private.enforce_staff_location_fence();

create or replace function private.enforce_staff_service_fence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.staff s
     where s.id = new.staff_id and s.tenant_id = new.tenant_id
  ) or not exists (
    select 1 from public.services svc
     where svc.id = new.service_id and svc.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_staff_service_resource' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_staff_service_fence() from public;
drop trigger if exists trg_staff_service_fence on public.staff_services;
create trigger trg_staff_service_fence
  before insert or update of tenant_id, staff_id, service_id on public.staff_services
  for each row execute function private.enforce_staff_service_fence();

create or replace function private.enforce_schedule_resource_fence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.staff s
     where s.id = new.staff_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_schedule_staff' using errcode = 'P0002';
  end if;
  if new.location_id is not null and not exists (
    select 1 from public.locations l
     where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_schedule_location' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_schedule_resource_fence() from public;
drop trigger if exists trg_working_hours_resource_fence on public.working_hours;
create trigger trg_working_hours_resource_fence
  before insert or update of tenant_id, staff_id, location_id on public.working_hours
  for each row execute function private.enforce_schedule_resource_fence();
drop trigger if exists trg_working_hour_slots_resource_fence on public.working_hour_slots;
create trigger trg_working_hour_slots_resource_fence
  before insert or update of tenant_id, staff_id, location_id on public.working_hour_slots
  for each row execute function private.enforce_schedule_resource_fence();

-- ── Ny personal: aktiv + alla aktiva tjänster + synligt standardpass vardagar. ─
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
  v_tenant uuid := (select private.require_tenant_owner());
  v_location uuid;
  v_staff uuid;
begin
  if nullif(btrim(p_title), '') is null then
    raise exception 'staff_title_required' using errcode = '22023';
  end if;

  select l.id into v_location
    from public.locations l
   where l.tenant_id = v_tenant
     and l.active = true
     and (l.id = p_location or (p_location is null and l.is_primary = true))
   order by l.is_primary desc
   limit 1;
  if v_location is null then
    raise exception 'invalid_or_missing_location' using errcode = 'P0002';
  end if;

  if p_profile is not null and not exists (
    select 1 from public.users u where u.id = p_profile and u.tenant_id = v_tenant
  ) then
    raise exception 'invalid_staff_profile' using errcode = 'P0002';
  end if;

  insert into public.staff (tenant_id, location_id, profile_id, title, active)
  values (v_tenant, v_location, p_profile, btrim(p_title), true)
  returning id into v_staff;

  insert into public.staff_services (tenant_id, staff_id, service_id)
  select v_tenant, v_staff, svc.id
    from public.services svc
   where svc.tenant_id = v_tenant and svc.active = true;

  insert into public.working_hours (
    tenant_id, staff_id, location_id, weekday, start_time, end_time
  )
  select v_tenant, v_staff, v_location, day, time '09:00', time '17:00'
    from generate_series(1, 5) as days(day);

  return v_staff;
end;
$$;
revoke execute on function public.create_staff_with_defaults(text,uuid,uuid) from public;
grant execute on function public.create_staff_with_defaults(text,uuid,uuid) to authenticated;

-- Aktiv/inaktiv är både publik bokningsbarhet och, när ett konto är länkat,
-- åtkomst till kunddata. Statusbytet sker ihop med staff-raden så en före detta
-- anställd inte lämnas med en giltig personalroll. Plattformssuspenderade konton
-- återaktiveras aldrig av ägaren (bara status='inactive' får bli active igen).
create or replace function public.set_staff_active(
  p_staff uuid,
  p_active boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.require_tenant_owner());
  v_profile uuid;
  v_account_rows int := 0;
begin
  update public.staff s
     set active = p_active
   where s.id = p_staff and s.tenant_id = v_tenant
  returning s.profile_id into v_profile;
  if not found then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;

  if v_profile is not null then
    if p_active then
      update public.users u set status = 'active'
        from public.roles r
       where u.id = v_profile
         and u.tenant_id = v_tenant
         and u.status = 'inactive'
         and r.id = u.role_id
         and r.tenant_id = v_tenant
         and r.level = 3;
    else
      update public.users u set status = 'inactive'
        from public.roles r
       where u.id = v_profile
         and u.tenant_id = v_tenant
         and r.id = u.role_id
         and r.tenant_id = v_tenant
         and r.level = 3
         and not exists (
           select 1 from public.staff other_staff
            where other_staff.tenant_id = v_tenant
              and other_staff.profile_id = v_profile
              and other_staff.active = true
         );
    end if;
    get diagnostics v_account_rows = row_count;
  end if;
  return v_account_rows > 0;
end;
$$;
revoke execute on function public.set_staff_active(uuid,boolean) from public;
grant execute on function public.set_staff_active(uuid,boolean) to authenticated;

-- ── Tjänstekoppling: delete+insert lyckas eller rullas tillbaka tillsammans. ──
create or replace function public.replace_staff_services(
  p_staff uuid,
  p_services uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_tenant uuid := (select private.require_tenant_owner());
begin
  if not exists (
    select 1 from public.staff s where s.id = p_staff and s.tenant_id = v_tenant
  ) then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;
  if exists (
    select 1
      from unnest(coalesce(p_services, array[]::uuid[])) requested(id)
     where not exists (
       select 1 from public.services svc
        where svc.id = requested.id and svc.tenant_id = v_tenant
     )
  ) then
    raise exception 'invalid_service' using errcode = 'P0002';
  end if;

  delete from public.staff_services ss
   where ss.tenant_id = v_tenant and ss.staff_id = p_staff;
  insert into public.staff_services (tenant_id, staff_id, service_id)
  select v_tenant, p_staff, requested.id
    from (select distinct unnest(coalesce(p_services, array[]::uuid[])) as id) requested;
end;
$$;
revoke execute on function public.replace_staff_services(uuid,uuid[]) from public;
grant execute on function public.replace_staff_services(uuid,uuid[]) to authenticated;

-- ── Schemats ångra: validera kopian, byt båda tabellerna i samma transaktion. ─
create or replace function public.restore_schedule_backup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.require_tenant_owner());
  v_backup jsonb;
begin
  select ts.settings -> 'schedule_backup' into v_backup
    from public.tenant_settings ts where ts.tenant_id = v_tenant;
  if v_backup is null
     or jsonb_typeof(v_backup -> 'working_hours') <> 'array'
     or jsonb_typeof(v_backup -> 'slots') <> 'array' then
    raise exception 'missing_schedule_backup' using errcode = 'P0002';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(v_backup -> 'working_hours')
        as x(staff_id uuid, location_id uuid, weekday int, start_time time, end_time time)
     where x.weekday not between 0 and 6
        or x.end_time <= x.start_time
        or not exists (
          select 1 from public.staff s where s.id = x.staff_id and s.tenant_id = v_tenant
        )
        or (x.location_id is not null and not exists (
          select 1 from public.locations l where l.id = x.location_id and l.tenant_id = v_tenant
        ))
  ) or exists (
    select 1
      from jsonb_to_recordset(v_backup -> 'slots')
        as x(staff_id uuid, location_id uuid, weekday int, start_time time, active boolean)
     where x.weekday not between 0 and 6
        or not exists (
          select 1 from public.staff s where s.id = x.staff_id and s.tenant_id = v_tenant
        )
        or (x.location_id is not null and not exists (
          select 1 from public.locations l where l.id = x.location_id and l.tenant_id = v_tenant
        ))
  ) then
    raise exception 'invalid_schedule_backup' using errcode = 'P0002';
  end if;

  delete from public.working_hour_slots where tenant_id = v_tenant;
  delete from public.working_hours where tenant_id = v_tenant;

  insert into public.working_hours (
    tenant_id, staff_id, location_id, weekday, start_time, end_time
  )
  select v_tenant, x.staff_id, x.location_id, x.weekday, x.start_time, x.end_time
    from jsonb_to_recordset(v_backup -> 'working_hours')
      as x(staff_id uuid, location_id uuid, weekday int, start_time time, end_time time);

  insert into public.working_hour_slots (
    tenant_id, staff_id, location_id, weekday, start_time, active
  )
  select v_tenant, x.staff_id, x.location_id, x.weekday, x.start_time, coalesce(x.active, true)
    from jsonb_to_recordset(v_backup -> 'slots')
      as x(staff_id uuid, location_id uuid, weekday int, start_time time, active boolean);
end;
$$;
revoke execute on function public.restore_schedule_backup() from public;
grant execute on function public.restore_schedule_backup() to authenticated;

comment on function public.create_staff_with_defaults(text,uuid,uuid) is
  'Skapar bokningsbar personal atomiskt med aktiva tjänster och mån–fre 09–17.';
