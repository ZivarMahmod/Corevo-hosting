-- 0039_w0_loyalty_key_fix — goal-48 W0
--
-- Bug (verified live 2026-06-26, all 5 verticals): verticals.default_modules uses
-- the key "loyalty", but the module's real key in `modules` is "lojalitet". At
-- onboarding, default_modules is copied into tenant_modules.module_key, so the
-- copied "loyalty" row matches no module → loyalty never activates from default.
--
-- Fix (sanning-doc §7.1): rename the key "loyalty" -> "lojalitet" in every
-- verticals row, PRESERVING its value ("draft"/"off"). No other column touched.
--
-- Safe + corrective + idempotent:
--   * default_modules is read ONLY at tenant creation (copied to tenant_modules);
--     existing tenants already hold their own tenant_modules rows → zero impact.
--   * WHERE ... ? 'loyalty' → re-run is a no-op once renamed.
-- ponytail: no rollback file — reverting would re-introduce the bug.

update public.verticals
set    default_modules = (default_modules - 'loyalty')
                          || jsonb_build_object('lojalitet', default_modules -> 'loyalty')
where  default_modules ? 'loyalty';
