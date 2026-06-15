-- ============================================================================
-- 0027 — Multi-bransch DB-grund · RLS + POLICIES (spår 1)
--
-- Mönster taget ORDAGRANT ur 0002_rls.sql / 0023:
--   tenant-scoped:  using/with check (tenant_id = (select private.tenant_id())
--                                     or (select private.is_platform_admin()))
--   super-admin:    write gated by (select private.is_platform_admin());
--                   service_role bypassar RLS inherent (Postgres) — ingen policy behövs.
--
-- Lager (00-plan-index):
--   verticals / modules / templates        = SUPER-ADMIN WRITE, ALLA LÄSER
--                                             (templates: icke-admin ser bara status='active')
--   template_slots                          = SUPER-ADMIN WRITE, TENANT READ
--   tenant_modules / content_slots / media_assets = TENANT-SCOPED via private.tenant_id()
--
-- Funktionerna private.tenant_id() / private.is_platform_admin() definieras i 0002,
-- search_path-härdade i 0004. Vi återanvänder dem — skapar inga nya helpers.
--
-- IDEMPOTENT: enable row level security är no-op om redan på; varje policy
-- drop:as if exists → create. Säker att köra om. Inget data rörs.
--
-- ROLLBACK: se 0026_0029_multibranch_rollback.sql (avsnitt 0027).
-- ============================================================================

-- ── grants: läs-roller på de nya tabellerna ────────────────────────────────
-- PostgREST exponerar bara public. anon får läsa katalog (verticals/modules/
-- templates) + media_assets för publik storefront-render (RLS gatar raderna).
grant select on public.verticals, public.modules, public.templates,
  public.template_slots, public.media_assets, public.content_slots to anon, authenticated;
grant select, insert, update, delete on
  public.tenant_modules, public.content_slots, public.media_assets,
  public.verticals, public.modules, public.templates, public.template_slots
  to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- A. KATALOG — super-admin write, alla läser
-- ════════════════════════════════════════════════════════════════════════

-- ── verticals ──
alter table public.verticals enable row level security;
drop policy if exists verticals_read       on public.verticals;
drop policy if exists verticals_admin_write on public.verticals;
create policy verticals_read on public.verticals
  for select to anon, authenticated
  using (true);
create policy verticals_admin_write on public.verticals
  for all to authenticated
  using      ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- ── modules ──
alter table public.modules enable row level security;
drop policy if exists modules_read        on public.modules;
drop policy if exists modules_admin_write  on public.modules;
create policy modules_read on public.modules
  for select to anon, authenticated
  using (true);
create policy modules_admin_write on public.modules
  for all to authenticated
  using      ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- ── templates (icke-admin ser bara status='active') ──
alter table public.templates enable row level security;
drop policy if exists templates_read_active on public.templates;
drop policy if exists templates_admin_all   on public.templates;
create policy templates_read_active on public.templates
  for select to anon, authenticated
  using (status = 'active' or (select private.is_platform_admin()));
create policy templates_admin_all on public.templates
  for all to authenticated
  using      ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- ── template_slots (super-admin write, tenant/anon read) ──
alter table public.template_slots enable row level security;
drop policy if exists template_slots_read       on public.template_slots;
drop policy if exists template_slots_admin_write on public.template_slots;
create policy template_slots_read on public.template_slots
  for select to anon, authenticated
  using (true);
create policy template_slots_admin_write on public.template_slots
  for all to authenticated
  using      ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- ════════════════════════════════════════════════════════════════════════
-- B. TENANT-SCOPED — private.tenant_id() + is_platform_admin()-bypass
-- ════════════════════════════════════════════════════════════════════════

-- ── tenant_modules (state-övergångsvakt i 0026 gör off→draft super-admin-only) ──
alter table public.tenant_modules enable row level security;
drop policy if exists tenant_modules_rls on public.tenant_modules;
create policy tenant_modules_rls on public.tenant_modules
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- ── content_slots ──
alter table public.content_slots enable row level security;
drop policy if exists content_slots_rls         on public.content_slots;
drop policy if exists content_slots_public_read on public.content_slots;
create policy content_slots_rls on public.content_slots
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon storefront-render läser slot-innehåll (app-lagret filtrerar tenant_id, jfr 0004-mönstret).
create policy content_slots_public_read on public.content_slots
  for select to anon
  using (true);

-- ── media_assets ──
alter table public.media_assets enable row level security;
drop policy if exists media_assets_rls         on public.media_assets;
drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_rls on public.media_assets
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon storefront läser media-URL:er (publik white-label-sida, jfr 0004).
create policy media_assets_public_read on public.media_assets
  for select to anon
  using (true);
