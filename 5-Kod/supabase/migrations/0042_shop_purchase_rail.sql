-- ============================================================================
-- 0042 — WEBSHOP KÖP-RÄLS (goal-49 Fas 0) · variant-grain + held-order + RPC:er
--
-- Bygger köp-rälsen OVANPÅ 0031/0032 (modul-register + tabeller). Additivt,
-- idempotent, rollback-fil bredvid. Speglar boknings-rälsen (0005 create_public_booking
-- + 0014 slot_holds + 0015 resolve_customer_id) men för produkt-köp.
--
-- ARKITEKTUR (advisor-låst):
--  • EN order-entitet + status-FSM. INGEN separat cart-tabell, INGEN cart→order-kopia.
--    Browse-varukorgen lever klient-sida; order föds vid kassa-start som 'reserved'.
--    (cart==order honoreras som EN entitet m. livscykel; från-första-add-'cart' = trivial
--     promotion senare, parkerad m. abandoned-cart = STRETCH.)
--  • LAGER: held via shop_product_variants.reserved_qty (oversell-skydd, Medusa/Vendure-
--    mönstret). available = stock - reserved_qty. ALDRIG decrement-at-submit (då låser
--    en avbruten Stripe-betalning lager utan release-väg). reserve → (commit | release).
--  • EN-SWITCH STRIPE: lager committas ENDAST vid slutlig success (confirm utan betalning
--    ELLER webhook 'paid'), släpps vid fail/expiry. Commit-vakten = boolean stock_committed
--    (oberoende av expires_at) → att tända payments_enabled byter bara VILKEN trigger som
--    committar, ingen lager-logik-refaktor. Commit sker ALLTID medan ordern fortf. håller
--    sitt hold (status reserved/awaiting_payment) → status flippas EFTER commit.
--  • PII-gräns (advisor): token-gatade RPC:er avvisar EXPLICIT null-token (annars läcker
--    null-token-ordrar — t.ex. back-office-skapade — PII via get_public_shop_order).
--  • Köpbar enhet = VARIANT (variant-grain dag 1). Variant-lösa produkter får en seedad
--    'Standard'-variant. shop_products.price_cents/stock blir display/legacy.
--  • Inga bransch-if: fulfilment snapshottas ur shop.fulfilment-varianten (0031).
--
-- SÄKERHET: alla skriv-vägar = SECURITY DEFINER RPC, search_path='', server-side totaler
-- (aldrig klient-pris). anon rör ALDRIG shop_orders direkt (RLS authenticated-only); anon
-- når sin egen order bara via token-gatade RPC:er (samma mönster som slot_holds).
--
-- BETAL-RÄLS PAUSAD: payment_status kvar ren statuskolumn; live-charge gatas av
-- tenant_settings.payments_enabled (0007) — byggs i Fas 3, tänds separat (compliance-gate).
-- ============================================================================
set search_path = public;

-- ── 1. shop_product_variants (variant-grain: pris/SKU/lager/bild per variant) ──
create table if not exists public.shop_product_variants (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  product_id     uuid not null references public.shop_products(id) on delete cascade,
  name           text not null default 'Standard',     -- t.ex. "Small / Röd"
  sku            text,
  price_cents    integer not null default 0 check (price_cents >= 0),
  currency       text not null default 'SEK',
  -- lager: null = ospårat (obegränsat); >=0 = spårat saldo (on-hand).
  stock          integer check (stock is null or stock >= 0),
  -- held: kvantitet reserverad av pågående/obetalda ordrar. available = stock - reserved_qty.
  reserved_qty   integer not null default 0 check (reserved_qty >= 0),
  image_asset_id uuid references public.media_assets(id) on delete set null,
  active         boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  -- kan aldrig reservera mer än on-hand (spårat lager).
  constraint shop_variant_reserve_le_stock check (stock is null or reserved_qty <= stock)
);
create index if not exists shop_variants_tenant_idx       on public.shop_product_variants (tenant_id);
create index if not exists shop_variants_product_idx      on public.shop_product_variants (product_id);
create index if not exists shop_variants_tenant_active_idx on public.shop_product_variants (tenant_id, active);

-- seed: ge varje befintlig produkt EN 'Standard'-variant (köpbar enhet = variant).
-- Idempotent: hoppar produkter som redan har minst en variant.
insert into public.shop_product_variants (tenant_id, product_id, name, price_cents, currency, stock, image_asset_id, sort_order)
select p.tenant_id, p.id, 'Standard', p.price_cents, p.currency, p.stock, p.image_asset_id, 0
  from public.shop_products p
 where not exists (select 1 from public.shop_product_variants v where v.product_id = p.id);

-- ── 2. shop_order_items: variant-koppling + moms-per-rad (additivt) ────────────
-- NOTE (low, defer): variant_id är on delete set null → om en variant raderas medan en
-- order håller reservation hoppar release/commit-joinen den raden. App-lagret ska blocka
-- variant-radering med aktiva holds (Fas 2 admin), inte DB-tvång (build-once).
alter table public.shop_order_items add column if not exists variant_id uuid
  references public.shop_product_variants(id) on delete set null;
alter table public.shop_order_items add column if not exists tax_rate numeric(5,4) not null default 0; -- 0.2500 = 25%
alter table public.shop_order_items add column if not exists tax_cents integer not null default 0 check (tax_cents >= 0);
create index if not exists shop_order_items_variant_idx on public.shop_order_items (variant_id);

-- ── 3. shop_orders: FSM-utökning + hold + full kostnads-uppdelning (additivt) ──
alter table public.shop_orders add column if not exists session_token   text;     -- opak, token-gatar anon-läsning (PII-gräns)
alter table public.shop_orders add column if not exists expires_at      timestamptz; -- satt medan status='reserved'/'awaiting_payment'
alter table public.shop_orders add column if not exists stock_committed boolean not null default false; -- en-gångs commit-latch (oberoende av expires_at)
alter table public.shop_orders add column if not exists subtotal_cents  integer not null default 0 check (subtotal_cents >= 0);
alter table public.shop_orders add column if not exists shipping_cents  integer not null default 0 check (shipping_cents >= 0);
alter table public.shop_orders add column if not exists discount_cents  integer not null default 0 check (discount_cents >= 0);
alter table public.shop_orders add column if not exists tax_cents       integer not null default 0 check (tax_cents >= 0);

-- vidga status-FSM:en (superset av 0032; ingen data-förlust). Lägg held-/betal-/expired-states.
-- Constraint-namnet bekräftat = shop_orders_status_check (live-DB-query).
alter table public.shop_orders drop constraint if exists shop_orders_status_check;
alter table public.shop_orders add constraint shop_orders_status_check
  check (status in ('reserved','awaiting_payment','pending','confirmed','ready','completed','cancelled','expired'));

create index if not exists shop_orders_reserve_idx on public.shop_orders (status, expires_at)
  where status in ('reserved','awaiting_payment');

-- ════════════════════════════════════════════════════════════════════════════
-- RLS — variants: tenant-scoped skriv + anon publik läsning (mönster ur 0032).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.shop_product_variants enable row level security;
grant select on public.shop_product_variants to anon, authenticated;
grant insert, update, delete on public.shop_product_variants to authenticated;

drop policy if exists shop_variants_rls         on public.shop_product_variants;
drop policy if exists shop_variants_public_read on public.shop_product_variants;
create policy shop_variants_rls on public.shop_product_variants
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
create policy shop_variants_public_read on public.shop_product_variants
  for select to anon using (true); -- app-lagret filtrerar tenant_id (jfr shop_products 0032)

-- updated_at-trigger (befintlig public.set_updated_at från 0001)
drop trigger if exists trg_shop_product_variants_updated_at on public.shop_product_variants;
create trigger trg_shop_product_variants_updated_at before update on public.shop_product_variants
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- RPC:er — köp-rälsen. Alla SECURITY DEFINER, search_path='', fullkvalificerade.
-- ════════════════════════════════════════════════════════════════════════════

-- 4a) prune: släpp lager-holdet för utgångna RESERVED ordrar (pre-confirm-abandon).
--     awaiting_payment rörs INTE här — den har en PaymentIntent i flykten; dess release
--     drivs av betal-fail/session-expired-webhooken (Fas 3), aldrig av TTL (annars race:
--     prune frigör → sen 'paid'-webhook → oversell). Lazy (anropas i reserve) + cron-bar.
create or replace function public.prune_expired_shop_reserves()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_n integer := 0;
begin
  for v_order in
    select id from public.shop_orders
     where status = 'reserved'
       and expires_at is not null and expires_at < now()
     for update skip locked
  loop
    update public.shop_product_variants v
       set reserved_qty = greatest(0, v.reserved_qty - oi.quantity)
      from public.shop_order_items oi
     where oi.order_id = v_order.id and oi.variant_id = v.id;
    update public.shop_orders set status = 'expired', expires_at = null where id = v_order.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.prune_expired_shop_reserves() from public;
grant execute on function public.prune_expired_shop_reserves() to anon, authenticated, service_role;

-- 4b) reserve_shop_order: skapar held order ur en items-array. Server-side totaler,
--     atomär lager-hold (deterministisk FOR UPDATE-ordning + reserved_qty). Returnerar id.
--     p_items = jsonb '[{"variant_id":"uuid","quantity":2}, ...]'
create or replace function public.reserve_shop_order(
  p_tenant_slug text,
  p_items       jsonb,
  p_fulfilment  text default 'ship',
  p_token       text default null,
  p_ttl_min     integer default 30
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant    uuid;
  v_order     uuid;
  v_item      jsonb;
  v_variant   record;
  v_qty       integer;
  v_prod_name text;
  v_currency  text := 'SEK';
  v_subtotal  integer := 0;
  v_count     integer := 0;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'missing_token' using errcode = '22023';
  end if;
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 240 then
    raise exception 'bad_ttl' using errcode = '22023';
  end if;
  if p_fulfilment not in ('ship','pickup_within_days','order_in_then_pickup') then
    raise exception 'bad_fulfilment' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = '22023';
  end if;

  select t.id into v_tenant from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002'; end if;

  perform public.prune_expired_shop_reserves(); -- frigör utgångna holds först

  -- deterministisk lås-ordning (undvik deadlock vid omvänd cart-ordning): lås ALLA
  -- berörda varianter sorterat på id INNAN rad-loopen rör dem.
  perform 1 from public.shop_product_variants
   where tenant_id = v_tenant
     and id in (select (e->>'variant_id')::uuid from jsonb_array_elements(p_items) e)
   order by id
   for update;

  insert into public.shop_orders (tenant_id, fulfilment, status, session_token, expires_at,
                                  subtotal_cents, total_cents, currency)
  values (v_tenant, p_fulfilment, 'reserved', p_token, now() + make_interval(mins => p_ttl_min),
          0, 0, 'SEK')
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 then raise exception 'bad_quantity' using errcode = '22023'; end if;

    select * into v_variant from public.shop_product_variants
     where id = (v_item->>'variant_id')::uuid and tenant_id = v_tenant and active = true;
    if v_variant.id is null then raise exception 'invalid_variant' using errcode = 'P0002'; end if;

    if v_variant.stock is not null and (v_variant.stock - v_variant.reserved_qty) < v_qty then
      raise exception 'out_of_stock' using errcode = '23P01'; -- app: 'slutsåld', ladda om
    end if;

    update public.shop_product_variants
       set reserved_qty = reserved_qty + v_qty
     where id = v_variant.id;

    -- snapshot: riktigt PRODUKT-namn (ej variant-'Standard'); suffixa variant bara om ≠ Standard.
    select p.name into v_prod_name from public.shop_products p where p.id = v_variant.product_id;
    v_prod_name := coalesce(v_prod_name, v_variant.name)
                   || case when v_variant.name is not null and v_variant.name <> 'Standard'
                           then ' — ' || v_variant.name else '' end;

    insert into public.shop_order_items (tenant_id, order_id, product_id, variant_id,
                                         product_name, unit_price_cents, quantity)
    values (v_tenant, v_order, v_variant.product_id, v_variant.id,
            v_prod_name, v_variant.price_cents, v_qty);

    v_currency := v_variant.currency; -- snapshotta valuta ur variant (SEK-only v1, men korrekt)
    v_subtotal := v_subtotal + (v_variant.price_cents * v_qty);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'empty_cart' using errcode = '22023'; end if;

  -- moms/frakt/rabatt beräknas i senare faser (config); v1 total = subtotal (server-side).
  update public.shop_orders
     set subtotal_cents = v_subtotal, total_cents = v_subtotal, currency = v_currency
   where id = v_order;

  return v_order;
end;
$$;
revoke all on function public.reserve_shop_order(text,jsonb,text,text,integer) from public;
grant execute on function public.reserve_shop_order(text,jsonb,text,text,integer) to anon, authenticated;

-- 4c) _commit_shop_order_stock: intern. Flyttar held → committat (stock -= qty,
--     reserved_qty -= qty) EXAKT EN GÅNG via stock_committed-latch (oberoende av
--     expires_at). Körs ALLTID medan ordern fortf. håller hold (status reserved/awaiting).
create or replace function public._commit_shop_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- en-gångs: gör inget om redan committat ELLER om holdet redan släppts (status bytt).
  if not exists (
    select 1 from public.shop_orders o
     where o.id = p_order_id and o.stock_committed = false
       and o.status in ('reserved','awaiting_payment')
  ) then
    return;
  end if;

  update public.shop_product_variants v
     set stock = case when v.stock is null then null else greatest(0, v.stock - oi.quantity) end,
         reserved_qty = greatest(0, v.reserved_qty - oi.quantity)
    from public.shop_order_items oi
   where oi.order_id = p_order_id and oi.variant_id = v.id;

  update public.shop_orders set stock_committed = true, expires_at = null where id = p_order_id;
end;
$$;
revoke all on function public._commit_shop_order_stock(uuid) from public;
grant execute on function public._commit_shop_order_stock(uuid) to service_role;

-- 4d) confirm_shop_order: finaliserar kund/fulfilment-detaljer på en reserverad order.
--     Avgör server-side om betalning krävs (payments_enabled & stripe_charges_enabled).
--     Ingen betalning → committa lagret (medan status fortf. 'reserved') → status 'pending'.
--     Betalning krävs → status 'awaiting_payment', lagret hålls (commit vid webhook).
--     Returnerar (order_id, requires_payment). Token-gatad (null-token avvisas).
create or replace function public.confirm_shop_order(
  p_order_id        uuid,
  p_token           text,
  p_customer        uuid default null,
  p_guest_name      text default null,
  p_guest_email     text default null,
  p_guest_phone     text default null,
  p_ship_address    text default null,
  p_pickup_location uuid default null,
  p_note            text default null
) returns table (order_id uuid, requires_payment boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   record;
  v_uid     uuid := auth.uid();
  v_cust    uuid;
  v_email   text; v_phone text;
  v_pay_on  boolean;
  v_charges boolean;
  v_req     boolean;
begin
  select * into v_order from public.shop_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'unknown_order' using errcode = 'P0002'; end if;
  -- token-gate: avvisa EXPLICIT null (null is distinct from null = false → annars läcka).
  if p_token is null or v_order.session_token is null or v_order.session_token <> p_token then
    raise exception 'forbidden_order' using errcode = '42501';
  end if;
  if v_order.status <> 'reserved' then
    raise exception 'order_not_reservable' using errcode = 'P0001'; -- redan confirmad/expired
  end if;
  if v_order.expires_at is not null and v_order.expires_at < now() then
    raise exception 'order_expired' using errcode = 'P0001';
  end if;

  -- identitets-staket (jfr create_public_booking): anon får ej claima customer-id.
  if v_uid is null then
    if p_customer is not null then raise exception 'forbidden_customer' using errcode = '42501'; end if;
  elsif p_customer is not null and p_customer <> v_uid then
    raise exception 'forbidden_customer' using errcode = '42501';
  end if;

  -- resolva customer_id (additivt, samma helper som booking; 0015).
  if p_customer is not null then
    select u.email, u.phone into v_email, v_phone from public.users u where u.id = p_customer;
    v_cust := private.resolve_customer_id(v_order.tenant_id, p_customer, nullif(btrim(p_guest_name),''), v_email, v_phone);
  else
    v_cust := private.resolve_customer_id(v_order.tenant_id, null, p_guest_name, p_guest_email, p_guest_phone);
  end if;

  -- betal-gate (dual, server-side; speglar booking requiresPayment).
  select coalesce(ts.payments_enabled, false) into v_pay_on
    from public.tenant_settings ts where ts.tenant_id = v_order.tenant_id;
  select coalesce(t.stripe_charges_enabled, false) into v_charges
    from public.tenants t where t.id = v_order.tenant_id;
  v_req := coalesce(v_pay_on, false) and coalesce(v_charges, false);

  -- finalisera detaljer (status oförändrad här → commit kan köra medan hold lever).
  update public.shop_orders
     set customer_id = v_cust,
         customer_name  = nullif(btrim(coalesce(p_guest_name,  customer_name)), ''),
         customer_email = nullif(btrim(coalesce(p_guest_email, customer_email)), ''),
         customer_phone = nullif(btrim(coalesce(p_guest_phone, customer_phone)), ''),
         ship_address = coalesce(p_ship_address, ship_address),
         pickup_location_id = coalesce(p_pickup_location, pickup_location_id),
         note = coalesce(p_note, note)
   where id = p_order_id;

  if v_req then
    -- behåll holdet, vänta på betalning (commit sker i mark_shop_order_paid).
    update public.shop_orders
       set status = 'awaiting_payment', expires_at = now() + interval '30 minutes'
     where id = p_order_id;
  else
    -- ingen betalning: committa lagret (status fortf. 'reserved') → sätt 'pending'.
    perform public._commit_shop_order_stock(p_order_id);
    update public.shop_orders set status = 'pending' where id = p_order_id;
  end if;

  return query select p_order_id, v_req;
end;
$$;
revoke all on function public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text) from public;
grant execute on function public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text) to anon, authenticated;

-- 4e) mark_shop_order_paid: service-role (webhook payment_intent.succeeded). Committar
--     lagret (medan status fortf. 'awaiting_payment') → status 'pending' + paid. Idempotent.
create or replace function public.mark_shop_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._commit_shop_order_stock(p_order_id);
  update public.shop_orders
     set status = case when status in ('reserved','awaiting_payment') then 'pending' else status end,
         payment_status = case when payment_status <> 'refunded' then 'paid' else payment_status end,
         expires_at = null
   where id = p_order_id;
end;
$$;
revoke all on function public.mark_shop_order_paid(uuid) from public;
grant execute on function public.mark_shop_order_paid(uuid) to service_role;

-- 4f) release_shop_order: släpp held lager + markera cancelled/expired. Token-gatad för
--     anon (avbryt egen reserverad order); service_role (webhook fail) passerar utan token.
create or replace function public.release_shop_order(
  p_order_id uuid,
  p_token    text default null,
  p_status   text default 'cancelled'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if p_status not in ('cancelled','expired') then
    raise exception 'bad_release_status' using errcode = '22023';
  end if;
  select * into v_order from public.shop_orders where id = p_order_id for update;
  if v_order.id is null then return; end if; -- idempotent: redan borta

  -- service_role får passera utan token (webhook); annars KRÄVS matchande icke-null token.
  if (select auth.role()) is distinct from 'service_role' then
    if p_token is null or v_order.session_token is null or v_order.session_token <> p_token then
      raise exception 'forbidden_order' using errcode = '42501';
    end if;
  end if;

  if v_order.status not in ('reserved','awaiting_payment') then return; end if; -- inget hold att släppa

  update public.shop_product_variants v
     set reserved_qty = greatest(0, v.reserved_qty - oi.quantity)
    from public.shop_order_items oi
   where oi.order_id = p_order_id and oi.variant_id = v.id;
  update public.shop_orders set status = p_status, expires_at = null where id = p_order_id;
end;
$$;
revoke all on function public.release_shop_order(uuid,text,text) from public;
grant execute on function public.release_shop_order(uuid,text,text) to anon, authenticated, service_role;

-- 4g) get_public_shop_order: token-gatad order-vy för bekräftelse-sidan (anon).
--     Token-gate avvisar EXPLICIT null (orders bär leveransadress-PII → aldrig fri by-id).
create or replace function public.get_public_shop_order(p_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_order record;
  v_items jsonb;
  v_pay_on boolean; v_charges boolean;
begin
  select * into v_order from public.shop_orders where id = p_id;
  if v_order.id is null then return null; end if;
  if p_token is null or v_order.session_token is null or v_order.session_token <> p_token then
    raise exception 'forbidden_order' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_name', oi.product_name, 'quantity', oi.quantity,
           'unit_price_cents', oi.unit_price_cents) order by oi.created_at), '[]'::jsonb)
    into v_items from public.shop_order_items oi where oi.order_id = p_id;

  select coalesce(ts.payments_enabled, false) into v_pay_on
    from public.tenant_settings ts where ts.tenant_id = v_order.tenant_id;
  select coalesce(t.stripe_charges_enabled, false) into v_charges
    from public.tenants t where t.id = v_order.tenant_id;

  return jsonb_build_object(
    'id', v_order.id, 'status', v_order.status, 'payment_status', v_order.payment_status,
    'fulfilment', v_order.fulfilment, 'total_cents', v_order.total_cents,
    'subtotal_cents', v_order.subtotal_cents, 'shipping_cents', v_order.shipping_cents,
    'discount_cents', v_order.discount_cents, 'tax_cents', v_order.tax_cents,
    'currency', v_order.currency, 'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email, 'ship_address', v_order.ship_address,
    'created_at', v_order.created_at, 'items', v_items,
    'payments_enabled', v_pay_on, 'stripe_charges_enabled', v_charges,
    'requires_payment', (coalesce(v_pay_on,false) and coalesce(v_charges,false))
  );
end;
$$;
revoke all on function public.get_public_shop_order(uuid,text) from public;
grant execute on function public.get_public_shop_order(uuid,text) to anon, authenticated;

-- Sanity (no-op): bekräfta variant-tabell + RPC:er finns.
do $$
declare v_fns int;
begin
  select count(*) into v_fns from pg_proc
   where proname in ('reserve_shop_order','confirm_shop_order','mark_shop_order_paid',
                     'release_shop_order','get_public_shop_order','prune_expired_shop_reserves');
  raise notice '0042 köp-räls: % RPC:er, shop_product_variants skapad', v_fns;
end $$;
