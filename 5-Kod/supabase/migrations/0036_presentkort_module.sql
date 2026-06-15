-- ============================================================================
-- 0036 — Presentkort-modul · REGISTER + TABELL + RLS (multi-bransch spår 5)
--
-- Registrerar EN modul `presentkort` i public.modules — EN modul med VARIANTER
-- (config, ej fork), EXAKT samma mönster som webshop- (0031/0032), offert- (0033),
-- blogg- (0034) och lojalitet-modulen (0035) per LÅST beslut 14.5 (CONFIG-FIRST) +
-- §15 (skelett vs skin): presentations-skillnader = varianter inuti modulen, aldrig
-- `if (bransch)` i motorn. Branschens preset väljer default-variant.
--
-- VARIANTER (variant_schema.fulfilment.enum) — hur presentkortet levereras:
--   'digital'  — skickas via mejl till mottagaren (default).
--   'physical' — fysiskt kort som hämtas i butik.
--
-- ⚠ COMPLIANCE — RÖR PENGAR, MEN INGA BETAL-RAILS BYGGS (LÅST regel: inga
-- betaltjänster utan uttryckligt OK). Modulen är INERT: betal-hooken är TOM
-- (payment.enabled=false, provider=null, EXAKT som shop 0031/0032), det finns
-- INGEN köp-funktion, INGEN order och INGEN provider-integration. Tabellen
-- `gift_cards` LAGRAR bara saldon (initial_amount / balance) — INGA pengar rör sig
-- i denna migration; den skapar lagringsytan, inte ett betalflöde. En framtida
-- betal-modul får addera sin koppling additivt när rails godkänns.
--
-- LIVSCYKEL (§4): modulen seedas INTE per tenant här. presentkort = opt-in;
-- super-admin flippar off→draft per kund (state-vakten i 0026 §9 kräver
-- platform_admin för off→draft). Storefronten gatear på tenant_modules.state
-- ='live' (EXAKT som booking + shop + offert + blogg + lojalitet).
--
-- owns_tables = tabellen 0036 skapar (modulen äger den; gatad av state).
-- default_section_position = var modulens fallback-sektion injiceras i storefront
-- — 'main', som booking/shop/offert/blogg/lojalitet, så skinnet kan placera
-- presentkorts-promon.
--
-- RLS-MÖNSTER taget ORDAGRANT ur 0032 (shop_orders/shop_order_items — de PRIVATA
-- shop-tabellerna), men SNÄVARE än blogg/shop_products: INGEN anon-policy.
--   tenant-scoped:  using/with check (tenant_id = (select private.tenant_id())
--                                     or (select private.is_platform_admin()))
--   ⚠ INGEN anon storefront-READ (till skillnad från blog_posts/shop_products):
--     presentkortskoder + saldon är KÄNSLIGA och får ALDRIG läcka till publiken.
--     Storefrontens promo-sektion läser ALDRIG tabellen — den visar bara config
--     (belopp-presets + leverans), så den behöver ingen rad. Därför: ingen grant
--     till anon, ingen `for select to anon`-policy. Avsiktligt snävare än shop.
--   private.tenant_id() / private.is_platform_admin() / public.set_updated_at()
--     definieras i 0002/0004/0001 — vi återanvänder dem, skapar inga nya helpers.
--
-- IDEMPOTENT: insert ... on conflict (key) do update (register) + create table
-- if not exists / create index if not exists / drop policy if exists → create.
-- Build-once-never-delete (inget droppas). Säker att köra om.
--
-- ⚠ APPLICERA INTE automatiskt mot prod. Granska → kör manuellt när godkänd.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════
-- 1. REGISTER — EN modul `presentkort` i public.modules (varianter via config)
-- ════════════════════════════════════════════════════════════════════════
insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'presentkort',
  'Presentkort',
  -- Tabell modulen äger (skapas nedan). Gatad av tenant_modules.state.
  '["gift_cards"]'::jsonb,
  -- variant_schema: deklarerar presentkorts-varianterna (leverans = data). Super-
  -- admin/onboarding läser detta för att visa val; storefronten läser
  -- tenant_modules.config.fulfilment för att veta hur promo-sektionen ska renderas.
  '{
    "fulfilment": {
      "type": "enum",
      "enum": ["digital", "physical"],
      "default": "digital",
      "labels": {
        "digital": "Digitalt (mejl)",
        "physical": "Fysiskt (hämtas)"
      },
      "params": {
        "amount_presets": { "type": "int_array", "default": [200, 500, 1000] },
        "currency": { "type": "string", "default": "SEK" }
      }
    }
  }'::jsonb,
  -- default_config: vald variant + dess parametrar + promo-copy. Betal-hooken är
  -- TOM (EXAKT som shop 0031): payment.enabled=false, provider=null — inga rails.
  -- Sätts vid aktivering (off→draft); branschens preset kan skriva över fulfilment.
  '{
    "fulfilment": "digital",
    "amount_presets": [200, 500, 1000],
    "currency": "SEK",
    "headline": "Presentkort",
    "payment": { "enabled": false, "provider": null }
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

-- ════════════════════════════════════════════════════════════════════════
-- 2. TABELL — gift_cards (ett presentkort/rad/tenant; variant-agnostiskt)
--    Lagrar saldon (initial_amount_cents/balance_cents) i minsta valuta-enhet.
--    ⚠ INGA pengar rör sig här — detta är lagringsytan, inte ett betalflöde.
--    Köp/utfärdande/inlösen kopplas först när betal-rails godkänns (INERT idag).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.gift_cards (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  code                 text not null,                       -- unik kod per tenant (se unique-index nedan)
  initial_amount_cents integer not null default 0,          -- utfärdat belopp, minsta valuta-enhet
  balance_cents        integer not null default 0,          -- kvarvarande saldo, minsta valuta-enhet
  currency             text not null default 'SEK',
  status               text not null default 'active'
                         check (status in ('active','redeemed','expired','void')),
  recipient_name       text,
  recipient_email      text,
  message              text,
  expires_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);
create index if not exists gift_cards_tenant_idx on public.gift_cards (tenant_id);
-- En presentkortskod är unik PER tenant (samma kod kan finnas hos olika tenants).
create unique index if not exists gift_cards_tenant_code_uniq on public.gift_cards (tenant_id, code);
create index if not exists gift_cards_tenant_status_idx on public.gift_cards (tenant_id, status);

-- updated_at-trigger (befintlig public.set_updated_at från 0001).
do $$
begin
  drop trigger if exists trg_gift_cards_updated_at on public.gift_cards;
  create trigger trg_gift_cards_updated_at before update on public.gift_cards
    for each row execute function public.set_updated_at();
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS — tenant-scoped via private.tenant_id() + is_platform_admin()-bypass
--    (mönster ordagrant ur 0032:s shop_orders — den PRIVATA shop-tabellen).
--    ⚠ INGEN anon-policy: presentkortskoder + saldon är KÄNSLIGA och får ALDRIG
--    läcka. Storefrontens promo-sektion läser ALDRIG tabellen (den visar bara
--    config), så ingen rad behöver vara anon-läsbar. Avsiktligt snävare än
--    blog_posts/shop_products som är anon-läsbara.
-- ════════════════════════════════════════════════════════════════════════

-- grants: PostgREST exponerar bara public. INGEN grant till anon (koder/saldon är
-- privata — jfr shop_orders/shop_order_items i 0032 som inte heller är anon-läsbara).
-- authenticated får full CRUD (RLS scopar till egen tenant / admin).
grant select, insert, update, delete on public.gift_cards to authenticated;

alter table public.gift_cards enable row level security;
drop policy if exists gift_cards_rls on public.gift_cards;
-- tenant-scoped write/read för inloggade (admin ser/ändrar egna; platform_admin allt).
create policy gift_cards_rls on public.gift_cards
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- ⚠ AVSIKTLIGT INGEN `for select to anon`-policy: koder + saldon får ALDRIG läcka
-- till publiken, och promo-sektionen behöver ingen rad (den läser bara config).

-- Sanity (no-op): bekräfta att modulen registrerats + tabellen finns med RLS på.
do $$
declare
  v_fulfilment jsonb;
  v_count      int;
begin
  select variant_schema -> 'fulfilment' -> 'enum'
    into v_fulfilment
    from public.modules where key = 'presentkort';
  select count(*) into v_count
    from pg_tables
   where schemaname = 'public' and tablename = 'gift_cards';
  raise notice 'presentkort-modul registrerad: leverans-varianter=% · tabell gift_cards=%/1 (RLS via private.tenant_id(), INGEN anon-policy — koder/saldon privata; betal-hook TOM)',
    coalesce(v_fulfilment::text, '(saknas)'), v_count;
end $$;
