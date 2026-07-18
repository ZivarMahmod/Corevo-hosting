-- ============================================================================
-- RLS CROSS-TENANT LEAK PROOF (G10 step 1, half B — the DoD artifact:
-- "iterera alla tenant-tabeller och bekräfta att cross-tenant-läsning ger 0 rader").
--
-- Generalizes rls_isolation_test.sql (which proved `bookings` only) to EVERY
-- public table that carries a `tenant_id`. Method:
--   1. As postgres, seed a throwaway tenant B + probe rows in the core child
--      tables so the loop has real other-tenant data to (fail to) see.
--   2. Forge a tenant-A `authenticated` JWT (NO platform_admin).
--   3. Dynamically loop over every public table with a tenant_id column and
--      assert `count(* where tenant_id <> private.tenant_id()) = 0`. Any row of a
--      foreign tenant that survives RLS is a leak → hard exception.
--   4. Clean up (tenant B cascades its children) and reset role.
--
-- Run as postgres (privileged). Self-cleaning. Idempotent across reruns.
-- ============================================================================
begin;

do $$
declare
  tenant_a uuid := 'a1000000-0000-0000-0000-0000000000aa';
  tenant_b uuid := 'b0000000-0000-0000-0000-0000000000bb';   -- throwaway probe tenant
  role_a   uuid := 'a1000000-0000-0000-0000-000000000021';
  user_a   uuid := 'a1000000-0000-0000-0000-000000000101';
  loc_b    uuid;
  staff_b  uuid;
  svc_b    uuid;
  t0       timestamptz := (
    date_trunc('week', current_timestamp at time zone 'UTC') + interval '14 days 10 hours'
  ) at time zone 'UTC';
  r        record;
  leak     int;
  probed   int := 0;
  selectable int := 0;
begin
  -- ---- 1. seed tenant B + probes (as postgres, bypasses RLS) ----------------
  insert into public.tenants (id, slug, name) values (tenant_a, 'tenanta_rlsprobe', 'Tenant A (RLS probe)');
  insert into public.tenants (id, slug, name) values (tenant_b, 'tenantb_rlsprobe', 'Tenant B (RLS probe)');
  insert into public.roles (id, tenant_id, name, level)
    values (role_a, tenant_a, 'owner', 6);
  insert into auth.users (id, email)
    values (user_a, 'tenant-a-rls-probe@example.test');
  insert into public.users (id, tenant_id, email, role_id, access_scope, status)
    values (
      user_a, tenant_a, 'tenant-a-rls-probe@example.test',
      role_a, 'organization', 'active'
    );
  insert into public.tenant_settings (tenant_id) values (tenant_b);
  insert into public.tenant_domains (tenant_id, domain) values (tenant_b, 'tenantb-rlsprobe.example');
  insert into public.locations (tenant_id, name, is_primary) values (tenant_b, 'Probe', true) returning id into loc_b;
  insert into public.services (tenant_id, location_id, name, duration_min, price_cents)
    values (tenant_b, loc_b, 'Probe svc', 30, 0) returning id into svc_b;
  insert into public.staff (tenant_id, location_id, title, active)
    values (tenant_b, loc_b, 'Probe', false) returning id into staff_b;
  insert into public.staff_services (tenant_id, staff_id, service_id) values (tenant_b, staff_b, svc_b);
  insert into public.working_hours (
    tenant_id, staff_id, location_id, weekday, start_time, end_time
  ) values (tenant_b, staff_b, loc_b, 1, '09:00', '17:00');
  insert into public.location_opening_hours (
    tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
  ) values (tenant_b, loc_b, 1, '09:00', '17:00', 'confirmed', now());
  update public.staff set active = true where id = staff_b;
  insert into public.time_off (tenant_id, location_id, staff_id, start_ts, end_ts)
    values (tenant_b, loc_b, staff_b, t0 + interval '2 days', t0 + interval '2 days 1 hour');
  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id,
    start_ts, end_ts, status, price_cents
  ) values (tenant_b, loc_b, staff_b, svc_b, t0, t0 + interval '30 min', 'confirmed', 0);
  -- NB: no audit_log probe — it is append-only (the cleanup cascade can't delete
  -- it). The loop still iterates audit_log against the project's existing rows.
  -- payments needs a booking_id; reuse the one just made
  insert into public.payments (tenant_id, booking_id, amount_cents)
    select tenant_b, id, 100 from public.bookings where tenant_id = tenant_b limit 1;

  -- ---- 2. become tenant A (authenticated, NO platform_admin) ----------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated',
      'app_metadata', json_build_object('tenant_id', tenant_a::text))::text, true);

  -- ---- 3. dynamic cross-tenant loop over EVERY tenant_id table --------------
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where ns.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'tenant_id'
      and a.attnum > 0
      and not a.attisdropped
    order by c.relname
  loop
    probed := probed + 1;
    -- An intentionally service-only table is already fail-closed at the GRANT
    -- layer. Query every table the authenticated role can actually select.
    if pg_catalog.has_table_privilege(
      'authenticated', pg_catalog.format('public.%I', r.table_name), 'SELECT'
    ) then
      selectable := selectable + 1;
      execute format(
        'select count(*) from public.%I where tenant_id is not null and tenant_id <> (select private.tenant_id())',
        r.table_name
      ) into leak;
      if leak <> 0 then
        perform set_config('request.jwt.claims', '{}', true);
        reset role;
        raise exception 'RLS LEAK: tenant A sees % foreign-tenant row(s) in public.%', leak, r.table_name;
      end if;
    end if;
  end loop;

  -- ---- 4. cleanup -----------------------------------------------------------
  perform set_config('request.jwt.claims', '{}', true);
  reset role;

  if probed = 0 or selectable = 0 then
    raise exception 'RLS test inconclusive: probed %, selectable %', probed, selectable;
  end if;
  raise notice 'RLS PASS: % tenant-scoped tables iterated, % selectable, 0 cross-tenant rows visible to tenant A', probed, selectable;
end $$;

rollback;
