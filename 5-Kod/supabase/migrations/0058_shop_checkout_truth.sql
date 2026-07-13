-- ============================================================================
-- 0058 — KASSAN BLIR SANN (goal-64): frakt, betalsätt, läsbart ordernummer
--
-- 0057 gav DATAT (shop_shipping_options, shop_orders.shipping_option_id /
-- payment_method / order_no). Den här migrationen gör FSM:en sann: köp-rälsens
-- RPC:er räknade `total = subtotal` och lämnade shipping_cents = 0. Så fort en
-- mall visade en fraktrad ljög totalen.
--
-- TRE saker händer här, alla SERVER-SIDE (klienten får aldrig diktera ett belopp):
--   1. shop_order_counters + private.next_shop_order_no() — per-tenant löpnummer.
--   2. confirm_shop_order() får p_shipping_option + p_payment_method. Fraktpriset
--      SLÅS UPP UR DB på det valda alternativets id (klientens siffra läses aldrig),
--      totalen räknas om: total = subtotal + frakt − rabatt + moms.
--   3. get_public_shop_order() returnerar order_no, payment_method och fraktens namn
--      så bekräftelsen kan visa "#OX-4821" i stället för en uuid.
--
-- Reserve/confirm-FSM:en, lager-holden och token-gaten är OFÖRÄNDRADE — bara utökade.
-- IDEMPOTENT. Inget droppas utom funktionsdefinitionerna som ersätts.
-- ============================================================================

-- ── 1. Per-tenant löpnummer ────────────────────────────────────────────────
-- Designen visar "#OX-4821" / "No. E-1204" — ett kort, läsbart nummer. En uuid är
-- inte ett ordernummer, den är en nyckel. PREFIXET ("#OX-") är MALLENS (FloristTheme
-- .orderPrefix) och lagras därför INTE här: byter kunden mall imorgon ska gamla
-- ordrar följa med den nya mallens form, inte frysa den gamlas.
--
-- En egen räknartabell i stället för en sequence: sequences är globala objekt (en per
-- tenant hade krävt DDL vid varje ny kund) och kan inte återställas per tenant.
create table if not exists public.shop_order_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  next_no   integer not null default 1000 check (next_no > 0)
);

alter table public.shop_order_counters enable row level security;
-- Ingen policy: bara SECURITY DEFINER-funktionen nedan (och service_role) rör tabellen.

create or replace function private.next_shop_order_no(p_tenant uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_no integer;
begin
  -- Atomärt: INSERT ... ON CONFLICT DO UPDATE låser raden och returnerar det nya
  -- värdet i EN sats. Två samtidiga kassor kan alltså aldrig få samma nummer
  -- (unik-indexet shop_orders_tenant_order_no_idx är sista skyddsnätet).
  insert into public.shop_order_counters (tenant_id, next_no)
  values (p_tenant, 1001)
  on conflict (tenant_id) do update set next_no = public.shop_order_counters.next_no + 1
  returning next_no into v_no;
  return v_no::text;
end;
$$;
revoke all on function private.next_shop_order_no(uuid) from public;

-- ── 2. confirm_shop_order: frakt + betalsätt + ordernummer ─────────────────
-- Signaturen VÄXER (två nya defaultade params) → gamla 9-arg-versionen droppas först,
-- annars blir PostgREST-anropet tvetydigt ("function is not unique").
drop function if exists public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text);

create or replace function public.confirm_shop_order(
  p_order_id        uuid,
  p_token           text,
  p_customer        uuid default null,
  p_guest_name      text default null,
  p_guest_email     text default null,
  p_guest_phone     text default null,
  p_ship_address    text default null,
  p_pickup_location uuid default null,
  p_note            text default null,
  p_shipping_option uuid default null,   -- ID:t på kundens VALDA leveranssätt (priset slås upp här)
  p_payment_method  text default null    -- 'card'|'swish'|'klarna'|'paypal'|'applepay'
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
  v_ship    integer := 0;
  v_ship_id uuid;
  v_no      text;
  v_total   integer;
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

  -- ── FRAKTEN (goal-64) ────────────────────────────────────────────────────
  -- HÅRD REGEL: klienten skickar ett ID, ALDRIG ett belopp. Priset läses ur
  -- shop_shipping_options för DENNA tenant. Ett alternativ som inte finns, tillhör
  -- någon annan butik eller är avstängt → exception, aldrig "gratis frakt".
  if p_shipping_option is not null then
    select so.id, so.cost_cents into v_ship_id, v_ship
      from public.shop_shipping_options so
     where so.id = p_shipping_option
       and so.tenant_id = v_order.tenant_id
       and so.active = true;
    if v_ship_id is null then
      raise exception 'invalid_shipping_option' using errcode = 'P0002';
    end if;
  else
    -- Inget val skickat: butiken får bara ha 0 kr i frakt om den saknar aktiva val.
    -- Har den val men klienten hoppade över steget = manipulerad/trasig kassa → stopp.
    if exists (select 1 from public.shop_shipping_options so
                where so.tenant_id = v_order.tenant_id and so.active = true) then
      raise exception 'shipping_option_required' using errcode = 'P0002';
    end if;
    v_ship := 0;
  end if;

  if p_payment_method is not null
     and p_payment_method not in ('card','swish','klarna','paypal','applepay') then
    raise exception 'bad_payment_method' using errcode = '22023';
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

  -- Ordernummer: en gång per order (idempotent vid ev. retry — coalesce på befintligt).
  v_no := coalesce(v_order.order_no, private.next_shop_order_no(v_order.tenant_id));

  -- SUMMERINGEN (goal-64): total = delsumma + frakt − rabatt + moms. Rabattkoder är
  -- inte byggda än (discount_cents = 0), men räkningen går genom fältet så dagen de
  -- kommer behöver ingen röra totalen. greatest(0, …) = en total kan aldrig bli negativ.
  v_total := greatest(0, coalesce(v_order.subtotal_cents, 0)
                        + v_ship
                        - coalesce(v_order.discount_cents, 0)
                        + coalesce(v_order.tax_cents, 0));

  -- finalisera detaljer (status oförändrad här → commit kan köra medan hold lever).
  update public.shop_orders
     set customer_id = v_cust,
         customer_name  = nullif(btrim(coalesce(p_guest_name,  customer_name)), ''),
         customer_email = nullif(btrim(coalesce(p_guest_email, customer_email)), ''),
         customer_phone = nullif(btrim(coalesce(p_guest_phone, customer_phone)), ''),
         ship_address = coalesce(p_ship_address, ship_address),
         pickup_location_id = coalesce(p_pickup_location, pickup_location_id),
         note = coalesce(p_note, note),
         shipping_option_id = coalesce(v_ship_id, shipping_option_id),
         shipping_cents = v_ship,
         payment_method = coalesce(p_payment_method, payment_method),
         order_no = v_no,
         total_cents = v_total
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
revoke all on function public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text) from public;
grant execute on function public.confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text) to anon, authenticated;

-- ── 3. get_public_shop_order: bekräftelsen får sitt ordernummer ────────────
-- Bekräftelsesidan visade en uuid. Nu bär svaret order_no (numret), payment_method
-- (vad kunden valde) och fraktens NAMN (så kvittoraden kan skriva "Bud samma dag").
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
  v_ship_name text;
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

  select so.name into v_ship_name
    from public.shop_shipping_options so where so.id = v_order.shipping_option_id;

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
    'order_no', v_order.order_no,
    'payment_method', v_order.payment_method,
    'shipping_name', v_ship_name,
    'payments_enabled', v_pay_on, 'stripe_charges_enabled', v_charges,
    'requires_payment', (coalesce(v_pay_on,false) and coalesce(v_charges,false))
  );
end;
$$;
revoke all on function public.get_public_shop_order(uuid,text) from public;
grant execute on function public.get_public_shop_order(uuid,text) to anon, authenticated;
