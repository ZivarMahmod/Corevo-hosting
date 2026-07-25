-- Goal 84 — readiness requires one booking the storefront can actually start.
-- A missing booking row keeps the historical live default; explicit off is the
-- website-only opt-out. Keep read, publish and the trigger's private source aligned.

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
  select t.slug into v_slug from public.tenants t where t.id = p_tenant;

  if not exists (select 1 from public.tenant_settings ts where ts.tenant_id = p_tenant) then
    v_missing := pg_catalog.array_append(v_missing, 'tenant_settings');
  end if;

  select l.id into v_location
  from public.locations l
  where l.tenant_id = p_tenant and l.is_primary = true and l.active = true
  order by l.created_at, l.id
  limit 1;
  if v_location is null then
    v_missing := pg_catalog.array_append(v_missing, 'primary_location');
  end if;

  if not exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id and r.tenant_id = p_tenant and r.name = 'salon_admin'
    where u.tenant_id = p_tenant and u.status = 'active'
  ) then
    v_missing := pg_catalog.array_append(v_missing, 'owner');
  end if;

  if v_slug is null or v_slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    v_missing := pg_catalog.array_append(v_missing, 'canonical_host');
  end if;

  select coalesce((
    select tm.state = 'live'
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant and tm.module_key = 'booking'
    limit 1
  ), true) into v_booking_required;

  if v_booking_required then
    if v_location is null or not exists (
      select 1 from public.services svc
      where svc.tenant_id = p_tenant and svc.active = true
        and (svc.location_id is null or svc.location_id = v_location)
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'bookable_service');
    end if;

    if v_location is null or not exists (
      select 1 from public.staff st
      where st.tenant_id = p_tenant and st.active = true and st.location_id = v_location
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'bookable_staff');
    end if;

    if v_location is null or not exists (
      select 1
      from public.staff_services ss
      join public.staff st on st.id = ss.staff_id and st.tenant_id = p_tenant and st.active = true and st.location_id = v_location
      join public.services svc on svc.id = ss.service_id and svc.tenant_id = p_tenant and svc.active = true
        and (svc.location_id is null or svc.location_id = v_location)
      where ss.tenant_id = p_tenant
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'service_assignment');
    end if;

    -- A readiness-green booking must satisfy the same weekday and fallback raster
    -- as private.assert_storefront_booking_start (0093): wh.start + n * step.
    if v_location is null or not exists (
      select 1
      from public.services svc
      join public.staff_services ss on ss.tenant_id = p_tenant and ss.service_id = svc.id
      join public.staff st on st.id = ss.staff_id and st.tenant_id = p_tenant and st.active = true and st.location_id = v_location
      join public.working_hours wh on wh.tenant_id = p_tenant and wh.staff_id = st.id and wh.location_id = v_location
      join public.location_opening_hours loh on loh.tenant_id = p_tenant and loh.location_id = v_location
        and loh.weekday = wh.weekday and loh.source = 'confirmed' and loh.confirmed_at is not null
      join public.locations l on l.id = v_location and l.tenant_id = p_tenant and l.active = true
      cross join lateral (
        select coalesce(svc.slot_step_min, st.slot_step_min, l.slot_step_min, 15) as step_min
      ) step
      where svc.tenant_id = p_tenant and svc.active = true
        and (svc.location_id is null or svc.location_id = v_location)
        and (
          exists (
            select 1 from public.working_hour_slots ws
            where ws.tenant_id = p_tenant and ws.location_id = v_location and ws.staff_id = st.id
              and ws.weekday = wh.weekday and ws.active = true
              and ws.start_time >= wh.start_time and ws.start_time >= loh.start_time
              and (date '2000-01-01' + ws.start_time) + pg_catalog.make_interval(mins => svc.duration_min)
                    <= date '2000-01-01' + wh.end_time
              and (date '2000-01-01' + ws.start_time) + pg_catalog.make_interval(mins => svc.duration_min)
                    <= date '2000-01-01' + loh.end_time
          )
          or (
            not exists (
              select 1 from public.working_hour_slots ws
              where ws.tenant_id = p_tenant and ws.location_id = v_location and ws.staff_id = st.id
                and ws.weekday = wh.weekday and ws.active = true
            )
            and exists (
              select 1
              from pg_catalog.generate_series(
                0,
                pg_catalog.floor(
                  pg_catalog.date_part('epoch', wh.end_time - wh.start_time) / 60 / step.step_min
                )::int
              ) as slot_index(n)
              where (date '2000-01-01' + wh.start_time)
                      + pg_catalog.make_interval(mins => slot_index.n * step.step_min)
                    >= date '2000-01-01' + loh.start_time
                and (date '2000-01-01' + wh.start_time)
                      + pg_catalog.make_interval(mins => slot_index.n * step.step_min)
                      + pg_catalog.make_interval(mins => svc.duration_min)
                    <= date '2000-01-01' + wh.end_time
                and (date '2000-01-01' + wh.start_time)
                      + pg_catalog.make_interval(mins => slot_index.n * step.step_min)
                      + pg_catalog.make_interval(mins => svc.duration_min)
                    <= date '2000-01-01' + loh.end_time
            )
          )
        )
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'working_hours');
    end if;

    if v_location is null or not exists (
      select 1 from public.location_opening_hours loh
      where loh.tenant_id = p_tenant and loh.location_id = v_location
        and loh.source = 'confirmed' and loh.confirmed_at is not null
    ) then
      v_missing := pg_catalog.array_append(v_missing, 'confirmed_opening_hours');
    end if;
  end if;

  return v_missing;
end;
$$;

revoke all on function private.tenant_launch_missing(uuid)
  from public, anon, authenticated, service_role;

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
  select coalesce((
    select tm.state = 'live'
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant and tm.module_key = 'booking'
    limit 1
  ), true) into v_booking_required;

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
  from public, anon, authenticated, service_role;
grant execute on function public.tenant_launch_readiness(uuid)
  to authenticated, service_role;

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

  select coalesce((
    select tm.state = 'live'
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant and tm.module_key = 'booking'
    limit 1
  ), true) into v_booking_required;

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
  from public, anon, authenticated, service_role;
grant execute on function public.publish_tenant(uuid)
  to authenticated, service_role;

-- Goal 84 exposes the existing opening-hours editor in the scoped platform
-- workspace. Partner operators already pass the atomic RPC's can_access_tenant
-- write gate, so the read policy must use the same scope or an empty RLS result
-- could be saved back as a destructive replacement.
drop policy if exists location_opening_hours_read
  on public.location_opening_hours;
create policy location_opening_hours_read
  on public.location_opening_hours
  for select to authenticated
  using (
    (select private.can_access_tenant(location_opening_hours.tenant_id))
    or (
      location_opening_hours.tenant_id = (select private.tenant_id())
      and (
        (select private.can_access_location(location_opening_hours.location_id))
        or (select private.role_level()) = 2
      )
    )
  );
