-- 0078 runtime: hardening invariants against real roles, triggers and RPCs.
-- Everything is rolled back.
begin;

-- One transaction-stable future instant keeps the runtime checks from expiring.
select set_config(
  'corevo.test_base_utc',
  (
    (date_trunc('day', current_timestamp at time zone 'UTC') + interval '14 days')
    at time zone 'UTC'
  )::text,
  true
);

grant select, insert, update, delete on public.locations, public.services,
  public.staff, public.staff_services, public.working_hours,
  public.customers, public.bookings, public.user_location_access,
  public.location_opening_hours to authenticated;
revoke insert, update, delete on public.location_opening_hours, public.time_off
  from authenticated;
grant usage on schema extensions to authenticated;
grant execute on function extensions.gen_random_uuid() to authenticated;

select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.tenants (id, slug, name) values
  ('78000000-0000-0000-0000-000000000001', 'hardening-0078', 'Hardening 0078');
insert into public.locations (id, tenant_id, name, timezone, is_primary) values
  ('78000000-0000-0000-0000-000000000011', '78000000-0000-0000-0000-000000000001', 'A', 'Europe/Stockholm', true),
  ('78000000-0000-0000-0000-000000000012', '78000000-0000-0000-0000-000000000001', 'B', 'Europe/Stockholm', false);
insert into public.roles (id, tenant_id, name, level) values
  ('78000000-0000-0000-0000-000000000021', '78000000-0000-0000-0000-000000000001', 'owner', 6),
  ('78000000-0000-0000-0000-000000000022', '78000000-0000-0000-0000-000000000001', 'staff', 3);
insert into auth.users (id, email) values
  ('78000000-0000-0000-0000-000000000101', 'owner-0078@example.test'),
  ('78000000-0000-0000-0000-000000000102', 'admin-a-0078@example.test'),
  ('78000000-0000-0000-0000-000000000103', 'staff-0078@example.test');
insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('78000000-0000-0000-0000-000000000101', '78000000-0000-0000-0000-000000000001', 'owner-0078@example.test', '78000000-0000-0000-0000-000000000021', 'organization', 'active'),
  ('78000000-0000-0000-0000-000000000102', '78000000-0000-0000-0000-000000000001', 'admin-a-0078@example.test', '78000000-0000-0000-0000-000000000021', 'locations', 'active'),
  ('78000000-0000-0000-0000-000000000103', '78000000-0000-0000-0000-000000000001', 'staff-0078@example.test', '78000000-0000-0000-0000-000000000022', 'locations', 'inactive');
insert into public.user_location_access (tenant_id, user_id, location_id) values
  ('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000102', '78000000-0000-0000-0000-000000000011');

insert into public.services (id, tenant_id, location_id, name, duration_min) values
  ('78000000-0000-0000-0000-000000000031', '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000011', 'A service', 30),
  ('78000000-0000-0000-0000-000000000032', '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000012', 'B service', 30);
insert into public.staff (id, tenant_id, location_id, profile_id, title, active) values
  ('78000000-0000-0000-0000-000000000041', '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000011', '78000000-0000-0000-0000-000000000103', 'Ready staff', false),
  ('78000000-0000-0000-0000-000000000042', '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000012', null, 'B staff', false),
  ('78000000-0000-0000-0000-000000000043', '78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000011', null, 'Draft staff', false);

insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '78000000-0000-0000-0000-000000000001',
       '78000000-0000-0000-0000-000000000011', d, '09:00', '18:00', 'confirmed', now()
  from generate_series(0, 6) d;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '78000000-0000-0000-0000-000000000001',
       '78000000-0000-0000-0000-000000000012', d, '09:00', '18:00', 'confirmed', now()
  from generate_series(0, 6) d;
insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000041', '78000000-0000-0000-0000-000000000031'),
  ('78000000-0000-0000-0000-000000000001', '78000000-0000-0000-0000-000000000042', '78000000-0000-0000-0000-000000000032');
insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time)
select '78000000-0000-0000-0000-000000000001',
       '78000000-0000-0000-0000-000000000041',
       '78000000-0000-0000-0000-000000000011', d, '09:00', '18:00'
  from generate_series(0, 6) d;
insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time)
select '78000000-0000-0000-0000-000000000001',
       '78000000-0000-0000-0000-000000000042',
       '78000000-0000-0000-0000-000000000012', d, '09:00', '18:00'
  from generate_series(0, 6) d;

-- Location admin A may not read raw busy data for staff at B.
reset role;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"78000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  perform public.get_busy_intervals(
    '78000000-0000-0000-0000-000000000001',
    array['78000000-0000-0000-0000-000000000042'::uuid],
    current_setting('corevo.test_base_utc')::timestamptz,
    current_setting('corevo.test_base_utc')::timestamptz + interval '1 day'
  );
  raise exception 'cross_location_busy_read_succeeded';
exception when insufficient_privilege then null; end $$;

-- Draft staff cannot be activated through direct DML either.
do $$ begin
  update public.staff set active = true
   where id = '78000000-0000-0000-0000-000000000043';
  raise exception 'draft_staff_activated';
exception when raise_exception then
  if sqlerrm = 'draft_staff_activated' then raise; end if;
end $$;

-- Empty location schedules and direct opening-hours writes are rejected.
do $$ begin
  perform public.save_location_booking_settings(
    '78000000-0000-0000-0000-000000000011', '[]'::jsonb, 15, 0, 365
  );
  raise exception 'empty_location_schedule_saved';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  delete from public.location_opening_hours
   where location_id = '78000000-0000-0000-0000-000000000011';
  raise exception 'direct_location_hours_delete_succeeded';
exception when insufficient_privilege then null; end $$;

-- Ready activation succeeds and synchronizes the linked staff account.
update public.staff set active = true
 where id = '78000000-0000-0000-0000-000000000041';
reset role;
do $$ declare v_status text; begin
  select status into v_status from public.users
   where id = '78000000-0000-0000-0000-000000000103';
  if v_status <> 'active' then raise exception 'staff_account_not_activated_%', v_status; end if;
end $$;

-- Authenticated admin DML cannot re-bind a customer to the admin's account.
select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.customers (id, tenant_id, full_name) values
  ('78000000-0000-0000-0000-000000000061', '78000000-0000-0000-0000-000000000001', 'Customer');
reset role;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"78000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  update public.customers
     set auth_user_id = '78000000-0000-0000-0000-000000000101'
   where id = '78000000-0000-0000-0000-000000000061';
  raise exception 'customer_auth_binding_changed';
exception when insufficient_privilege then null; end $$;

-- Public requests are rejected before a >1000 pair multiplication is run.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  perform public.get_public_bookable_starts(
    '78000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000011',
    '78000000-0000-0000-0000-000000000031',
    array[
      '78000000-0000-0000-0000-000000000041'::uuid,
      '78000000-0000-0000-0000-000000000042'::uuid,
      '78000000-0000-0000-0000-000000000043'::uuid
    ],
    array_fill(
      current_setting('corevo.test_base_utc')::timestamptz + interval '9 hours',
      array[400]
    )
  );
  raise exception 'public_pair_cap_missing';
exception when invalid_parameter_value then null; end $$;

-- Staff mutations use the audited self-service RPC; direct DML is closed.
reset role;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"78000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ begin
  insert into public.time_off (
    tenant_id, location_id, staff_id, start_ts, end_ts, kind
  ) values (
    '78000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000011',
    '78000000-0000-0000-0000-000000000041',
    current_setting('corevo.test_base_utc')::timestamptz + interval '150 days 9 hours',
    current_setting('corevo.test_base_utc')::timestamptz + interval '150 days 10 hours',
    'other'
  );
  raise exception 'direct_time_off_insert_succeeded';
exception when insufficient_privilege then null; end $$;
do $$ declare v_id uuid; begin
  v_id := public.create_my_time_off(
    '78000000-0000-0000-0000-000000000041',
    '78000000-0000-0000-0000-000000000011',
    current_setting('corevo.test_base_utc')::timestamptz + interval '150 days 9 hours',
    current_setting('corevo.test_base_utc')::timestamptz + interval '150 days 10 hours',
    'Egen frånvaro'
  );
  if not public.delete_my_time_off(v_id) then raise exception 'self_time_off_delete_failed'; end if;
end $$;

-- Build 101 distinct affected bookings and prove neither queue truncates them.
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
)
select extensions.gen_random_uuid(),
       '78000000-0000-0000-0000-000000000001',
       '78000000-0000-0000-0000-000000000011',
       '78000000-0000-0000-0000-000000000041',
       '78000000-0000-0000-0000-000000000031',
       '78000000-0000-0000-0000-000000000061',
       (current_setting('corevo.test_base_utc')::timestamptz
         + interval '10 hours' + make_interval(days => g)),
       (current_setting('corevo.test_base_utc')::timestamptz
         + interval '10 hours 30 minutes' + make_interval(days => g)),
       'confirmed', 0
  from generate_series(0, 100) g;

reset role;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"78000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"78000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$
declare
  v_preview int;
  v_queue int;
  v_time_off uuid;
  v_booking uuid;
  v_booking_start timestamptz;
begin
  select count(*) into v_preview
    from public.preview_admin_time_off_impacts(
      '78000000-0000-0000-0000-000000000011',
      '78000000-0000-0000-0000-000000000041',
      current_setting('corevo.test_base_utc')::timestamptz,
      current_setting('corevo.test_base_utc')::timestamptz + interval '120 days'
    );
  if v_preview <> 101 then raise exception 'preview_queue_truncated_%', v_preview; end if;

  v_time_off := public.create_admin_time_off(
    '78000000-0000-0000-0000-000000000011',
    '78000000-0000-0000-0000-000000000041',
    current_setting('corevo.test_base_utc')::timestamptz,
    current_setting('corevo.test_base_utc')::timestamptz + interval '120 days',
    'leave', 'Test'
  );
  select count(*) into v_queue from public.get_admin_time_off_impacts(v_time_off);
  if v_queue <> 101 then raise exception 'absence_queue_truncated_%', v_queue; end if;

  select b.id, b.start_ts into v_booking, v_booking_start
    from public.bookings b
   where b.tenant_id = '78000000-0000-0000-0000-000000000001'
     and b.staff_id = '78000000-0000-0000-0000-000000000041'
   order by b.start_ts
   limit 1;
  perform public.reschedule_admin_absence_booking(
    v_time_off,
    v_booking,
    '78000000-0000-0000-0000-000000000011',
    '78000000-0000-0000-0000-000000000041',
    '78000000-0000-0000-0000-000000000031',
    current_setting('corevo.test_base_utc')::timestamptz + interval '130 days 10 hours',
    v_booking_start,
    '78000000-0000-0000-0000-000000000041'
  );
end $$;

reset role;
do $$ begin
  if not exists (
    select 1 from public.audit_log a
     where a.tenant_id = '78000000-0000-0000-0000-000000000001'
       and a.action = 'absence.booking_handled'
       and a.meta ->> 'resolution' = 'rescheduled'
  ) then raise exception 'absence_reschedule_audit_missing'; end if;
end $$;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
