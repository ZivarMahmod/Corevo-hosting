-- Goal 76 — module-aware tenant readiness and atomic publication.
--
-- New tenants remain provisioning until this DB-owned gate is green. The same
-- private source feeds the admin read RPC, the publish RPC and a trigger that
-- blocks direct status='active' bypasses.

create or replace function private.tenant_launch_missing(p_tenant uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[] := '{}'::text[];
  v_slug text;
  v_location uuid;
  v_booking_required boolean := false;
begin
  select t.slug
    into v_slug
    from public.tenants t
   where t.id = p_tenant;

  if not exists (
    select 1
      from public.tenant_settings ts
     where ts.tenant_id = p_tenant
  ) then
    v_missing := pg_catalog.array_append(v_missing, 'tenant_settings');
  end if;

  select l.id
    into v_location
    from public.locations l
   where l.tenant_id = p_tenant
     and l.is_primary = true
     and l.active = true
   order by l.created_at, l.id
   limit 1;

  if v_location is null then
    v_missing := pg_catalog.array_append(v_missing, 'primary_location');
  end if;

  if not exists (
    select 1
      from public.users u
      join public.roles r
        on r.id = u.role_id
       and r.tenant_id = p_tenant
       and r.name = 'salon_admin'
     where u.tenant_id = p_tenant
       and u.status = 'active'
  ) then
    v_missing := pg_catalog.array_append(v_missing, 'owner');
  end if;

  if v_slug is null
     or v_slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    v_missing := pg_catalog.array_append(v_missing, 'canonical_host');
  end if;

  select exists (
    select 1
      from public.tenant_modules tm
     where tm.tenant_id = p_tenant
       and tm.module_key = 'booking'
       and tm.state = 'live'
  ) into v_booking_required;

  if v_booking_required then
    if v_location is null or not exists (
      select 1
        from public.services svc
       where svc.tenant_id = p_tenant
         and svc.active = true
         and (svc.location_id is null or svc.location_id = v_location)
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'bookable_service');
    end if;

    if v_location is null or not exists (
      select 1
        from public.staff st
       where st.tenant_id = p_tenant
         and st.active = true
         and st.location_id = v_location
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'bookable_staff');
    end if;

    if v_location is null or not exists (
      select 1
        from public.staff_services ss
        join public.staff st
          on st.id = ss.staff_id
         and st.tenant_id = p_tenant
         and st.active = true
         and st.location_id = v_location
        join public.services svc
          on svc.id = ss.service_id
         and svc.tenant_id = p_tenant
         and svc.active = true
         and (svc.location_id is null or svc.location_id = v_location)
       where ss.tenant_id = p_tenant
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'service_assignment');
    end if;

    if v_location is null or not exists (
      select 1
        from public.working_hours wh
        join public.staff st
          on st.id = wh.staff_id
         and st.tenant_id = p_tenant
         and st.active = true
         and st.location_id = v_location
       where wh.tenant_id = p_tenant
         and wh.location_id = v_location
         and exists (
           select 1
             from public.staff_services ss
             join public.services svc
               on svc.id = ss.service_id
              and svc.tenant_id = p_tenant
              and svc.active = true
              and (svc.location_id is null or svc.location_id = v_location)
            where ss.tenant_id = p_tenant
              and ss.staff_id = st.id
         )
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'working_hours');
    end if;

    if v_location is null or not exists (
      select 1
        from public.location_opening_hours loh
       where loh.tenant_id = p_tenant
         and loh.location_id = v_location
         and loh.source = 'confirmed'
         and loh.confirmed_at is not null
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'confirmed_opening_hours');
    end if;
  end if;

  return v_missing;
end;
$$;

revoke all on function private.tenant_launch_missing(uuid)
  from public, anon, authenticated;

create or replace function public.tenant_launch_readiness(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_status text;
  v_missing text[];
  v_booking_required boolean;
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
begin
  if not v_service and (
    (select auth.uid()) is null
    or not (select private.can_access_tenant(p_tenant))
  ) then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select t.slug, t.status
    into v_slug, v_status
    from public.tenants t
   where t.id = p_tenant;
  if not found then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  v_missing := private.tenant_launch_missing(p_tenant);
  select exists (
    select 1
      from public.tenant_modules tm
     where tm.tenant_id = p_tenant
       and tm.module_key = 'booking'
       and tm.state = 'live'
  ) into v_booking_required;

  return pg_catalog.jsonb_build_object(
    'ready', pg_catalog.cardinality(v_missing) = 0,
    'booking_required', v_booking_required,
    'canonical_host', v_slug || '.boka.corevo.se',
    'tenant_status', v_status,
    'missing', pg_catalog.to_jsonb(v_missing)
  );
end;
$$;

revoke all on function public.tenant_launch_readiness(uuid)
  from public, anon, authenticated;
grant execute on function public.tenant_launch_readiness(uuid)
  to authenticated, service_role;

create or replace function private.enforce_tenant_launch_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if new.status = 'active' and tg_op = 'INSERT' then
    v_missing := private.tenant_launch_missing(new.id);
    if pg_catalog.cardinality(v_missing) > 0 then
      raise exception 'tenant_not_ready'
        using errcode = '55000',
              detail = pg_catalog.array_to_string(v_missing, ',');
    end if;
  elsif new.status = 'active' and old.status is distinct from 'active' then
    v_missing := private.tenant_launch_missing(new.id);
    if pg_catalog.cardinality(v_missing) > 0 then
      raise exception 'tenant_not_ready'
        using errcode = '55000',
              detail = pg_catalog.array_to_string(v_missing, ',');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_tenant_launch_readiness()
  from public, anon, authenticated;

drop trigger if exists trg_tenant_launch_readiness on public.tenants;
create trigger trg_tenant_launch_readiness
  before insert or update of status on public.tenants
  for each row execute function private.enforce_tenant_launch_readiness();

create or replace function public.publish_tenant(p_tenant uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_status text;
  v_missing text[];
  v_booking_required boolean;
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
begin
  if not v_service and (
    (select auth.uid()) is null
    or not (select private.can_access_tenant(p_tenant))
  ) then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select t.slug, t.status
    into v_slug, v_status
    from public.tenants t
   where t.id = p_tenant
   for update;
  if not found then
    raise exception 'tenant_access_denied' using errcode = '42501';
  end if;

  select exists (
    select 1
      from public.tenant_modules tm
     where tm.tenant_id = p_tenant
       and tm.module_key = 'booking'
       and tm.state = 'live'
  ) into v_booking_required;

  if v_status = 'active' then
    return pg_catalog.jsonb_build_object(
      'ready', true,
      'booking_required', v_booking_required,
      'canonical_host', v_slug || '.boka.corevo.se',
      'tenant_status', 'active',
      'missing', '[]'::jsonb,
      'transitioned', false
    );
  end if;

  v_missing := private.tenant_launch_missing(p_tenant);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'tenant_not_ready'
      using errcode = '55000',
            detail = pg_catalog.array_to_string(v_missing, ',');
  end if;

  update public.tenants
     set status = 'active'
   where id = p_tenant;

  return pg_catalog.jsonb_build_object(
    'ready', true,
    'booking_required', v_booking_required,
    'canonical_host', v_slug || '.boka.corevo.se',
    'tenant_status', 'active',
    'missing', '[]'::jsonb,
    'transitioned', true
  );
end;
$$;

revoke all on function public.publish_tenant(uuid)
  from public, anon, authenticated;
grant execute on function public.publish_tenant(uuid)
  to authenticated, service_role;

comment on function public.tenant_launch_readiness(uuid) is
  'Goal 76: scopead, modulstyrd readiness för provisioning -> active.';
comment on function public.publish_tenant(uuid) is
  'Goal 76: atomisk och idempotent publicering under tenant-radlås.';
