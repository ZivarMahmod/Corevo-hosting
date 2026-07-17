-- 0081 — Tenantbundna roller/tillägg för Inställningar v2.
--
-- En rad per befintlig staff-rad. Ingen ny personmodell: identiteten fortsätter vara
-- public.staff.profile_id -> auth.users.id. Ägare (role_level >= 6) behöver ingen rad
-- och behåller alltid full åtkomst. Tabellen beskriver bara personalens driftroll och
-- de fyra individuella tillägg som designpaketet kräver.

create unique index if not exists staff_tenant_id_id_uidx
  on public.staff (tenant_id, id);

create table if not exists public.tenant_member_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null,
  operational_role text not null default 'staff'
    check (operational_role in ('manager', 'staff')),
  can_view_all_calendars boolean not null default false,
  can_manage_customers boolean not null default false,
  can_edit_site boolean not null default false,
  can_view_daily_metrics boolean not null default false,
  notify_new_booking boolean not null default true,
  notify_booking_changes boolean not null default true,
  notify_daily_reminder boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (tenant_id, staff_id),
  foreign key (tenant_id, staff_id)
    references public.staff(tenant_id, id) on delete cascade
);

create index if not exists tenant_member_permissions_tenant_idx
  on public.tenant_member_permissions (tenant_id);

alter table public.tenant_member_permissions enable row level security;

-- Central fail-closed helper. An owner/platform-admin passes. Staff must have an
-- active linked staff row in the current tenant plus an explicit row/grant.
create or replace function private.has_admin_area_permission(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select private.is_platform_admin()) then true
    when (select private.role_level()) >= 6 then true
    when (select private.role_level()) <> 3 then false
    else coalesce((
      select case p_area
        when 'oversikt' then true
        when 'bokningar' then true
        when 'kunder' then mp.operational_role = 'manager' or mp.can_manage_customers
        when 'tjanster' then mp.operational_role = 'manager'
        when 'scheman' then mp.operational_role = 'manager'
        when 'sida' then mp.can_edit_site
        when 'statistik' then mp.can_view_daily_metrics
        else false
      end
      from public.tenant_member_permissions mp
      join public.staff s
        on s.id = mp.staff_id
       and s.tenant_id = mp.tenant_id
       and s.profile_id = (select auth.uid())
       and s.active = true
      where mp.tenant_id = (select private.tenant_id())
      limit 1
    ), false)
  end
$$;
revoke all on function private.has_admin_area_permission(text) from public;
grant execute on function private.has_admin_area_permission(text) to authenticated;

drop policy if exists tenant_member_permissions_read on public.tenant_member_permissions;
create policy tenant_member_permissions_read on public.tenant_member_permissions
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (
      (select private.role_level()) >= 6
      or exists (
        select 1 from public.staff s
        where s.id = tenant_member_permissions.staff_id
          and s.tenant_id = tenant_member_permissions.tenant_id
          and s.profile_id = (select auth.uid())
          and s.active = true
      )
    ))
    or (select private.is_platform_admin())
  );

drop policy if exists tenant_member_permissions_owner_write on public.tenant_member_permissions;
create policy tenant_member_permissions_owner_write on public.tenant_member_permissions
  for all to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 6
      and exists (
        select 1 from public.staff s
        where s.id = tenant_member_permissions.staff_id
          and s.tenant_id = tenant_member_permissions.tenant_id
          and s.active = true
      )
    )
    or (select private.is_platform_admin())
  );

revoke all on table public.tenant_member_permissions from anon;
grant select on table public.tenant_member_permissions to authenticated;
revoke insert, update, delete on table public.tenant_member_permissions from authenticated;

drop trigger if exists trg_tenant_member_permissions_updated on public.tenant_member_permissions;
create trigger trg_tenant_member_permissions_updated
  before update on public.tenant_member_permissions
  for each row execute function public.set_updated_at();

-- Smal owner-action: validerar både caller och målrad, skriver sedan behörigheten
-- och en PII-fri auditpost i samma transaktion. Direkt tabellskrivning är revokad.
create or replace function public.set_tenant_member_permissions(
  p_staff uuid,
  p_operational_role text,
  p_can_view_all_calendars boolean,
  p_can_manage_customers boolean,
  p_can_edit_site boolean,
  p_can_view_daily_metrics boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
begin
  if v_tenant is null or (select private.role_level()) < 6 then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  if p_operational_role not in ('manager', 'staff') then
    raise exception 'invalid_operational_role' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff s
    where s.id = p_staff and s.tenant_id = v_tenant and s.active = true
  ) then
    raise exception 'staff_not_found' using errcode = 'P0002';
  end if;

  insert into public.tenant_member_permissions (
    tenant_id, staff_id, operational_role, can_view_all_calendars,
    can_manage_customers, can_edit_site, can_view_daily_metrics
  ) values (
    v_tenant, p_staff, p_operational_role, p_can_view_all_calendars,
    p_can_manage_customers, p_can_edit_site, p_can_view_daily_metrics
  )
  on conflict (tenant_id, staff_id) do update set
    operational_role = excluded.operational_role,
    can_view_all_calendars = excluded.can_view_all_calendars,
    can_manage_customers = excluded.can_manage_customers,
    can_edit_site = excluded.can_edit_site,
    can_view_daily_metrics = excluded.can_view_daily_metrics,
    updated_at = now();

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'tenant.member_permissions_save',
    'staff', p_staff, jsonb_build_object('operational_role', p_operational_role)
  );
end
$$;
revoke all on function public.set_tenant_member_permissions(uuid, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_tenant_member_permissions(uuid, text, boolean, boolean, boolean, boolean) to authenticated;

-- Profilens tre notisval ägs av personen själv. RPC:n härleder både tenant och
-- staff från sessionen; inget staff-/tenant-id tas emot från klienten.
create or replace function public.set_my_notification_preferences(
  p_notify_new_booking boolean,
  p_notify_booking_changes boolean,
  p_notify_daily_reminder boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_staff uuid;
begin
  if v_tenant is null or (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select s.id into v_staff
  from public.staff s
  where s.tenant_id = v_tenant
    and s.profile_id = (select auth.uid())
    and s.active = true
  order by s.created_at
  limit 1;
  if v_staff is null then
    raise exception 'active_staff_required' using errcode = '42501';
  end if;

  insert into public.tenant_member_permissions (
    tenant_id, staff_id, operational_role,
    notify_new_booking, notify_booking_changes, notify_daily_reminder
  ) values (
    v_tenant, v_staff, 'staff',
    p_notify_new_booking, p_notify_booking_changes, p_notify_daily_reminder
  )
  on conflict (tenant_id, staff_id) do update set
    notify_new_booking = excluded.notify_new_booking,
    notify_booking_changes = excluded.notify_booking_changes,
    notify_daily_reminder = excluded.notify_daily_reminder,
    updated_at = now();

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    v_tenant, (select auth.uid()), 'staff.notification_preferences_save',
    'staff', v_staff, '{}'::jsonb
  );
end
$$;
revoke all on function public.set_my_notification_preferences(boolean, boolean, boolean) from public, anon;
grant execute on function public.set_my_notification_preferences(boolean, boolean, boolean) to authenticated;

-- ── Koppla PLATSCHEF till de verkliga driftoperationerna ───────────────────
--
-- 0076 använder require_location_admin i de atomiska boknings-/schema-RPC:erna.
-- Behåll namnet för bakåtkompatibilitet, men tillåt nu även en uttrycklig
-- PLATSCHEF på den plats där personens aktiva staff-rad finns. Ägare och gamla
-- platsadmin-konton fortsätter passera via is_location_admin.
create or replace function private.require_location_admin(p_location uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid;
begin
  select l.tenant_id into v_tenant
    from public.locations l
   where l.id = p_location and l.active = true;
  if v_tenant is null
     or v_tenant is distinct from (select private.tenant_id())
     or not (
       (select private.is_location_admin(p_location))
       or (
         (select private.has_admin_area_permission('scheman'))
         and (select private.can_access_location(p_location))
       )
     ) then
    raise exception 'location_admin_required' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;
revoke all on function private.require_location_admin(uuid) from public, anon, authenticated;

-- Att require_location_admin nu även känner PLATSCHEF får ALDRIG öppna
-- personaladministration. Triggern ligger under både RLS och SECURITY DEFINER-
-- RPC:er och kräver den gamla, strikta platsadmin-signalen för staff-skrivningar.
create or replace function private.guard_staff_management_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_location uuid := case when tg_op <> 'INSERT' then old.location_id else null end;
  v_new_location uuid := case when tg_op <> 'DELETE' then new.location_id else null end;
  v_old_tenant uuid := case when tg_op <> 'INSERT' then old.tenant_id else null end;
  v_new_tenant uuid := case when tg_op <> 'DELETE' then new.tenant_id else null end;
  v_session_tenant uuid := (select private.tenant_id());
begin
  -- Endast uttryckligt betrodda DB-/service-sessioner får passera utan användar-id.
  -- SECURITY DEFINER gör current_user olämplig här; session_user visar den verkliga
  -- anslutningsrollen medan auth.role() visar service_role i PostgREST-anrop.
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin')
     or (select private.is_platform_admin()) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if (select auth.uid()) is null then
    raise exception 'staff_admin_required' using errcode = '42501';
  end if;
  -- Organisationsägaren får även hantera äldre staff-rader utan location_id, men
  -- bara inom sin verifierade tenant.
  if (select private.has_organization_scope())
     and (v_old_tenant is null or v_old_tenant = v_session_tenant)
     and (v_new_tenant is null or v_new_tenant = v_session_tenant) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  -- Övriga måste vara riktig platsadmin på både gammal och ny plats så att en
  -- flytt inte kan användas som behörighetsgenväg.
  if (v_old_location is not null and not (select private.is_location_admin(v_old_location)))
     or (v_new_location is not null and not (select private.is_location_admin(v_new_location)))
     or (v_old_location is null and v_new_location is null) then
    raise exception 'staff_admin_required' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_staff_management_permission() from public, anon, authenticated;

drop trigger if exists trg_staff_management_permission on public.staff;
create trigger trg_staff_management_permission
  before insert or update or delete on public.staff
  for each row execute function private.guard_staff_management_permission();

-- Direkt tabellskrivning används av befintliga server actions. Policys är
-- additiva och platsbundna. En global tjänst får bara ändras av en platschef som
-- faktiskt når samtliga aktiva platser i verksamheten.
drop policy if exists services_manager_write on public.services;
create policy services_manager_write on public.services
  for all to authenticated
  using (
    tenant_id = (select private.tenant_id())
    and (select private.has_admin_area_permission('tjanster'))
    and (
      (location_id is not null and (select private.can_access_location(location_id)))
      or (
        location_id is null and not exists (
          select 1 from public.locations l
           where l.tenant_id = services.tenant_id
             and l.active = true
             and not (select private.can_access_location(l.id))
        )
      )
    )
  )
  with check (
    tenant_id = (select private.tenant_id())
    and (select private.has_admin_area_permission('tjanster'))
    and (
      (location_id is not null and (select private.can_access_location(location_id)))
      or (
        location_id is null and not exists (
          select 1 from public.locations l
           where l.tenant_id = services.tenant_id
             and l.active = true
             and not (select private.can_access_location(l.id))
        )
      )
    )
  );

drop policy if exists staff_services_manager_write on public.staff_services;
create policy staff_services_manager_write on public.staff_services
  for all to authenticated
  using (
    tenant_id = (select private.tenant_id())
    and (select private.has_admin_area_permission('tjanster'))
    and exists (
      select 1 from public.staff s
       where s.id = staff_services.staff_id
         and s.tenant_id = staff_services.tenant_id
         and s.location_id is not null
         and (select private.can_access_location(s.location_id))
    )
  )
  with check (
    tenant_id = (select private.tenant_id())
    and (select private.has_admin_area_permission('tjanster'))
    and exists (
      select 1 from public.staff s
       where s.id = staff_services.staff_id
         and s.tenant_id = staff_services.tenant_id
         and s.location_id is not null
         and (select private.can_access_location(s.location_id))
    )
  );

drop policy if exists working_hours_manager_write on public.working_hours;
create policy working_hours_manager_write on public.working_hours
  for all to authenticated
  using (
    tenant_id = (select private.tenant_id())
    and location_id is not null
    and (select private.has_admin_area_permission('scheman'))
    and (select private.can_access_location(location_id))
  )
  with check (
    tenant_id = (select private.tenant_id())
    and location_id is not null
    and (select private.has_admin_area_permission('scheman'))
    and (select private.can_access_location(location_id))
  );

drop policy if exists working_hour_slots_manager_write on public.working_hour_slots;
create policy working_hour_slots_manager_write on public.working_hour_slots
  for all to authenticated
  using (
    tenant_id = (select private.tenant_id())
    and location_id is not null
    and (select private.has_admin_area_permission('scheman'))
    and (select private.can_access_location(location_id))
  )
  with check (
    tenant_id = (select private.tenant_id())
    and location_id is not null
    and (select private.has_admin_area_permission('scheman'))
    and (select private.can_access_location(location_id))
  );

-- Den äldre seed-funktionen var bara tenant-fencad. Gör den nu både
-- behörighets- och platsfencad innan den får skriva explicita tider.
create or replace function public.seed_explicit_slots_from_hours(
  p_staff uuid,
  p_step int default 15
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_location uuid;
  v_count int := 0;
begin
  if p_step is null or p_step <= 0 or p_step > 240 then
    raise exception 'invalid_step' using errcode = '22023';
  end if;

  select s.tenant_id, s.location_id into v_tenant, v_location
    from public.staff s
   where s.id = p_staff
     and s.tenant_id = (select private.tenant_id());
  if v_tenant is null or v_location is null
     or not (select private.has_admin_area_permission('scheman'))
     or not (select private.can_access_location(v_location)) then
    raise exception 'unknown_or_forbidden_staff' using errcode = 'P0002';
  end if;

  insert into public.working_hour_slots (
    tenant_id, staff_id, location_id, weekday, start_time
  )
  select v_tenant, p_staff, coalesce(wh.location_id, v_location), wh.weekday, gs::time
    from public.working_hours wh
    cross join lateral pg_catalog.generate_series(
      ('2000-01-01'::date + wh.start_time),
      ('2000-01-01'::date + wh.end_time) - (p_step * interval '1 minute'),
      (p_step * interval '1 minute')
    ) as gs
   where wh.staff_id = p_staff
     and wh.tenant_id = v_tenant
     and coalesce(wh.location_id, v_location) = v_location
  on conflict (tenant_id, staff_id, weekday, start_time) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.seed_explicit_slots_from_hours(uuid, int) from public, anon;
grant execute on function public.seed_explicit_slots_from_hours(uuid, int) to authenticated;

-- Sidtillägget är tenantbundet men saknar platsdimension. Det är därför just det
-- explicita can_edit_site-tillägget, inte PLATSCHEF-rollen, som öppnar revisionerna.
drop policy if exists site_revisions_read on public.site_revisions;
create policy site_revisions_read on public.site_revisions
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.has_admin_area_permission('sida'))
    )
  );

create or replace function private.assert_site_revision_access(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (
    (select private.is_platform_admin())
    or (
      (select private.tenant_id()) = p_tenant
      and (select private.has_admin_area_permission('sida'))
    )
  ) then
    raise exception 'site_revision_scope_denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_site_revision_access(uuid)
  from public, anon, authenticated, service_role;
