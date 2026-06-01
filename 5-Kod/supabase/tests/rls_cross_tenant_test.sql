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
do $$
declare
  tenant_a uuid := '11111111-1111-1111-1111-111111111111';   -- seeded frisor1
  tenant_b uuid := 'b0000000-0000-0000-0000-0000000000bb';   -- throwaway probe tenant
  loc_b    uuid;
  staff_b  uuid;
  svc_b    uuid;
  r        record;
  leak     int;
  probed   int := 0;
begin
  -- ---- 1. seed tenant B + probes (as postgres, bypasses RLS) ----------------
  insert into public.tenants (id, slug, name) values (tenant_b, 'tenantb_rlsprobe', 'Tenant B (RLS probe)');
  insert into public.tenant_settings (tenant_id) values (tenant_b);
  insert into public.tenant_domains (tenant_id, domain) values (tenant_b, 'tenantb-rlsprobe.example');
  insert into public.locations (tenant_id, name, is_primary) values (tenant_b, 'Probe', true) returning id into loc_b;
  insert into public.staff (tenant_id, title) values (tenant_b, 'Probe') returning id into staff_b;
  insert into public.services (tenant_id, name, duration_min) values (tenant_b, 'Probe svc', 30) returning id into svc_b;
  insert into public.staff_services (tenant_id, staff_id, service_id) values (tenant_b, staff_b, svc_b);
  insert into public.working_hours (tenant_id, staff_id, weekday, start_time, end_time)
    values (tenant_b, staff_b, 1, '09:00', '17:00');
  insert into public.time_off (tenant_id, staff_id, start_ts, end_ts)
    values (tenant_b, staff_b, now() + interval '2 day', now() + interval '2 day 1 hour');
  insert into public.bookings (tenant_id, location_id, staff_id, service_id, start_ts, end_ts, status)
    values (tenant_b, loc_b, staff_b, svc_b, now() + interval '1 day', now() + interval '1 day 30 min', 'confirmed');
  -- NB: no audit_log probe — it is append-only (the cleanup cascade can't delete
  -- it). The loop still iterates audit_log against the project's existing rows.
  -- payments needs a booking_id; reuse the one just made
  insert into public.payments (tenant_id, booking_id, amount_cents)
    select tenant_b, id, 100 from public.bookings where tenant_id = tenant_b limit 1;

  -- ---- 2. become tenant A (authenticated, NO platform_admin) ----------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated',
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
    execute format(
      'select count(*) from public.%I where tenant_id is not null and tenant_id <> (select private.tenant_id())',
      r.table_name
    ) into leak;
    probed := probed + 1;
    if leak <> 0 then
      perform set_config('request.jwt.claims', '', true);
      reset role;
      raise exception 'RLS LEAK: tenant A sees % foreign-tenant row(s) in public.%', leak, r.table_name;
    end if;
  end loop;

  -- ---- 4. cleanup -----------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  reset role;
  delete from public.tenants where id = tenant_b;   -- cascades all probe children

  if probed = 0 then
    raise exception 'RLS test inconclusive: no tenant_id tables were probed';
  end if;
  raise notice 'RLS PASS: % tenant-scoped tables iterated, 0 cross-tenant rows visible to tenant A', probed;
end $$;
