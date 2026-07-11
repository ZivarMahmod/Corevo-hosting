-- goal-57 körning 12: bransch-mall-text. Zivar äger en editorial copy-mall per
-- bransch (verticals.default_copy, samma fältkontrakt som settings.copy/CopyOverride).
-- Upplösningskedja publikt: kundens settings.copy → branschens default_copy → temats
-- THEME_CONTENT (kod). anon läser redan verticals (0027) så storefronten når den.
alter table public.verticals
  add column if not exists default_copy jsonb not null default '{}'::jsonb;
