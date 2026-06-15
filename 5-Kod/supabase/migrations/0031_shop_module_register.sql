-- ============================================================================
-- 0031 — Webshop-modul · REGISTER (multi-bransch spår 5, Wave C #6)
--
-- Registrerar EN modul `shop` i public.modules — EN modul med fulfilment-
-- VARIANTER (config, ej fork), exakt per LÅST beslut 14.5 (CONFIG-FIRST) +
-- §15 (skelett vs skin): beteende-skillnader = varianter inuti modulen, aldrig
-- `if (bransch)` i motorn. Branschens preset väljer default-variant.
--
-- VARIANTER (variant_schema.fulfilment.enum):
--   'ship'                — posta varan till kund (frakt).
--   'pickup_within_days'  — kund handlar online, hämtar i butik inom X dagar.
--   'order_in_then_pickup'— kund beställer hem varan till butik, hämtar sen.
--
-- BETAL-RAILS PAUSADE (beslut 14.2 + hårda regler): INGEN betaltjänst byggs in.
-- default_config.payment är en TOM hook (provider=null, enabled=false) — fylls
-- först när rails öppnas. Compliance-flagga: rör pengar → parkerat.
--
-- LIVSCYKEL (§4): modulen seedas INTE per tenant här. shop = opt-in; super-admin
-- flippar off→draft per kund (state-vakten i 0026 §9 kräver platform_admin för
-- off→draft). Storefronten gatear på tenant_modules.state='live' (som booking).
--
-- owns_tables = de tabeller 0032 skapar (modulen äger dem; gatade av state).
-- default_section_position = var modulens fallback-sektion injiceras i storefront
-- (06-syntes konflikt 3) — 'main', som booking, så skinnet kan placera shoppen.
--
-- IDEMPOTENT: insert ... on conflict (key) do update (build-once-never-delete;
-- inget droppas). Säker att köra om. Förändrar BARA katalogen (modules) — ingen
-- tenant-data, ingen RLS-ändring (RLS för shop-tabellerna ligger i 0032).
--
-- ⚠ APPLICERA INTE automatiskt mot prod. Granska → kör manuellt när godkänd.
-- ============================================================================

insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'shop',
  'Webshop',
  -- Tabeller modulen äger (skapas i 0032). Gatade av tenant_modules.state.
  '["shop_products","shop_orders","shop_order_items"]'::jsonb,
  -- variant_schema: deklarerar fulfilment-varianterna (beteende = data).
  -- Super-admin/onboarding läser detta för att visa val; storefronten läser
  -- tenant_modules.config.fulfilment för att veta hur shoppen ska bete sig.
  '{
    "fulfilment": {
      "type": "enum",
      "enum": ["ship", "pickup_within_days", "order_in_then_pickup"],
      "default": "ship",
      "labels": {
        "ship": "Posta hem",
        "pickup_within_days": "Hämta i butik inom X dagar",
        "order_in_then_pickup": "Beställ hem till butik & hämta"
      },
      "params": {
        "pickup_within_days": { "pickup_days": { "type": "int", "default": 3, "min": 1 } },
        "order_in_then_pickup": { "lead_days": { "type": "int", "default": 7, "min": 1 } }
      }
    }
  }'::jsonb,
  -- default_config: vald variant + dess parametrar + TOM betal-hook (rails pausade).
  -- Sätts vid aktivering (off→draft); branschens preset kan skriva över fulfilment.
  '{
    "fulfilment": "ship",
    "pickup_days": 3,
    "lead_days": 7,
    "currency": "SEK",
    "payment": {
      "provider": null,
      "enabled": false,
      "note": "Betal-rails PAUSADE (beslut 14.2) — hook lämnas tom tills rails öppnas."
    }
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

-- Sanity (no-op om saknas): bekräfta att shop-modulen finns i katalogen.
do $$
declare
  v_fulfilment jsonb;
begin
  select variant_schema -> 'fulfilment' -> 'enum'
    into v_fulfilment
    from public.modules where key = 'shop';
  raise notice 'shop-modul registrerad: fulfilment-varianter=%', coalesce(v_fulfilment::text, '(saknas)');
end $$;
