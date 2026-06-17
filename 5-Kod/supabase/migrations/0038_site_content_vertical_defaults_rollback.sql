-- ============================================================================
-- ROLLBACK — 0038 site_content_vertical_defaults (Sajtbyggare S1, F2)
--
-- ⚠️ DESTRUKTIV. Bryter build-once-never-delete med AVSIKT. ENBART för en SAFE
-- Supabase-branch under utveckling. KÖR ALDRIG mot prod (clylvowtowbtotrahuad) —
-- på prod gäller framåt-only (samma regel som 0026_0029_multibranch_rollback).
--
-- Tar bort allt 0038 skapade, i omvänd beroendeordning (policies/trigger →
-- tabell). IDEMPOTENT: drop ... if exists genomgående. Säker att köra om.
-- ============================================================================

set search_path = public;

drop policy if exists site_content_vertical_defaults_read
  on public.site_content_vertical_defaults;
drop policy if exists site_content_vertical_defaults_admin_write
  on public.site_content_vertical_defaults;

drop trigger if exists trg_site_content_vertical_defaults_updated_at
  on public.site_content_vertical_defaults;

drop index if exists public.site_content_vertical_defaults_lookup_idx;

drop table if exists public.site_content_vertical_defaults cascade;
