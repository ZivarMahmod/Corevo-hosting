-- ============================================================================
-- RLS isolation proof. Run as a privileged role (postgres) — it sets the role
-- to `authenticated` and forges request.jwt.claims to simulate each tenant.
-- Asserts BOTH directions with row-count checks (a passing 0/0 would be a false
-- pass; we require own-tenant > 0 AND cross-tenant = 0).
-- Self-cleans (temp tenant B + test bookings are removed at the end).
-- ============================================================================
do $$
declare
  tenant_a uuid := '11111111-1111-1111-1111-111111111111';   -- seeded frisor1
  staff_a  uuid := '44444444-0000-0000-0000-000000000001';
  svc_a    uuid := '55555555-0000-0000-0000-000000000001';
  tenant_b uuid := 'b0000000-0000-0000-0000-0000000000bb';
  staff_b  uuid;
  svc_b    uuid;
  book_a   uuid;
  book_b   uuid;
  a_sees_a int; a_sees_b int; b_sees_b int; b_sees_a int;
begin
  -- ---- setup (as postgres, bypasses RLS) ----
  insert into public.tenants (id, slug, name) values (tenant_b, 'tenantb_test', 'Tenant B (test)');
  insert into public.staff (tenant_id, title) values (tenant_b, 'Test') returning id into staff_b;
  insert into public.services (tenant_id, name, duration_min) values (tenant_b, 'Test svc', 30) returning id into svc_b;

  insert into public.bookings (tenant_id, staff_id, service_id, start_ts, end_ts, status)
    values (tenant_a, staff_a, svc_a, now() + interval '1 day', now() + interval '1 day 30 min', 'confirmed')
    returning id into book_a;
  insert into public.bookings (tenant_id, staff_id, service_id, start_ts, end_ts, status)
    values (tenant_b, staff_b, svc_b, now() + interval '1 day', now() + interval '1 day 30 min', 'confirmed')
    returning id into book_b;

  -- ---- as tenant A ----
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated',
      'app_metadata', json_build_object('tenant_id', tenant_a::text))::text, true);
  select count(*) into a_sees_a from public.bookings where tenant_id = tenant_a;
  select count(*) into a_sees_b from public.bookings where tenant_id = tenant_b;

  -- ---- as tenant B ----
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated',
      'app_metadata', json_build_object('tenant_id', tenant_b::text))::text, true);
  select count(*) into b_sees_b from public.bookings where tenant_id = tenant_b;
  select count(*) into b_sees_a from public.bookings where tenant_id = tenant_a;

  -- ---- back to postgres + cleanup ----
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.bookings where id in (book_a, book_b);
  delete from public.tenants where id = tenant_b;   -- cascades staff/services

  raise notice 'a_sees_a=%  a_sees_b=%  b_sees_b=%  b_sees_a=%', a_sees_a, a_sees_b, b_sees_b, b_sees_a;
  if a_sees_b <> 0 or b_sees_a <> 0 then
    raise exception 'RLS FAIL: cross-tenant leak (a_sees_b=%, b_sees_a=%)', a_sees_b, b_sees_a;
  end if;
  if a_sees_a = 0 or b_sees_b = 0 then
    raise exception 'RLS FAIL: own-tenant rows hidden (a_sees_a=%, b_sees_b=%)', a_sees_a, b_sees_b;
  end if;
  raise notice 'RLS PASS: tenant A sees % own / % of B; tenant B sees % own / % of A', a_sees_a, a_sees_b, b_sees_b, b_sees_a;
end $$;
