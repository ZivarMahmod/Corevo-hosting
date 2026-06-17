-- ============================================================================
-- 0038 — Sajtbyggare S1 (F2): site_content_vertical_defaults
--
-- The BRANSCH (vertical) layer of the override-kaskad Universal → Bransch → Kund.
-- Platform-global REFERENCE data (NOT tenant-scoped): per-vertical default value
-- for a template's editable regions (region_key matches the code-side
-- region-manifest, e.g. 'hero.title' on template 'salvia').
--
--   Universal default = the template/theme default (code: region-manifest).
--   Bransch override   = a row here (this table).            ← NEW in S1
--   Kund override      = the tenant's own settings.copy / branding (unchanged,
--                        existing M2/M6/M7 storage — NOT touched here).
--
-- Provenance is COMPUTED at resolve time (a tenant override → 'modifierad';
-- inherited from Bransch/Universal → 'standard'); nothing provenance-related is
-- stored — this table only holds the Bransch layer's values.
--
-- RLS mirrors the catalog tables (verticals/templates, see 0027): EVERYONE reads
-- (the storefront resolves content as the anon role), only platform-admin writes
-- (private.is_platform_admin(), defined in 0002). This is platform reference
-- data, so it is deliberately NOT scoped by private.tenant_id().
--
-- template_key is plain text (no FK) — mirrors content_slots.template_key (0026):
-- it matches RegionManifest.templateKey / tenant_settings.settings.theme, which
-- is not guaranteed to be a templates.key row.
--
-- IDEMPOTENT: create table/index/trigger + drop policy if exists. Build-once-
-- never-delete; forward-only on prod. Rollback (SAFE-BRANCH ONLY) lives in
-- 0038_site_content_vertical_defaults_rollback.sql.
-- ============================================================================

set search_path = public;

-- ── table ───────────────────────────────────────────────────────────────────
create table if not exists public.site_content_vertical_defaults (
  id           uuid primary key default gen_random_uuid(),
  vertical_id  text not null references public.verticals(key) on delete cascade,
  template_key text not null,                 -- = RegionManifest.templateKey (e.g. 'salvia')
  region_key   text not null,                 -- = Region.key in the manifest (e.g. 'hero.title')
  value        text not null,                 -- the Bransch default (string: copy / hex / url / font)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  unique (vertical_id, template_key, region_key)
);

-- No separate lookup index: the F3 resolver reads by (vertical_id, template_key),
-- which Postgres serves from the leftmost prefix of the unique index above.

-- ── updated_at trigger (public.set_updated_at from 0001; mirror 0026) ──────────
drop trigger if exists trg_site_content_vertical_defaults_updated_at
  on public.site_content_vertical_defaults;
create trigger trg_site_content_vertical_defaults_updated_at
  before update on public.site_content_vertical_defaults
  for each row execute function public.set_updated_at();

-- ── grants + RLS (mirror catalog-table pattern, 0027) ─────────────────────────
-- PostgREST exposes only `public`. anon + authenticated may READ (storefront
-- resolves as anon); only platform-admin may WRITE.
grant select on public.site_content_vertical_defaults to anon, authenticated;
grant insert, update, delete on public.site_content_vertical_defaults to authenticated;

alter table public.site_content_vertical_defaults enable row level security;

drop policy if exists site_content_vertical_defaults_read
  on public.site_content_vertical_defaults;
drop policy if exists site_content_vertical_defaults_admin_write
  on public.site_content_vertical_defaults;

-- Read: everyone (platform-global reference data — NOT tenant-scoped).
create policy site_content_vertical_defaults_read
  on public.site_content_vertical_defaults
  for select to anon, authenticated
  using (true);

-- Write: platform-admin only (no tenant may edit Bransch-level defaults).
create policy site_content_vertical_defaults_admin_write
  on public.site_content_vertical_defaults
  for all to authenticated
  using      ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
