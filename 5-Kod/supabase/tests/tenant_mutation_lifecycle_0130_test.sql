-- 0130 runtime: active-only tenant mutations, read-only suspension and operator bypass.
-- Fixtures and every mutation are rolled back.
begin;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
select set_config(
  'corevo.test_site_snapshot',
  '{
    "tenant":{"name":"Lifecycle 0130"},
    "settings":{
      "copy":{},"theme":"kalla",
      "contact":{"email":null,"phone":null},
      "social":{"instagram":null,"facebook":null,"tiktok":null},
      "map":null,"opening_hours":null,
      "seo":{"title":null,"description":null},
      "booking":{"variant":"wizard","pickerMode":"calendar","staffAvatars":"initialer"}
    },
    "branding":{},"location":{"address":null}
  }',
  true
);

insert into public.tenants (id, slug, name, status) values
  ('13000000-0000-0000-0000-000000000001', 'tenant-lifecycle-0130', 'Lifecycle 0130', 'provisioning');
insert into public.tenant_settings (tenant_id) values
  ('13000000-0000-0000-0000-000000000001');
insert into public.locations (id, tenant_id, name, timezone, is_primary, active) values
  ('13000000-0000-0000-0000-000000000011', '13000000-0000-0000-0000-000000000001', 'Primary', 'Europe/Stockholm', true, true);
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
) values (
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000011',
  1, '09:00', '17:00', 'confirmed', now()
);
insert into public.services (id, tenant_id, location_id, name, duration_min, active) values
  ('13000000-0000-0000-0000-000000000031', '13000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000011', 'Lifecycle service', 30, true);
insert into public.roles (id, tenant_id, name, level) values
  ('13000000-0000-0000-0000-000000000021', '13000000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('13000000-0000-0000-0000-000000000022', '13000000-0000-0000-0000-000000000001', 'staff', 3),
  ('13000000-0000-0000-0000-000000000023', null, 'super_admin', 8);
insert into auth.users (id, email) values
  ('13000000-0000-0000-0000-000000000101', 'owner-0130@example.test'),
  ('13000000-0000-0000-0000-000000000102', 'staff-0130@example.test'),
  ('13000000-0000-0000-0000-000000000103', 'root-0130@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('13000000-0000-0000-0000-000000000101', '13000000-0000-0000-0000-000000000001', 'owner-0130@example.test', '13000000-0000-0000-0000-000000000021', 'organization', 'active'),
  ('13000000-0000-0000-0000-000000000102', '13000000-0000-0000-0000-000000000001', 'staff-0130@example.test', '13000000-0000-0000-0000-000000000022', 'locations', 'active'),
  ('13000000-0000-0000-0000-000000000103', null, 'root-0130@example.test', '13000000-0000-0000-0000-000000000023', 'organization', 'active');
insert into public.staff (id, tenant_id, location_id, profile_id, title, active) values
  ('13000000-0000-0000-0000-000000000041', '13000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000011', '13000000-0000-0000-0000-000000000102', 'Editor', false);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000041',
  '13000000-0000-0000-0000-000000000031'
);
insert into public.working_hours (
  tenant_id, staff_id, location_id, weekday, start_time, end_time
) values (
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000041',
  '13000000-0000-0000-0000-000000000011',
  1, '09:00', '17:00'
);
update public.staff
   set active = true
 where id = '13000000-0000-0000-0000-000000000041';
insert into public.tenant_member_permissions (
  tenant_id, staff_id, operational_role, can_edit_site
) values (
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000041',
  'staff',
  true
);

-- Cross 0079 first and 0127 only after settings, primary location and owner exist.
-- Tenant status is a platform-owned field, so the DB-verified root performs it.
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;
update public.tenants
   set status = 'active'
 where id = '13000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

-- Installing JWT claims before SET LOCAL ROLE must prevent the maintenance bypass.
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"13000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$ begin
  if coalesce((select auth.role()), '') <> 'authenticated' then
    raise exception 'jwt_role_preflight_failed_%', coalesce((select auth.role()), '<null>');
  end if;
end $$;

-- Active staff may save preferences and use the explicit can_edit_site grant.
select public.set_my_notification_preferences(true, false, true);
do $$
declare v_lock bigint;
begin
  select s.lock_version into v_lock
  from public.save_site_draft(
    '13000000-0000-0000-0000-000000000001',
    current_setting('corevo.test_site_snapshot')::jsonb,
    null
  ) s;
  if v_lock <> 1 then raise exception 'active_can_edit_site_lock_%', v_lock; end if;
end $$;

-- Suspension is likewise restricted to a DB-verified platform operator.
reset role;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;
update public.tenants
   set status = 'suspended'
 where id = '13000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

-- The same staff JWT can still authenticate, but both writes now fail at the fence.
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"13000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$ begin
  begin
    perform public.set_my_notification_preferences(false, true, false);
    raise exception 'suspended_staff_write_succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'tenant_mutation_requires_active_tenant' then raise; end if;
  end;

  begin
    perform *
    from public.save_site_draft(
      '13000000-0000-0000-0000-000000000001',
      current_setting('corevo.test_site_snapshot')::jsonb,
      1
    );
    raise exception 'suspended_can_edit_site_succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'tenant_mutation_requires_active_tenant' then raise; end if;
  end;
end $$;

-- Suspended tenants retain authorized read RPCs.
reset role;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"13000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;
do $$ begin
  perform *
  from public.preview_admin_time_off_impacts(
    '13000000-0000-0000-0000-000000000011',
    '13000000-0000-0000-0000-000000000041',
    now(),
    now() + interval '1 hour'
  );
end $$;

-- The service-role erasure wrapper must enforce status atomically.
reset role;
do $$ begin
  if not has_function_privilege(
    'service_role',
    'public.atomic_erase_tenant_customer(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'service_role_atomic_erase_execute_missing';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_preflight_failed_%', coalesce((select auth.role()), '<null>');
  end if;
  begin
    perform *
    from public.atomic_erase_tenant_customer(
      '13000000-0000-0000-0000-000000000001',
      '13000000-0000-0000-0000-000000000061',
      '13000000-0000-0000-0000-000000000101'
    );
    raise exception 'suspended_service_erase_succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'tenant_mutation_requires_active_tenant' then raise; end if;
  end;
end $$;

-- A DB-verified root operator remains able to manage a suspended tenant.
reset role;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;
do $$
declare v_lock bigint;
begin
  select s.lock_version into v_lock
  from public.save_site_draft(
    '13000000-0000-0000-0000-000000000001',
    current_setting('corevo.test_site_snapshot')::jsonb,
    1
  ) s;
  if v_lock <> 2 then raise exception 'root_operator_bypass_lock_%', v_lock; end if;
end $$;

-- A plain migration/psql session with no claims retains the maintenance bypass.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
select private.assert_active_tenant_mutation(
  '13000000-0000-0000-0000-000000000001'
);

rollback;
