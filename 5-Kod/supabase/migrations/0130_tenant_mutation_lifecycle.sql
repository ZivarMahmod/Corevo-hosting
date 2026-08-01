-- Goal 82: tenant-owned writes require an active tenant.
-- Read policies stay unchanged so provisioning/suspended/deleted tenants retain
-- their existing read-only portal views. Root/partner scope and trusted backend
-- roles keep their established lifecycle-management paths.

begin;

create or replace function private.assert_tenant_status_active(p_tenant uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant
      and t.status = 'active'
  ) then
    raise exception 'tenant_mutation_requires_active_tenant' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_tenant_status_active(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.assert_active_tenant_mutation(p_tenant uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Plain migration/maintenance sessions retain their trusted bypass. A test or
  -- request that installed JWT claims must exercise the real lifecycle fence even
  -- though SET LOCAL ROLE leaves session_user as postgres/supabase_admin.
  if (
       session_user in ('postgres', 'supabase_admin')
       and coalesce((select auth.role()), '') = ''
     )
     or (select private.can_access_tenant(p_tenant)) then
    return;
  end if;

  perform private.assert_tenant_status_active(p_tenant);

  -- Service-role callers may write only while the explicit target is active.
  -- Tenant users additionally need the verified session tenant to match.
  if (select auth.role()) = 'service_role' then
    return;
  end if;
  if (select auth.uid()) is null
     or (select private.tenant_id()) is distinct from p_tenant then
    raise exception 'tenant_mutation_requires_active_tenant' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_active_tenant_mutation(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.require_tenant_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid := (select private.tenant_id());
begin
  if v_tenant is null or not (select private.has_organization_scope()) then
    raise exception 'owner_required' using errcode = '42501';
  end if;
  perform private.assert_active_tenant_mutation(v_tenant);
  return v_tenant;
end;
$$;
revoke all on function private.require_tenant_owner()
  from public, anon, authenticated;

-- All location-admin SECURITY DEFINER RPCs already converge here. Preserve the
-- verified platform/partner branch, then require active lifecycle before the
-- tenant owner/manager permission checks.
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
  if v_tenant is null then
    raise exception 'location_admin_required' using errcode = '42501';
  end if;
  if (select private.can_access_tenant(v_tenant)) then
    return v_tenant;
  end if;

  perform private.assert_active_tenant_mutation(v_tenant);
  if v_tenant is distinct from (select private.tenant_id())
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
revoke all on function private.require_location_admin(uuid)
  from public, anon, authenticated;

-- These two absence-impact RPCs are read-only. They retain the same role,
-- tenant and location checks without inheriting the active-only write fence.
create or replace function private.require_location_admin_read(p_location uuid)
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
  if v_tenant is null then
    raise exception 'location_admin_required' using errcode = '42501';
  end if;
  if (select private.can_access_tenant(v_tenant)) then
    return v_tenant;
  end if;
  if v_tenant is distinct from (select private.tenant_id())
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
revoke all on function private.require_location_admin_read(uuid)
  from public, anon, authenticated;

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
  perform private.require_location_admin_read(p_location);
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
  perform private.require_location_admin_read(v_location);

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

create or replace function public.set_my_primary_location(p_location uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_tenant uuid := (select private.tenant_id());
begin
  if (select auth.uid()) is null
     or p_location is null
     or not (select private.can_access_location(p_location)) then
    raise exception 'invalid_or_forbidden_location' using errcode = '42501';
  end if;
  perform private.assert_active_tenant_mutation(v_tenant);

  update public.users u
     set primary_location_id = p_location,
         updated_at = now()
   where u.id = (select auth.uid())
     and u.status = 'active';
  if not found then
    raise exception 'active_user_required' using errcode = '42501';
  end if;
end;
$$;

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
  perform private.assert_active_tenant_mutation(v_tenant);

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
  perform private.assert_active_tenant_mutation(v_tenant);
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
  perform private.assert_active_tenant_mutation(v_tenant);

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
  perform private.assert_active_tenant_mutation(v_tenant);
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
  perform private.assert_active_tenant_mutation(v_tenant);
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

create or replace function public.create_staff_walk_in(
  p_staff uuid,
  p_location uuid,
  p_service uuid,
  p_start timestamptz,
  p_name text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_name text := nullif(pg_catalog.btrim(p_name), '');
  v_start timestamptz;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_duration int;
  v_price int;
  v_end timestamptz;
  v_customer uuid;
  v_booking uuid;
begin
  if (select auth.uid()) is null or v_tenant is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  perform private.assert_active_tenant_mutation(v_tenant);
  if p_start is null then
    raise exception 'walk_in_start_required' using errcode = '22023';
  end if;
  v_start := pg_catalog.date_trunc('minute', p_start);
  if v_start < pg_catalog.date_trunc('minute', v_now) - interval '4 hours' then
    raise exception 'walk_in_start_too_old' using errcode = '22023';
  end if;
  if v_start > pg_catalog.date_trunc('minute', v_now) + interval '30 minutes' then
    raise exception 'walk_in_start_too_far_ahead' using errcode = '22023';
  end if;
  if pg_catalog.length(v_name) > 200 then
    raise exception 'walk_in_name_too_long' using errcode = '22023';
  end if;

  select svc.duration_min, svc.price_cents
    into v_duration, v_price
    from public.staff st
    join public.locations loc
      on loc.id = p_location
     and loc.tenant_id = st.tenant_id
     and loc.active = true
    join public.staff_services ss
      on ss.tenant_id = st.tenant_id
     and ss.staff_id = st.id
     and ss.service_id = p_service
    join public.services svc
      on svc.id = ss.service_id
     and svc.tenant_id = st.tenant_id
     and svc.active = true
     and (svc.location_id is null or svc.location_id = p_location)
   where st.id = p_staff
     and st.tenant_id = v_tenant
     and st.location_id = p_location
     and st.active = true
     and st.profile_id = (select auth.uid());
  if not found then
    raise exception 'staff_walk_in_resources_forbidden' using errcode = '42501';
  end if;

  v_end := v_start + pg_catalog.make_interval(mins => v_duration);
  v_booking := gen_random_uuid();

  if v_name is not null then
    insert into public.customers (tenant_id, full_name, last_seen_at)
    values (v_tenant, v_name, pg_catalog.now())
    returning id into v_customer;
  end if;

  insert into private.staff_walk_in_intents (
    booking_id, transaction_id, actor_user_id, tenant_id,
    location_id, staff_id, service_id, start_ts, end_ts
  ) values (
    v_booking, pg_catalog.txid_current(), (select auth.uid()), v_tenant,
    p_location, p_staff, p_service, v_start, v_end
  );

  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id,
    customer_id, start_ts, end_ts, status, price_cents, note
  ) values (
    v_booking, v_tenant, p_location, p_staff, p_service,
    v_customer, v_start, v_end, 'confirmed', v_price, null
  )
  returning id into v_booking;

  delete from private.staff_walk_in_intents wi
   where wi.booking_id = v_booking
     and wi.transaction_id = pg_catalog.txid_current();

  return v_booking;
end;
$$;

-- This public wrapper is called with service_role by the admin action. Its
-- lifecycle check must therefore be status-only and must not inherit the trusted
-- role bypass used by scoped operator functions.
create or replace function public.atomic_erase_tenant_customer(
  p_tenant uuid,
  p_customer uuid,
  p_actor uuid
) returns table (
  status text,
  erased_bookings integer,
  auth_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_tenant_status_active(p_tenant);
  return query
    select *
    from private.atomic_erase_tenant_customer_tx(
      p_tenant, p_customer, p_actor, null, false, null
    );
end;
$$;

create or replace function public.platform_set_contact_message_status(
  p_tenant uuid,
  p_message uuid,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator boolean := (select private.can_access_tenant(p_tenant));
begin
  if (select auth.uid()) is null
     or not (
       v_operator
       or (
         (select private.tenant_id()) = p_tenant
         and (select private.has_organization_scope())
       )
     ) then
    raise exception 'contact_message_scope_denied' using errcode = '42501';
  end if;
  if not v_operator then
    perform private.assert_active_tenant_mutation(p_tenant);
  end if;
  if p_status not in ('new', 'read', 'archived') then
    raise exception 'contact_message_status_invalid' using errcode = '22023';
  end if;

  update public.contact_messages cm
  set status = p_status
  where cm.id = p_message
    and cm.tenant_id = p_tenant;
  if not found then
    raise exception 'contact_message_missing' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'tenant.contact',
    'contact_messages',
    p_message,
    jsonb_build_object('contact_message', p_status)
  );
  return true;
end;
$$;

-- The snapshot RPCs are mutation-only. Restore the explicit can_edit_site grant
-- regressed by 0115, while keeping operator scope and adding lifecycle denial.
create or replace function private.assert_site_revision_access(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.can_access_tenant(p_tenant)) then
    return;
  end if;

  if (select auth.uid()) is not null
     and (select private.tenant_id()) = p_tenant
     and (select private.has_admin_area_permission('sida')) then
    perform private.assert_active_tenant_mutation(p_tenant);
    return;
  end if;

  raise exception 'site_revision_scope_denied' using errcode = '42501';
end;
$$;
revoke all on function private.assert_site_revision_access(uuid)
  from public, anon, authenticated, service_role;

commit;
