-- ============================================================================
-- RLS COVERAGE (G10 step 1, half A — "ingen tabell utan RLS").
-- Metadata audit: every BASE TABLE in `public` MUST have row level security
-- ENABLED *and* at least one policy. A table with RLS on but zero policies is a
-- silent deny-all (looks safe, breaks the app) — we flag that too.
--
-- Read-only. Run as any role with catalog access (postgres). Pairs with
-- rls_cross_tenant_test.sql (half B = the actual cross-tenant leak proof).
-- ============================================================================
do $$
declare
  r record;
  missing_rls text[] := '{}';
  missing_pol text[] := '{}';
  n_tables    int := 0;
begin
  for r in
    select c.relname                                   as table_name,
           c.relrowsecurity                             as rls_on,
           (select count(*) from pg_policy p where p.polrelid = c.oid) as n_policies
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind = 'r'                              -- ordinary tables only
    order by c.relname
  loop
    n_tables := n_tables + 1;
    if not r.rls_on then
      missing_rls := missing_rls || r.table_name;
    elsif r.n_policies = 0 then
      missing_pol := missing_pol || r.table_name;
    end if;
  end loop;

  raise notice 'RLS coverage: audited % public tables', n_tables;

  if array_length(missing_rls, 1) is not null then
    raise exception 'RLS FAIL: tables without RLS enabled: %', missing_rls;
  end if;
  if array_length(missing_pol, 1) is not null then
    raise exception 'RLS FAIL: RLS enabled but NO policy (deny-all): %', missing_pol;
  end if;

  raise notice 'RLS PASS: all % public tables have RLS enabled + >=1 policy', n_tables;
end $$;
