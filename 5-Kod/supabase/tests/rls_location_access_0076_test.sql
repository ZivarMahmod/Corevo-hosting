-- 0076 runtime-matris: riktig RLS/RPC, inga mocks. All fixturedata rullas tillbaka.
begin;

-- Keep fixture weekdays stable while ensuring booking rows stay in the future.
select set_config(
  'corevo.test_base_monday',
  (
    (date_trunc('week', current_timestamp at time zone 'UTC') + interval '14 days')
    at time zone 'UTC'
  )::text,
  true
);

-- Supabase ger Data API-roller tabellrättigheter via default privileges. Den
-- lokala rena PostgreSQL-verifieringen saknar de plattform-defaultarna, så
-- normalisera dem transaktionellt; RLS avgör fortfarande varje rad.
grant select, insert, update, delete on public.locations, public.services,
  public.staff, public.staff_services, public.working_hours,
  public.working_hour_slots, public.time_off, public.customers,
  public.customer_notes, public.bookings to authenticated;
grant usage on schema extensions to authenticated;
grant execute on function extensions.gen_random_uuid() to authenticated;

insert into public.tenants (id, slug, name) values
  ('00000000-0000-0000-0000-000000000001', 'rls-0076-a', 'RLS 0076 A'),
  ('00000000-0000-0000-0000-000000000002', 'rls-0076-x', 'RLS 0076 X');

insert into public.locations (id, tenant_id, name, is_primary) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'A', true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'B', false),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', 'X', true);

insert into public.roles (id, tenant_id, name, level) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'staff', 3),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'customer', 2),
  ('00000000-0000-0000-0000-000000000024', null, 'platform_admin', 8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000101', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000102', 'admin-a@example.test'),
  ('00000000-0000-0000-0000-000000000103', 'admin-empty@example.test'),
  ('00000000-0000-0000-0000-000000000104', 'staff-a@example.test'),
  ('00000000-0000-0000-0000-000000000105', 'customer@example.test'),
  ('00000000-0000-0000-0000-000000000106', 'platform@example.test');

insert into public.users (id, tenant_id, email, role_id, access_scope) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'owner@example.test', '00000000-0000-0000-0000-000000000021', 'organization'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'admin-a@example.test', '00000000-0000-0000-0000-000000000021', 'locations'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'admin-empty@example.test', '00000000-0000-0000-0000-000000000021', 'locations'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'staff-a@example.test', '00000000-0000-0000-0000-000000000022', 'locations'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'customer@example.test', '00000000-0000-0000-0000-000000000023', 'locations'),
  ('00000000-0000-0000-0000-000000000106', null, 'platform@example.test', '00000000-0000-0000-0000-000000000024', 'organization');

select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.user_location_access (tenant_id, user_id, location_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000011');

insert into public.services (id, tenant_id, location_id, name, duration_min) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', null, 'Global', 30),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'A service', 30),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'B service', 30),
  ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000013', 'X service', 30);

insert into public.staff (id, tenant_id, location_id, profile_id, title) values
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000104', 'Staff A'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', null, 'Staff B'),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000013', null, 'Staff X');
insert into public.staff_services (tenant_id, staff_id, service_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000031'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000032'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000033'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000034');
insert into public.working_hours (tenant_id, staff_id, location_id, weekday, start_time, end_time) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000011', 1, '09:00', '18:00'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000012', 1, '09:00', '18:00'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000013', 1, '09:00', '18:00');

insert into public.location_opening_hours (tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 1, '09:00', '18:00', 'confirmed', now()),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 1, '09:00', '18:00', 'confirmed', now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000013', 1, '09:00', '18:00', 'confirmed', now());
insert into public.location_closures (id, tenant_id, location_id, start_ts, end_ts) values
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', current_setting('corevo.test_base_monday')::timestamptz + interval '28 days 9 hours', current_setting('corevo.test_base_monday')::timestamptz + interval '28 days 10 hours'),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', current_setting('corevo.test_base_monday')::timestamptz + interval '28 days 9 hours', current_setting('corevo.test_base_monday')::timestamptz + interval '28 days 10 hours');

insert into public.customers (id, tenant_id, full_name) values
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000001', 'Customer A'),
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000001', 'Customer B');
insert into public.bookings (id, tenant_id, location_id, staff_id, service_id, customer_id, start_ts, end_ts, status, price_cents) values
  ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000061', current_setting('corevo.test_base_monday')::timestamptz + interval '10 hours', current_setting('corevo.test_base_monday')::timestamptz + interval '10 hours 30 minutes', 'confirmed', 0),
  ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000062', current_setting('corevo.test_base_monday')::timestamptz + interval '10 hours', current_setting('corevo.test_base_monday')::timestamptz + interval '10 hours 30 minutes', 'confirmed', 0);
insert into public.customer_notes (tenant_id, customer_id, location_id, internal_note) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000011', 'A'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000012', 'B');

-- Organisationsägare: level 6 är oförändrad och scope ger A+B, aldrig X.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare n int; begin
  if private.role_level() <> 6 or not private.has_organization_scope() then raise exception 'owner_scope_failed'; end if;
  select count(*) into n from public.locations; if n <> 2 then raise exception 'owner_location_count_%', n; end if;
  select count(*) into n from public.customer_notes; if n <> 2 then raise exception 'owner_note_count_%', n; end if;
end $$;

-- Platsadmin A: endast A och global/A-tjänst. Samma rollnivå, annat scope.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare n int; begin
  if private.role_level() <> 6 or private.has_organization_scope() then raise exception 'location_admin_scope_failed'; end if;
  select count(*) into n from public.locations; if n <> 1 then raise exception 'admin_a_location_count_%', n; end if;
  select count(*) into n from public.services; if n <> 2 then raise exception 'admin_a_service_count_%', n; end if;
  select count(*) into n from public.bookings; if n <> 1 then raise exception 'admin_a_booking_count_%', n; end if;
  select count(*) into n from public.customers; if n <> 1 then raise exception 'admin_a_customer_count_%', n; end if;
  select count(*) into n from public.customer_notes; if n <> 1 then raise exception 'admin_a_note_count_%', n; end if;
  update public.location_closures set reason = 'forbidden' where id = '00000000-0000-0000-0000-000000000052';
  get diagnostics n = row_count; if n <> 0 then raise exception 'admin_a_cross_location_update'; end if;
end $$;
do $$ begin
  begin
    insert into public.user_location_access (tenant_id, user_id, location_id) values
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000012');
    raise exception 'self_grant_succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select public.set_my_primary_location('00000000-0000-0000-0000-000000000011');
do $$ begin
  begin
    perform public.set_my_primary_location('00000000-0000-0000-0000-000000000012');
    raise exception 'cross_location_primary_succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Platsadmin utan medlemskap: noll platsresurser, inklusive global tjänst.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.locations; if n <> 0 then raise exception 'empty_admin_locations_%', n; end if;
  select count(*) into n from public.services; if n <> 0 then raise exception 'empty_admin_services_%', n; end if;
  select count(*) into n from public.bookings; if n <> 0 then raise exception 'empty_admin_bookings_%', n; end if;
  select count(*) into n from public.customers; if n <> 0 then raise exception 'empty_admin_customers_%', n; end if;
  select count(*) into n from public.customer_notes; if n <> 0 then raise exception 'empty_admin_notes_%', n; end if;
end $$;

-- Ägaren kan ge och återkalla B utan JWT-refresh; DB-raden är sanningen.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
insert into public.user_location_access (tenant_id, user_id, location_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000012');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare n int; begin select count(*) into n from public.locations; if n <> 1 then raise exception 'fresh_membership_not_visible_%', n; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
delete from public.user_location_access where user_id='00000000-0000-0000-0000-000000000103' and location_id='00000000-0000-0000-0000-000000000012';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
set local role authenticated;
do $$ declare n int; begin select count(*) into n from public.locations; if n <> 0 then raise exception 'revoked_membership_still_visible_%', n; end if; end $$;

-- En förfalskad platform-claim räcker inte; global roll + claim krävs.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated","app_metadata":{"platform_admin":true}}', true);
set local role authenticated;
do $$ begin if private.is_platform_admin() then raise exception 'forged_platform_claim'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000106","role":"authenticated","app_metadata":{"platform_admin":true}}', true);
set local role authenticated;
do $$ declare n int; begin
  if not private.is_platform_admin() then raise exception 'platform_not_recognized'; end if;
  select count(*) into n from public.locations; if n <> 3 then raise exception 'platform_location_count_%', n; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
rollback;
