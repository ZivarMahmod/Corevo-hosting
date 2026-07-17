-- 0083 — tenantvida rolländringar får bara göras av organisationsägaren.
--
-- 0081 använde role_level >= 6. Det skiljer inte organisationsägare från en
-- platsbunden admin på samma rollnivå. Den här additiva migrationen bevarar
-- platschefens driftbehörigheter men stänger läsning/skrivning av hela tenantens
-- behörighetsmatris bakom den redan etablerade organization-scope-signalen.

drop policy if exists tenant_member_permissions_read
  on public.tenant_member_permissions;
create policy tenant_member_permissions_read on public.tenant_member_permissions
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or exists (
          select 1
          from public.staff s
          where s.id = tenant_member_permissions.staff_id
            and s.tenant_id = tenant_member_permissions.tenant_id
            and s.profile_id = (select auth.uid())
            and s.active = true
        )
      )
    )
  );

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
  if v_tenant is null or not (
    (select private.is_platform_admin())
    or (select private.has_organization_scope())
  ) then
    raise exception 'organization_owner_required' using errcode = '42501';
  end if;
  if p_operational_role not in ('manager', 'staff') then
    raise exception 'invalid_operational_role' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.staff s
    where s.id = p_staff
      and s.tenant_id = v_tenant
      and s.active = true
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

revoke all on function public.set_tenant_member_permissions(
  uuid, text, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.set_tenant_member_permissions(
  uuid, text, boolean, boolean, boolean, boolean
) to authenticated;
