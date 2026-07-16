-- 0079 runtime: onboarding order and deferred active-staff invariants.
-- Everything is rolled back.
begin;

grant select, insert, update, delete on public.locations, public.services,
  public.staff, public.staff_services, public.working_hours,
  public.location_opening_hours to authenticated;
grant usage on schema extensions to authenticated;
grant execute on function extensions.gen_random_uuid() to authenticated;

select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.tenants (id, slug, name) values
  ('79000000-0000-0000-0000-000000000001', 'readiness-0079', 'Readiness 0079');
insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('79000000-0000-0000-0000-000000000011', '79000000-0000-0000-0000-000000000001', 'Confirmed', 'Europe/Stockholm', true),
  ('79000000-0000-0000-0000-000000000012', '79000000-0000-0000-0000-000000000001', 'Draft', 'Europe/Stockholm', false);
insert into public.roles (id, tenant_id, name, level) values
  ('79000000-0000-0000-0000-000000000021', '79000000-0000-0000-0000-000000000001', 'owner', 6);
insert into auth.users (id, email) values
  ('79000000-0000-0000-0000-000000000101', 'owner-0079@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('79000000-0000-0000-0000-000000000101', '79000000-0000-0000-0000-000000000001', 'owner-0079@example.test', '79000000-0000-0000-0000-000000000021', 'organization', 'active');
insert into public.services (id, tenant_id, location_id, name, duration_min) values
  ('79000000-0000-0000-0000-000000000031', '79000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000011', 'Confirmed one', 30),
  ('79000000-0000-0000-0000-000000000032', '79000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000011', 'Confirmed two', 30),
  ('79000000-0000-0000-0000-000000000033', '79000000-0000-0000-0000-000000000001', null, 'Shared', 30);
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '79000000-0000-0000-0000-000000000001',
       '79000000-0000-0000-0000-000000000011', d, '09:00', '18:00', 'confirmed', now()
  from generate_series(0, 6) d;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source
)
select '79000000-0000-0000-0000-000000000001',
       '79000000-0000-0000-0000-000000000012', d, '09:00', '17:00', 'default'
  from generate_series(1, 5) d;

reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"79000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"79000000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

-- Confirmed onboarding inserts the draft row first, then resources, then activates.
do $$
declare
  v_staff uuid;
  v_active boolean;
  v_services int;
  v_hours int;
begin
  v_staff := public.create_staff_with_defaults(
    'Ready 0079', '79000000-0000-0000-0000-000000000011', null
  );
  select st.active into v_active from public.staff st where st.id = v_staff;
  select count(*) into v_services from public.staff_services ss where ss.staff_id = v_staff;
  select count(*) into v_hours from public.working_hours wh where wh.staff_id = v_staff;
  if not v_active or v_services <> 3 or v_hours <> 7 then
    raise exception 'confirmed_onboarding_not_ready_%_%_%', v_active, v_services, v_hours;
  end if;
end $$;

-- Unconfirmed imported/default hours create a usable draft, never an active row.
do $$
declare
  v_staff uuid;
  v_active boolean;
  v_services int;
  v_hours int;
begin
  v_staff := public.create_staff_with_defaults(
    'Draft 0079', '79000000-0000-0000-0000-000000000012', null
  );
  select st.active into v_active from public.staff st where st.id = v_staff;
  select count(*) into v_services from public.staff_services ss where ss.staff_id = v_staff;
  select count(*) into v_hours from public.working_hours wh where wh.staff_id = v_staff;
  if v_active or v_services <> 1 or v_hours <> 5 then
    raise exception 'draft_onboarding_wrong_%_%_%', v_active, v_services, v_hours;
  end if;
end $$;

-- A transactional replace may temporarily delete every assignment but must pass
-- when the final state still contains one active matching service.
do $$
declare v_staff uuid;
begin
  select id into v_staff from public.staff where title = 'Ready 0079';
  delete from public.staff_services where staff_id = v_staff;
  insert into public.staff_services (tenant_id, staff_id, service_id) values (
    '79000000-0000-0000-0000-000000000001', v_staff,
    '79000000-0000-0000-0000-000000000031'
  );
  set constraints trg_staff_services_readiness immediate;
end $$;

-- Removing the final service from active staff is rejected at the transaction edge.
do $$
declare v_staff uuid;
begin
  select id into v_staff from public.staff where title = 'Ready 0079';
  delete from public.staff_services where staff_id = v_staff;
  set constraints trg_staff_services_readiness immediate;
  raise exception 'last_service_delete_succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'active_staff_requires_matching_service' then raise; end if;
end $$;

-- Removing every work interval from active staff is likewise rejected.
do $$
declare v_staff uuid;
begin
  select id into v_staff from public.staff where title = 'Ready 0079';
  delete from public.working_hours where staff_id = v_staff;
  set constraints trg_working_hours_readiness immediate;
  raise exception 'last_working_hours_delete_succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'active_staff_requires_working_hours' then raise; end if;
end $$;

-- Deactivating the final linked service cannot silently strand active staff.
do $$
begin
  update public.services set active = false
   where id = '79000000-0000-0000-0000-000000000031';
  set constraints trg_services_staff_readiness immediate;
  raise exception 'last_service_deactivation_succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'active_staff_requires_matching_service' then raise; end if;
end $$;

-- The same empty resource state is valid for a draft.
do $$
declare v_staff uuid;
begin
  select id into v_staff from public.staff where title = 'Draft 0079';
  delete from public.staff_services where staff_id = v_staff;
  delete from public.working_hours where staff_id = v_staff;
  set constraints all immediate;
  if exists (select 1 from public.staff where id = v_staff and active) then
    raise exception 'draft_was_activated';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
