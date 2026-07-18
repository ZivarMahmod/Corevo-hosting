-- ============================================================================
-- 0004 — Public-read RLS (anon) for the white-label site (G03 / M2)
--        + security & performance hardening flagged by the Supabase advisors.
--
-- ⚠️ TENANT ISOLATION FOR ANON IS AN APP-LAYER CONCERN.
-- The `anon` role carries NO tenant_id JWT claim. These public-read policies
-- only gate (a) which tables anon may read at all and (b) active-vs-suspended
-- tenants. They do NOT isolate one tenant's rows from another's. Every public
-- query MUST additionally filter `.eq('tenant_id', <resolved tenant>)` in the
-- app (lib/tenant-data.ts). RLS is defense-in-depth here, not the tenant fence.
-- (ADR 01 §2/§4.)
-- ============================================================================

-- ── 1. Pin search_path on the 5 mutable-search_path functions (advisor 0011) ──
-- All 5 reference only fully-qualified objects or pg_catalog built-ins, so an
-- empty search_path is safe and removes the schema-resolution attack surface.
alter function public.set_updated_at()                set search_path = '';
alter function public.block_audit_mutation()          set search_path = '';
alter function public.custom_access_token_hook(jsonb) set search_path = '';
alter function private.tenant_id()                    set search_path = '';
alter function private.is_platform_admin()            set search_path = '';

-- ── 2. Lock down the SECURITY DEFINER helper exposed via PostgREST RPC ──
--      (advisor 0028/0029: anon + authenticated could call /rpc/rls_auto_enable)
-- The helper was created manually by Supabase's RLS advisor on the original
-- project and therefore never existed in a database built only from migrations.
-- Guard the cleanup so both histories converge: revoke it where it exists, and
-- remain a no-op on a clean branch where there is nothing to expose.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from anon, authenticated, public;
  end if;
end
$$;

-- ── 3. Covering indexes for the 4 unindexed foreign keys (advisor 0001) ──
create index if not exists users_role_id_idx             on public.users (role_id);
create index if not exists staff_profile_id_idx          on public.staff (profile_id);
create index if not exists staff_services_service_id_idx on public.staff_services (service_id);
create index if not exists bookings_service_id_idx       on public.bookings (service_id);

-- ── 4. Public-read RLS for anonymous visitors (white-label public site) ──
-- Additive, anon-only, SELECT-only. The existing *_rls policies (authenticated)
-- are untouched. Different role → no multiple_permissive_policies warning.

-- tenants: anon reads active tenant rows (resolve slug → identity/branding).
create policy tenants_public_read on public.tenants
  for select to anon
  using (status = 'active');

-- tenant_settings: anon reads settings of an active tenant. NOTE: this extends
-- the step-1 list (tenants + services) — the 3-level theme engine (branding /
-- layout / custom_override) lives in tenant_settings and is read via anon.
create policy tenant_settings_public_read on public.tenant_settings
  for select to anon
  using (exists (
    select 1 from public.tenants t
    where t.id = tenant_settings.tenant_id and t.status = 'active'
  ));

-- services: anon reads ACTIVE services of an active tenant.
create policy services_public_read on public.services
  for select to anon
  using (active = true and exists (
    select 1 from public.tenants t
    where t.id = services.tenant_id and t.status = 'active'
  ));

-- ── NOT handled here (out of scope / not SQL) ──
-- · auth_leaked_password_protection — Auth (GoTrue) config, NOT a SQL migration.
--   Enable manually: Dashboard → Authentication → Sign In / Providers →
--   "Leaked password protection" (HIBP). Same manual-toggle pattern as the
--   0003 Custom Access Token Hook.
-- · extension_in_public (btree_gist) — backs the no_double_booking EXCLUDE
--   constraint on bookings; relocating it risks the constraint. Left in place.
-- · multiple_permissive_policies on public.roles / unused_index — pre-existing,
--   not in G03 scope.
