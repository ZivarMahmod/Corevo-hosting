-- ============================================================================
-- 0032 — Webshop-modul · TABELLER + RLS (multi-bransch spår 5, Wave C #6)
--
-- Modul-specifika tabeller för `shop` (registrerad i 0031). Byggs när modulen
-- byggs (§12: "Modul-specifika tabeller byggs när modulen byggs … gatade av
-- tenant_modules.state"). Tre tabeller modulen äger (modules.owns_tables):
--   shop_products    — produkter (en rad/produkt/tenant).
--   shop_orders      — ordrar (header: kund + fulfilment-snapshot + status).
--   shop_order_items — orderrader (produkt-snapshot + antal + pris).
--
-- RLS-MÖNSTER taget ORDAGRANT ur 0027 (tenant-scoped):
--   tenant-scoped:  using/with check (tenant_id = (select private.tenant_id())
--                                     or (select private.is_platform_admin()))
--   anon storefront-read: publik SELECT-policy (app-lagret filtrerar tenant_id,
--                         jfr content_slots_public_read / media_assets i 0027 +
--                         0004-mönstret). anon bär INGET tenant-claim → RLS
--                         isolerar inte; isolering sker app-lager (.eq tenant_id).
--
-- VARIANT-AGNOSTISKT SCHEMA: tabellerna lagrar EN modell för alla tre
-- fulfilment-varianter (config-first). shop_orders.fulfilment snapshottar vald
-- variant vid orderläggning; pickup_location/pickup_by/order_lead-fälten är
-- nullable och fylls bara för de varianter som använder dem. Ingen fork per variant.
--
-- BETAL-RAILS PAUSADE (beslut 14.2): INGEN betal-tabell, INGEN provider-koppling.
-- shop_orders.payment_status defaultar 'unpaid' och är en ren STATUS-kolumn
-- (ingen integration). En framtida betal-modul får addera sin koppling additivt.
--
-- private.tenant_id() / private.is_platform_admin() / public.set_updated_at()
-- definieras i 0002/0004/0001 — vi återanvänder dem, skapar inga nya helpers.
--
-- IDEMPOTENT: create table if not exists / add column if not exists / create
-- index if not exists / drop policy if exists → create. Build-once-never-delete
-- (inget droppas). Säker att köra om. Körs EFTER 0031 (modul-register).
--
-- ⚠ APPLICERA INTE automatiskt mot prod. Granska → kör manuellt när godkänd.
-- ============================================================================

-- ── 1. shop_products (produkt-katalog per tenant) ───────────────────────────
create table if not exists public.shop_products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  slug          text,                                  -- valfri URL-vänlig nyckel
  description   text,
  price_cents   integer not null default 0 check (price_cents >= 0), -- minsta valuta-enhet
  currency      text not null default 'SEK',
  -- lager: null = ospårat (obegränsat); >=0 = spårat saldo.
  stock         integer check (stock is null or stock >= 0),
  image_asset_id uuid references public.media_assets(id) on delete set null, -- bild via media_library
  active        boolean not null default true,         -- false = dold i storefront (ej raderad)
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index if not exists shop_products_tenant_idx on public.shop_products (tenant_id);
create index if not exists shop_products_tenant_active_idx on public.shop_products (tenant_id, active);

-- ── 2. shop_orders (order-header: kund + fulfilment-snapshot + status) ───────
create table if not exists public.shop_orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null, -- känd kund om inloggad
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  -- fulfilment: snapshot av modulens valda variant VID orderläggning (config-first).
  fulfilment      text not null default 'ship'
                    check (fulfilment in ('ship', 'pickup_within_days', 'order_in_then_pickup')),
  -- variant-specifika fält (nullable; fylls bara för relevanta varianter):
  ship_address    text,                                -- fulfilment='ship'
  pickup_location_id uuid references public.locations(id) on delete set null, -- pickup-varianter
  pickup_by       date,                                -- 'pickup_within_days': senast-hämta-datum
  ready_at        timestamptz,                          -- 'order_in_then_pickup': beräknad klar-tid
  -- belopp (snapshot): summeras från order_items vid läggning.
  total_cents     integer not null default 0 check (total_cents >= 0),
  currency        text not null default 'SEK',
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','ready','completed','cancelled')),
  -- BETAL-RAILS PAUSADE: ren status-kolumn, INGEN provider-integration (beslut 14.2).
  payment_status  text not null default 'unpaid'
                    check (payment_status in ('unpaid','paid','refunded')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create index if not exists shop_orders_tenant_idx on public.shop_orders (tenant_id);
create index if not exists shop_orders_tenant_status_idx on public.shop_orders (tenant_id, status);
create index if not exists shop_orders_customer_idx on public.shop_orders (customer_id);

-- ── 3. shop_order_items (orderrader: produkt-snapshot + antal + pris) ────────
-- Produkt-snapshot (name/price) frysts vid läggning → historik orörd även om
-- produkten senare ändras/avaktiveras (append-only-anda, build-once).
create table if not exists public.shop_order_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade, -- denormaliserat för RLS
  order_id         uuid not null references public.shop_orders(id) on delete cascade,
  product_id       uuid references public.shop_products(id) on delete set null,   -- null om produkt borttagen
  product_name     text not null,                       -- snapshot
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0), -- snapshot
  quantity         integer not null default 1 check (quantity > 0),
  created_at       timestamptz not null default now()
);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);
create index if not exists shop_order_items_tenant_idx on public.shop_order_items (tenant_id);

-- ── 4. updated_at-triggers (befintlig public.set_updated_at från 0001) ──────
do $$
declare
  t text;
begin
  foreach t in array array['shop_products','shop_orders']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I;', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I '
      || 'for each row execute function public.set_updated_at();', t
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- RLS — tenant-scoped via private.tenant_id() + is_platform_admin()-bypass
-- (mönster ordagrant ur 0027). anon får läsa produkter (publik storefront).
-- ════════════════════════════════════════════════════════════════════════

-- grants: PostgREST exponerar bara public. anon får läsa produkter för publik
-- storefront-render (RLS gatar raderna app-lager). authenticated får full CRUD
-- (RLS scopar till egen tenant / admin). Ordrar är INTE anon-läsbara (privat).
grant select on public.shop_products to anon, authenticated;
grant select, insert, update, delete on
  public.shop_products, public.shop_orders, public.shop_order_items to authenticated;

-- ── shop_products: tenant-scoped write/read + anon publik produktläsning ────
alter table public.shop_products enable row level security;
drop policy if exists shop_products_rls         on public.shop_products;
drop policy if exists shop_products_public_read on public.shop_products;
create policy shop_products_rls on public.shop_products
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
-- anon storefront läser produkter (app-lagret filtrerar tenant_id; jfr 0004/0027).
create policy shop_products_public_read on public.shop_products
  for select to anon
  using (true);

-- ── shop_orders: tenant-scoped (privat — INGEN anon-read) ───────────────────
alter table public.shop_orders enable row level security;
drop policy if exists shop_orders_rls on public.shop_orders;
create policy shop_orders_rls on public.shop_orders
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- ── shop_order_items: tenant-scoped (privat — INGEN anon-read) ──────────────
alter table public.shop_order_items enable row level security;
drop policy if exists shop_order_items_rls on public.shop_order_items;
create policy shop_order_items_rls on public.shop_order_items
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- Sanity (no-op): bekräfta att de tre shop-tabellerna finns + har RLS på.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from pg_tables
   where schemaname = 'public'
     and tablename in ('shop_products','shop_orders','shop_order_items');
  raise notice 'shop-tabeller skapade: %/3 (RLS-policys via private.tenant_id())', v_count;
end $$;
