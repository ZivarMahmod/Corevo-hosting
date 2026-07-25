-- Goal 84 — user provisioning reads the assigned role while checking users RLS.
-- The role table's own read policy references users, so raw role subqueries inside
-- users policies expand users -> roles -> users and fail with PostgreSQL 42P17.

create or replace function private.tenant_role_in_range(
  p_role uuid,
  p_tenant uuid,
  p_min_level integer,
  p_max_level integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_min_level between 1 and 8
    and p_max_level between p_min_level and 8
    and exists (
      select 1
      from public.roles r
      where r.id = p_role
        and r.tenant_id = p_tenant
        and r.level between p_min_level and p_max_level
    )
$$;

revoke all on function private.tenant_role_in_range(uuid, uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.tenant_role_in_range(uuid, uuid, integer, integer)
  to authenticated;

drop policy if exists users_admin_insert on public.users;
create policy users_admin_insert on public.users
  for insert to authenticated
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.has_organization_scope())
      and (select private.tenant_role_in_range(
        role_id,
        users.tenant_id,
        1,
        (select private.role_level())
      ))
    )
  );

drop policy if exists users_partner_insert on public.users;
create policy users_partner_insert on public.users
  for insert to authenticated
  with check (
    (select private.partner_id()) is not null
    and (select private.can_access_tenant(tenant_id))
    and (select private.tenant_role_in_range(role_id, users.tenant_id, 1, 6))
  );

-- Platform and partner operators may configure a provisioning tenant, but the
-- original 0076 trigger required every confirmer to be tenant-local. Keep the
-- tenant-member rule and admit only the current scoped global operator.
create or replace function private.enforce_location_resource_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.locations l
    where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_location_resource' using errcode = 'P0002';
  end if;

  if coalesce((select auth.role()), '') = 'authenticated' then
    if not (
      (select private.is_location_admin(new.location_id))
      or (select private.can_access_tenant(new.tenant_id))
    ) then
      raise exception 'location_admin_required' using errcode = '42501';
    end if;
    if tg_table_name = 'location_opening_hours' then
      new.source := 'confirmed';
      new.confirmed_at := now();
      new.confirmed_by := (select auth.uid());
    elsif tg_table_name = 'location_closures' then
      new.created_by := (select auth.uid());
    end if;
  end if;

  if tg_table_name = 'location_opening_hours'
     and new.confirmed_by is not null
     and not exists (
       select 1 from public.users u
       where u.id = new.confirmed_by and u.tenant_id = new.tenant_id
     )
     and not (
       coalesce((select auth.role()), '') = 'authenticated'
       and new.confirmed_by = (select auth.uid())
       and (select private.can_access_tenant(new.tenant_id))
     ) then
    raise exception 'invalid_opening_hours_confirmer' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_location_resource_fence()
  from public, anon, authenticated, service_role;
