-- ============================================================================
-- 0033 — Offert-modul · REGISTER + TABELL + RLS (multi-bransch spår 5)
--
-- Registrerar EN modul `offert` i public.modules — EN modul med VARIANTER
-- (config, ej fork), EXAKT samma mönster som webshop-modulen (0031/0032) per
-- LÅST beslut 14.5 (CONFIG-FIRST) + §15 (skelett vs skin): beteende-skillnader
-- = varianter inuti modulen, aldrig `if (bransch)` i motorn. Branschens preset
-- väljer default-variant. (Plan: 07-maxad-byggplan.md #6 "… + offert + blogg".)
--
-- VARIANTER (variant_schema.mode.enum) — hur en offertförfrågan tas emot:
--   'request_quote' — kund beskriver sitt behov i fritext → företaget svarar
--                     med en offert manuellt (renodlad förfrågan, ingen prislista).
--   'estimate_form' — kund väljer fördefinierade poster/parametrar → en
--                     prisuppskattning visas/sparas som underlag (ej bindande).
--   'callback'      — kund lämnar kontakt + kort behov → "vi återkommer"
--                     (lättaste varianten; ingen offert renderas i storefront).
--
-- BETAL-RAILS PAUSADE (beslut 14.2 + hårda regler): INGEN betaltjänst, INGEN
-- provider-koppling. En offert/estimat är ett UNDERLAG — den rör inga pengar.
-- offert_requests bär ENDAST förfrågnings-/status-data; framtida betalning får
-- adderas additivt av en separat modul. Compliance: rör pengar → parkerat.
--
-- LIVSCYKEL (§4): modulen seedas INTE per tenant här. offert = opt-in;
-- super-admin flippar off→draft per kund (state-vakten i 0026 §9 kräver
-- platform_admin för off→draft). Storefronten gatear på tenant_modules.state
-- ='live' (EXAKT som booking + shop).
--
-- owns_tables = tabellen 0033 skapar (modulen äger den; gatad av state).
-- default_section_position = var modulens fallback-sektion injiceras i storefront
-- — 'main', som booking/shop, så skinnet kan placera offert-sektionen.
--
-- RLS-MÖNSTER taget ORDAGRANT ur 0032 (som i sin tur tog det ur 0027):
--   tenant-scoped:  using/with check (tenant_id = (select private.tenant_id())
--                                     or (select private.is_platform_admin()))
--   anon storefront-INSERT: publik storefront får SKAPA en förfrågan (kunden
--     skickar in via offert-formuläret) — app-lagret sätter tenant_id. anon får
--     INTE läsa förfrågningar (privat; jfr shop_orders som ej är anon-läsbar).
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
-- 1. REGISTER — EN modul `offert` i public.modules (varianter via config)
-- ════════════════════════════════════════════════════════════════════════
insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'offert',
  'Offert',
  -- Tabell modulen äger (skapas nedan). Gatad av tenant_modules.state.
  '["offert_requests"]'::jsonb,
  -- variant_schema: deklarerar offert-varianterna (beteende = data). Super-admin/
  -- onboarding läser detta för att visa val; storefronten läser
  -- tenant_modules.config.mode för att veta hur offert-sektionen ska bete sig.
  '{
    "mode": {
      "type": "enum",
      "enum": ["request_quote", "estimate_form", "callback"],
      "default": "request_quote",
      "labels": {
        "request_quote": "Begär offert (fritext)",
        "estimate_form": "Prisuppskattning (formulär)",
        "callback": "Vi återkommer (kontakt)"
      },
      "params": {
        "estimate_form": { "response_days": { "type": "int", "default": 2, "min": 1 } },
        "callback":       { "response_days": { "type": "int", "default": 1, "min": 1 } }
      }
    }
  }'::jsonb,
  -- default_config: vald variant + dess parametrar + TOM betal-hook (rails pausade).
  -- Sätts vid aktivering (off→draft); branschens preset kan skriva över mode.
  '{
    "mode": "request_quote",
    "response_days": 2,
    "currency": "SEK",
    "payment": {
      "provider": null,
      "enabled": false,
      "note": "Betal-rails PAUSADE (beslut 14.2) — offert är underlag, rör inga pengar."
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

-- ════════════════════════════════════════════════════════════════════════
-- 2. TABELL — offert_requests (en förfrågan/rad/tenant; variant-agnostiskt)
--    Lagrar EN modell för alla tre varianter (config-first). `mode` snapshottar
--    vald variant VID inskick; variant-specifika fält är nullable och fylls bara
--    för de varianter som använder dem. Ingen fork per variant.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.offert_requests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null, -- känd kund om inloggad
  -- kontaktuppgifter (kund kan vara inloggad eller anonym storefront-besökare):
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  -- mode: snapshot av modulens valda variant VID inskick (config-first).
  mode            text not null default 'request_quote'
                    check (mode in ('request_quote', 'estimate_form', 'callback')),
  -- förfrågans innehåll:
  subject         text,                                -- valfri rubrik/ämne
  message         text,                                -- fritext-behov (request_quote/callback)
  -- estimate_form: valda poster/parametrar som strukturerat underlag (jsonb).
  details         jsonb not null default '{}'::jsonb,
  -- belopp (snapshot): uppskattat värde för estimate_form (nullable; ej bindande,
  -- minsta valuta-enhet). request_quote/callback lämnar null.
  estimate_cents  integer check (estimate_cents is null or estimate_cents >= 0),
  currency        text not null default 'SEK',
  status          text not null default 'new'
                    check (status in ('new','reviewing','quoted','accepted','declined','closed')),
  -- BETAL-RAILS PAUSADE: ren status-kolumn, INGEN provider-integration (beslut 14.2).
  payment_status  text not null default 'unpaid'
                    check (payment_status in ('unpaid','paid','refunded')),
  note            text,                                -- intern anteckning (admin)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create index if not exists offert_requests_tenant_idx on public.offert_requests (tenant_id);
create index if not exists offert_requests_tenant_status_idx on public.offert_requests (tenant_id, status);
create index if not exists offert_requests_customer_idx on public.offert_requests (customer_id);

-- updated_at-trigger (befintlig public.set_updated_at från 0001).
do $$
begin
  drop trigger if exists trg_offert_requests_updated_at on public.offert_requests;
  create trigger trg_offert_requests_updated_at before update on public.offert_requests
    for each row execute function public.set_updated_at();
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS — tenant-scoped via private.tenant_id() + is_platform_admin()-bypass
--    (mönster ordagrant ur 0032). anon får SKAPA en förfrågan (publik storefront-
--    formulär), men INTE läsa (privat — som shop_orders).
-- ════════════════════════════════════════════════════════════════════════

-- grants: PostgREST exponerar bara public. anon får INSERT för publik
-- storefront-förfrågan (RLS gatar raden app-lager via tenant_id). authenticated
-- får full CRUD (RLS scopar till egen tenant / admin). Förfrågningar är INTE
-- anon-läsbara (privat kontakt-data).
grant insert on public.offert_requests to anon, authenticated;
grant select, insert, update, delete on public.offert_requests to authenticated;

alter table public.offert_requests enable row level security;
drop policy if exists offert_requests_rls          on public.offert_requests;
drop policy if exists offert_requests_public_insert on public.offert_requests;
-- tenant-scoped write/read för inloggade (admin ser/ändrar egna; platform_admin allt).
create policy offert_requests_rls on public.offert_requests
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon storefront får SKAPA en förfrågan (app-lagret sätter tenant_id; jfr 0004/0032).
-- INGEN anon SELECT-policy → anon kan inte läsa förfrågningar (privat).
create policy offert_requests_public_insert on public.offert_requests
  for insert to anon
  with check (true);

-- Sanity (no-op): bekräfta att modulen registrerats + tabellen finns med RLS på.
do $$
declare
  v_mode  jsonb;
  v_count int;
begin
  select variant_schema -> 'mode' -> 'enum'
    into v_mode
    from public.modules where key = 'offert';
  select count(*) into v_count
    from pg_tables
   where schemaname = 'public' and tablename = 'offert_requests';
  raise notice 'offert-modul registrerad: mode-varianter=% · tabell offert_requests=%/1 (RLS via private.tenant_id())',
    coalesce(v_mode::text, '(saknas)'), v_count;
end $$;
