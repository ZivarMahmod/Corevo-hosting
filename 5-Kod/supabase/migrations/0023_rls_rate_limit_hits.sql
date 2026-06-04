-- 0023 — RLS on private.rate_limit_hits (WORKFLOW-04 goal-18; Supabase advisor: critical RLS-off).
--
-- The table exists in the live DB but NOT in the migration history (it was created
-- outside the migration flow). It backs the check_rate_limit RPC (migration 0008).
-- Columns verified live: bucket text, window_start timestamptz, hits int. Owner = postgres.
--
-- SAFETY — no lockout (Zivar's only concern): the SOLE writer is the
-- check_rate_limit(p_key, p_max, p_window_secs) RPC, which is SECURITY DEFINER owned
-- by postgres → it BYPASSES RLS entirely. The table lives in the `private` schema
-- (not exposed via PostgREST to anon/authenticated). So enabling RLS closes the
-- advisor flag WITHOUT breaking the limiter. We add ONE read policy for platform_admin
-- (a future drift/ops UI); no anon/authenticated policy = no direct client access.
--
-- Idempotent: `enable row level security` is a no-op when already on; the policy is
-- dropped + recreated. Non-destructive — no data is touched, only the RLS flag + a policy.
--
-- ROLLBACK:
--   alter table private.rate_limit_hits disable row level security;
--   drop policy if exists rate_limit_hits_platform_read on private.rate_limit_hits;

alter table private.rate_limit_hits enable row level security;

drop policy if exists rate_limit_hits_platform_read on private.rate_limit_hits;
create policy rate_limit_hits_platform_read
  on private.rate_limit_hits
  for select
  using (private.is_platform_admin());
