-- ============================================================================
-- RLS isolation proof. Run as a privileged role (postgres) — it sets the role
-- to `authenticated` and forges request.jwt.claims to simulate each tenant.
-- Asserts BOTH directions with row-count checks (a passing 0/0 would be a false
-- pass; we require own-tenant > 0 AND cross-tenant = 0).
-- Self-cleans (temp tenant B + test bookings are removed at the end).
-- ============================================================================
begin;

do $$
declare
  tenant_a uuid := 'a2000000-0000-0000-0000-0000000000aa';
  tenant_b uuid := 'b2000000-0000-0000-0000-0000000000bb';
  loc_a    uuid := 'a2000000-0000-0000-0000-000000000011';
  loc_b    uuid := 'b2000000-0000-0000-0000-000000000011';
  role_a   uuid := 'a2000000-0000-0000-0000-000000000021';
  role_b   uuid := 'b2000000-0000-0000-0000-000000000021';
  user_a   uuid := 'a2000000-0000-0000-0000-000000000101';
  user_b   uuid := 'b2000000-0000-0000-0000-000000000101';
  staff_a  uuid := 'a2000000-0000-0000-0000-000000000041';
  staff_b  uuid := 'b2000000-0000-0000-0000-000000000041';
  svc_a    uuid := 'a2000000-0000-0000-0000-000000000051';
  svc_b    uuid := 'b2000000-0000-0000-0000-000000000051';
  book_a   uuid;
  book_b   uuid;
  t0       timestamptz := (
    date_trunc('week', current_timestamp at time zone 'UTC') + interval '14 days 10 hours'
  ) at time zone 'UTC';
  a_sees_a int; a_sees_b int; b_sees_b int; b_sees_a int;
begin
  -- ---- setup (as postgres, bypasses RLS) ----
  insert into public.tenants (id, slug, name) values
    (tenant_a, 'tenanta_isolation_test', 'Tenant A (isolation test)'),
    (tenant_b, 'tenantb_isolation_test', 'Tenant B (isolation test)');
  insert into public.locations (id, tenant_id, name, timezone, is_primary) values
    (loc_a, tenant_a, 'A', 'Europe/Stockholm', true),
    (loc_b, tenant_b, 'B', 'Europe/Stockholm', true);
  insert into public.roles (id, tenant_id, name, level) values
    (role_a, tenant_a, 'owner', 6),
    (role_b, tenant_b, 'owner', 6);
  insert into auth.users (id, email) values
    (user_a, 'tenant-a-isolation@example.test'),
    (user_b, 'tenant-b-isolation@example.test');
  insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
    (user_a, tenant_a, 'tenant-a-isolation@example.test', role_a, 'organization', 'active'),
    (user_b, tenant_b, 'tenant-b-isolation@example.test', role_b, 'organization', 'active');
  insert into public.services (
    id, tenant_id, location_id, name, duration_min, price_cents, active
  ) values
    (svc_a, tenant_a, loc_a, 'A service', 30, 0, true),
    (svc_b, tenant_b, loc_b, 'B service', 30, 0, true);
  insert into public.staff (id, tenant_id, location_id, title, active) values
    (staff_a, tenant_a, loc_a, 'A staff', false),
    (staff_b, tenant_b, loc_b, 'B staff', false);
  insert into public.staff_services (tenant_id, staff_id, service_id) values
    (tenant_a, staff_a, svc_a),
    (tenant_b, staff_b, svc_b);
  insert into public.working_hours (
    tenant_id, staff_id, location_id, weekday, start_time, end_time
  ) values
    (tenant_a, staff_a, loc_a, 1, '09:00', '18:00'),
    (tenant_b, staff_b, loc_b, 1, '09:00', '18:00');
  insert into public.location_opening_hours (
    tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
  ) values
    (tenant_a, loc_a, 1, '09:00', '18:00', 'confirmed', now()),
    (tenant_b, loc_b, 1, '09:00', '18:00', 'confirmed', now());
  update public.staff set active = true where id in (staff_a, staff_b);

  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id,
    start_ts, end_ts, status, price_cents
  ) values (tenant_a, loc_a, staff_a, svc_a, t0, t0 + interval '30 min', 'confirmed', 0)
    returning id into book_a;
  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id,
    start_ts, end_ts, status, price_cents
  ) values (tenant_b, loc_b, staff_b, svc_b, t0, t0 + interval '30 min', 'confirmed', 0)
    returning id into book_b;

  -- ---- as tenant A ----
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated',
      'app_metadata', json_build_object('tenant_id', tenant_a::text))::text, true);
  select count(*) into a_sees_a from public.bookings where tenant_id = tenant_a;
  select count(*) into a_sees_b from public.bookings where tenant_id = tenant_b;

  -- ---- as tenant B ----
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated',
      'app_metadata', json_build_object('tenant_id', tenant_b::text))::text, true);
  select count(*) into b_sees_b from public.bookings where tenant_id = tenant_b;
  select count(*) into b_sees_a from public.bookings where tenant_id = tenant_a;

  -- ---- back to postgres + cleanup ----
  reset role;
  perform set_config('request.jwt.claims', '{}', true);

  raise notice 'a_sees_a=%  a_sees_b=%  b_sees_b=%  b_sees_a=%', a_sees_a, a_sees_b, b_sees_b, b_sees_a;
  if a_sees_b <> 0 or b_sees_a <> 0 then
    raise exception 'RLS FAIL: cross-tenant leak (a_sees_b=%, b_sees_a=%)', a_sees_b, b_sees_a;
  end if;
  if a_sees_a = 0 or b_sees_b = 0 then
    raise exception 'RLS FAIL: own-tenant rows hidden (a_sees_a=%, b_sees_b=%)', a_sees_a, b_sees_b;
  end if;
  raise notice 'RLS PASS: tenant A sees % own / % of B; tenant B sees % own / % of A', a_sees_a, a_sees_b, b_sees_b, b_sees_a;
end $$;

rollback;
