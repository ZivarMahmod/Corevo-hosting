-- ============================================================================
-- 0035 — Lojalitet-modul · REGISTER-ONLY (multi-bransch spår 5)
--
-- Registrerar EN modul `lojalitet` i public.modules — EN modul med VARIANTER
-- (config, ej fork), EXAKT samma mönster som webshop- (0031/0032), offert- (0033)
-- och blogg-modulen (0034) per LÅST beslut 14.5 (CONFIG-FIRST) + §15 (skelett vs
-- skin): presentations-skillnader = varianter inuti modulen, aldrig `if (bransch)`
-- i motorn. Branschens preset väljer default-variant.
--
-- ⚠ INGEN TABELL SKAPAS HÄR (till skillnad från 0032/0033/0034). Tabellen
-- `public.loyalty_ledger` FINNS REDAN (skapad i migration 0016 med egen RLS:
-- kolumner id, tenant_id, customer_id, booking_id, points_delta, reason, note,
-- created_at; SELECT-only). Den RÖRS INTE av denna migration: ingen create table,
-- ingen alter table, ingen RLS-ändring. 0035 gör BARA register-arbetet +
-- pekar owns_tables på den befintliga tabellen så plattformen vet att modulen
-- äger den (gatad av tenant_modules.state). build-once-never-delete.
--
-- VARIANTER (variant_schema.variant.enum) — hur lojalitets-programmet presenteras:
--   'points'     — visa poäng-program (default; tjäna poäng per besök).
--   'stamp_card' — stämpelkort (samla stämplar mot ett mål).
--
-- INGEN BETAL-HOOK (till skillnad från shop/offert): poäng rör INGA direkta
-- pengar — det finns ingen rad, inget belopp och ingen provider att koppla.
-- Den publika ytan är ren promo (headline + förmånstext + variant-visning).
-- Compliance: rör inga pengar → trivialt.
--
-- LIVSCYKEL (§4): modulen seedas INTE per tenant här. lojalitet = opt-in;
-- super-admin flippar off→draft per kund (state-vakten i 0026 §9 kräver
-- platform_admin för off→draft). Storefronten gatear på tenant_modules.state
-- ='live' (EXAKT som booking + shop + offert + blogg).
--
-- owns_tables = den befintliga tabellen modulen äger (loyalty_ledger, 0016).
-- default_section_position = var modulens fallback-sektion injiceras i storefront
-- — 'main', som booking/shop/offert/blogg, så skinnet kan placera promo-sektionen.
--
-- IDEMPOTENT: insert ... on conflict (key) do update (register). Build-once-never-
-- delete (inget droppas). Säker att köra om.
--
-- ⚠ APPLICERA INTE automatiskt mot prod. Granska → kör manuellt när godkänd.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════
-- 1. REGISTER — EN modul `lojalitet` i public.modules (varianter via config)
--    Ingen tabell skapas: loyalty_ledger finns redan (0016) och rörs inte.
-- ════════════════════════════════════════════════════════════════════════
insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'lojalitet',
  'Lojalitet',
  -- Tabell modulen äger — FINNS REDAN (0016). Skapas/altras INTE här. Gatad av
  -- tenant_modules.state precis som blog_posts/shop_products gatas av sina moduler.
  '["loyalty_ledger"]'::jsonb,
  -- variant_schema: deklarerar lojalitets-varianterna (presentation = data). Super-
  -- admin/onboarding läser detta för att visa val; storefronten läser
  -- tenant_modules.config.variant för att veta hur promo-sektionen ska renderas.
  '{
    "variant": {
      "type": "enum",
      "enum": ["points", "stamp_card"],
      "default": "points",
      "labels": {
        "points": "Poäng",
        "stamp_card": "Stämpelkort"
      },
      "params": {
        "points_per_visit": { "type": "int", "default": 50, "min": 1 },
        "stamp_goal": { "type": "int", "default": 10, "min": 2 }
      }
    }
  }'::jsonb,
  -- default_config: vald variant + dess parametrar + promo-copy. INGEN betal-hook
  -- (poäng rör inga pengar, till skillnad från shop/offert). Sätts vid aktivering
  -- (off→draft); branschens preset kan skriva över variant.
  '{
    "variant": "points",
    "points_per_visit": 50,
    "stamp_goal": 10,
    "headline": "Bli stammis",
    "perk_text": "Tjäna poäng varje besök och få förmåner."
  }'::jsonb,
  'main'
)
on conflict (key) do update
  set name                     = excluded.name,
      owns_tables              = excluded.owns_tables,
      variant_schema           = excluded.variant_schema,
      default_config           = excluded.default_config,
      default_section_position = excluded.default_section_position,
      updated_at               = now();

-- Sanity (no-op): bekräfta att modulen registrerats. INGEN tabell-kontroll här —
-- loyalty_ledger ägs av 0016 och rörs inte av denna migration (register-only).
do $$
declare
  v_variant jsonb;
begin
  select variant_schema -> 'variant' -> 'enum'
    into v_variant
    from public.modules where key = 'lojalitet';
  raise notice 'lojalitet-modul registrerad (register-only): varianter=% · owns_tables=loyalty_ledger (befintlig, 0016 — ej skapad/ändrad här)',
    coalesce(v_variant::text, '(saknas)');
end $$;
