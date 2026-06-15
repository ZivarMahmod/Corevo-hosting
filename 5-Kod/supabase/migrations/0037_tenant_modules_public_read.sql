-- 0037_tenant_modules_public_read.sql
-- Multi-bransch fix (Körning 16): anon public-read for tenant_modules.
--
-- WHY: the storefront resolves a tenant's module lifecycle via the ANON public
-- client — getTenantModuleStates() (lib/tenant-modules.ts), loadShopData()
-- (lib/storefront/shop/load-shop.ts) and loadOffertData()
-- (lib/storefront/offert/load-offert.ts) all run `createPublicClient()` (role
-- `anon`) and filter tenant_id in the app layer. EVERY other storefront-read table
-- already has an anon public-read policy (services, tenant_settings, working_hours,
-- content_slots, media_assets, shop_products, blog_posts, templates, template_slots,
-- verticals, modules). tenant_modules was the LONE storefront-read table WITHOUT one
-- (only `tenant_modules_rls` for `authenticated` existed). Result: a real anonymous
-- visitor read 0 rows -> getTenantModuleStates() returned {} -> moduleState() fell
-- back to defaults (booking:live, everything else off) -> the shop / offert / blogg /
-- lojalitet / presentkort sections NEVER rendered publicly even when set `live`.
-- This silently nullified the K6-K15 storefront-module work for public visitors.
--
-- SCOPE (defense-in-depth, mirrors services_public_read / tenant_settings_public_read):
--   * role `anon` only (matches the established storefront anon-read pattern; the
--     authenticated tenant-scoped policy `tenant_modules_rls` + private.tenant_id()
--     isolation are UNTOUCHED).
--   * only rows of an ACTIVE tenant (status='active') -> deleted/suspended tenants
--     never leak module rows.
--   * only PUBLIC states (live/paused) -> off/draft module existence + their config
--     are never exposed to anon; the storefront only renders live/paused anyway.
-- config carries no secrets by design (the offert/shop payment hook is a parked
-- provider=null / enabled=false stub; no keys live in tenant_modules.config).
--
-- ADDITIVE + idempotent (drop-if-exists -> create). Build-once-never-delete: nothing
-- is dropped or altered besides re-creating this one new policy. SAFE to re-run.

set search_path = public;

drop policy if exists tenant_modules_public_read on public.tenant_modules;

create policy tenant_modules_public_read
  on public.tenant_modules
  for select
  to anon
  using (
    state in ('live', 'paused')
    and exists (
      select 1
      from public.tenants t
      where t.id = tenant_modules.tenant_id
        and t.status = 'active'
    )
  );
