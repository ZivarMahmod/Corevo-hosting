-- ============================================================================
-- 0058 — KORGEN BÄR MER ÄN PRODUKTER (goal-64)
--
-- Alla 12 Claude Design-paket lägger presentkort i VARUKORGEN, och Calytrix lägger
-- dessutom kursplatser där:
--
--   addGift: () => this.addToCart({ id:'gift'+amount, name:'Presentkort 500 kr', priceNum: amount })
--   add:     () => this.addToCart({ id: k.id, name: k.name + ' (kursplats)', priceNum: k.price })
--
-- Motorn kunde inte det. En korgrad (CartLine) KRÄVDE en shop_products-variant, och
-- shop_order_items kunde bara peka på en produkt. Presentkort (0036) var dessutom INERT
-- ("⚠ INGA pengar rör sig här — köp/utfärdande/inlösen kopplas först när betal-rails
-- godkänns") och kursplatsen anmäldes UTAN betalning (0052: "avgiften visas och bekräftas,
-- betalas på plats"). Mallarna kunde alltså bara ljuga (en köpknapp som inte köper) eller
-- amputeras. Båda är förbjudna. Betal-rälsen tänds nu → korgen görs BÄRIG.
--
-- VAD SOM BYGGS
--   1. shop_order_items.item_type ('product' | 'giftcard' | 'event') + de fält varje sort
--      behöver. DEFAULT 'product' → varenda befintlig rad och varje befintlig kodväg är
--      OFÖRÄNDRAD (produkt-korgen får inte ändra beteende — hård regel).
--   2. tenant_events.reserved_qty — SAMMA hold-mönster som shop_product_variants.
--      Presentkort har inget lager (oändligt), men en KURSPLATS har det: `capacity`.
--      Utan hold kan två personer lägga sista platsen i korgen och båda betala.
--   3. Utfärdandet: en BETALD order föder sina värdebärare — gift_cards-raden (kod + saldo)
--      och event_registrations-raden — inuti den befintliga en-gångs-latchen
--      (shop_orders.stock_committed). Webhooken kan levereras två gånger; latchen +
--      UNIQUE(order_item_id) gör utfärdandet idempotent PÅ TVÅ NIVÅER.
--
-- HÅRD REGEL — BELOPPET SLÅS ALLTID UPP SERVER-SIDE. Klienten skickar ett VAL
-- ("500 kr", "denna kurs"), aldrig ett pris. reserve_shop_order validerar valet mot
-- kundens konfigurerade belopp (tenant_modules.config) resp. kursens price_cents och
-- räknar totalen själv — exakt som den redan gör för produktvarianter.
--
-- MODUL-GATING ÄR HELIG. En presentkortsrad avvisas om presentkort-modulen inte är live.
-- En kursrad avvisas om kurser-modulen inte är live ELLER om kunden tar betalt PÅ PLATS
-- (config.payment <> 'checkout') — då är den befintliga anmälningsvägen (KursAnmalanForm)
-- fortfarande den enda, oförändrad.
--
-- Additivt, idempotent, build-once-never-delete. Inget droppas, inget skrivs över.
-- ============================================================================
set search_path = public;

-- ── 1. shop_order_items: radtypen ──────────────────────────────────────────
-- product_id är redan nullbar (0032), variant_id likaså (0042) → en presentkortsrad
-- kan bära null i båda utan schemaändring. Det som saknades var att SÄGA vad raden är,
-- och att peka på det den utfärdar.
alter table public.shop_order_items
  add column if not exists item_type text not null default 'product',
  -- Utfärdat presentkort (sätts vid commit). null före betalning — kortet FÖDS när
  -- pengarna finns, aldrig innan.
  add column if not exists gift_card_id uuid references public.gift_cards(id) on delete set null,
  -- Presentkortsradens VAL (belopp ligger i unit_price_cents, server-uppslaget).
  -- Aurora: giftModes = ['Digitalt','Inslaget i butik'] → gift_cards.delivery_mode (0057).
  add column if not exists gift_delivery_mode  text,
  add column if not exists gift_recipient_name text,
  add column if not exists gift_recipient_email text,
  add column if not exists gift_message text,
  -- Kursplatsraden pekar på tillfället; quantity = antal platser.
  add column if not exists event_id uuid references public.tenant_events(id) on delete set null,
  -- Skapad anmälan (sätts vid commit) — idempotens-ankaret, se punkt 4.
  add column if not exists event_registration_id uuid references public.event_registrations(id) on delete set null;

do $$
begin
  alter table public.shop_order_items
    add constraint shop_order_items_item_type_check
    check (item_type in ('product','giftcard','event'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.shop_order_items
    add constraint shop_order_items_gift_delivery_mode_check
    check (gift_delivery_mode is null or gift_delivery_mode in ('digital','in_store'));
exception when duplicate_object then null;
end $$;

create index if not exists shop_order_items_event_idx on public.shop_order_items (event_id)
  where event_id is not null;
create index if not exists shop_order_items_type_idx on public.shop_order_items (order_id, item_type);

-- ── 2. gift_cards: kortet vet vilken order-rad som födde det ────────────────
-- order_item_id är UNIK → utfärdandet kan aldrig skapa två kort för samma korgrad,
-- hur många gånger webhooken än levereras. Det är den hårda idempotens-garantin;
-- stock_committed-latchen är den mjuka (och snabba) första vakten.
alter table public.gift_cards
  add column if not exists order_id      uuid references public.shop_orders(id) on delete set null,
  add column if not exists order_item_id uuid references public.shop_order_items(id) on delete set null,
  add column if not exists issued_at     timestamptz,
  -- Mejl-latch: mejlet skickas av TS-lagret (lib/notifications), inte av DB:n. Kolumnen
  -- gör "skicka en gång" möjligt — mejlaren tar raden med ett villkorat UPDATE
  -- (emailed_at is null → now()) och skickar BARA om den vann kapplöpningen.
  add column if not exists emailed_at    timestamptz;

create unique index if not exists gift_cards_order_item_uniq
  on public.gift_cards (order_item_id) where order_item_id is not null;
create index if not exists gift_cards_order_idx on public.gift_cards (order_id) where order_id is not null;

-- ── 3. tenant_events: lager-holdet för en KURSPLATS ─────────────────────────
-- Speglar shop_product_variants.reserved_qty ORDAGRANT. capacity = on-hand,
-- reserved_qty = platser som ligger i en pågående/obetald order, och de redan
-- BEKRÄFTADE platserna är summan av event_registrations.party_size (status confirmed).
--   ledigt = capacity − bekräftade − reserved_qty
-- Utan den mellersta termen kan två köpare hålla samma sista plats.
alter table public.tenant_events
  add column if not exists reserved_qty integer not null default 0 check (reserved_qty >= 0);

-- ── 4. event_registrations: anmälan som föddes ur en order ──────────────────
-- Den befintliga (obetalda) anmälningsvägen skriver rader UTAN order_item_id — den är
-- helt orörd. En BETALD kursplats skriver en rad MED order_item_id, och den unika
-- indexen gör den insert:en idempotent.
alter table public.event_registrations
  add column if not exists order_item_id uuid references public.shop_order_items(id) on delete set null;

create unique index if not exists event_registrations_order_item_uniq
  on public.event_registrations (order_item_id) where order_item_id is not null;

-- ── 5. Presentkortskod ur kundens egen serie ────────────────────────────────
-- Blomstertorget: giftSerial: '1962-' + … → prefixet är KUNDENS
-- (tenant_modules.config.code_prefix). Koden är unik per tenant (index i 0036).
-- Alfabetet utelämnar 0/O/1/I/L — en kod läses ofta upp i telefon eller skrivs av
-- från ett papper, och där är de fyra tecknen samma tecken.
create or replace function public._generate_gift_code(p_tenant uuid, p_prefix text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_prefix text := coalesce(nullif(btrim(coalesce(p_prefix, '')), ''), '');
  v_code   text;
  v_try    int := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := v_prefix;
    for i in 1..10 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.gift_cards g where g.tenant_id = p_tenant and g.code = v_code
    );
    -- 30^10 möjligheter: en kollision är i praktiken omöjlig. Loopen är ändå hård-
    -- begränsad, så en trasig random-källa aldrig kan hänga en betalningswebhook.
    if v_try >= 12 then
      raise exception 'gift_code_exhausted' using errcode = 'P0001';
    end if;
  end loop;
  return v_code;
end;
$$;
revoke all on function public._generate_gift_code(uuid,text) from public;
grant execute on function public._generate_gift_code(uuid,text) to service_role;

-- ── 6. Lediga platser på ett tillfälle (EN sanning, återanvänd överallt) ────
create or replace function public.event_seats_left(p_event uuid)
returns integer
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_ev    record;
  v_taken integer;
begin
  select id, capacity, reserved_qty into v_ev from public.tenant_events where id = p_event;
  if v_ev.id is null then return 0; end if;
  select coalesce(sum(r.party_size), 0) into v_taken
    from public.event_registrations r
   where r.event_id = p_event and r.status = 'confirmed';
  return greatest(0, v_ev.capacity - v_taken - v_ev.reserved_qty);
end;
$$;
revoke all on function public.event_seats_left(uuid) from public;
grant execute on function public.event_seats_left(uuid) to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. reserve_shop_order — SAMMA SIGNATUR, radtyp i p_items.
--
-- Elementens form (kind saknas ⇒ 'product' ⇒ EXAKT dagens beteende, bit för bit):
--   produkt:     {"variant_id":"<uuid>", "quantity": 2}
--   presentkort: {"kind":"giftcard", "amount": 500, "delivery_mode":"digital",
--                 "recipient_name":"…", "recipient_email":"…", "message":"…"}
--   kursplats:   {"kind":"event", "event_id":"<uuid>", "quantity": 2}
--
-- `amount` är ett VAL i hela kronor, inte ett pris: det måste finnas i kundens egen
-- belopp-lista, annars avvisas raden. Kursens pris läses ur tillfället. Klienten kan
-- alltså inte köpa ett presentkort på 1 kr eller en kurs för noll.
-- ════════════════════════════════════════════════════════════════════════════
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
  v_kind      text;
  v_variant   record;
  v_event     record;
  v_qty       integer;
  v_prod_name text;
  v_currency  text := 'SEK';
  v_subtotal  integer := 0;
  v_count     integer := 0;
  -- presentkort
  v_gift_cfg   jsonb;
  v_gift_state text;
  v_amounts    jsonb;
  v_amount     integer;
  v_mode       text;
  v_price      integer;
  -- kurser
  v_kurs_cfg   jsonb;
  v_kurs_state text;
  v_left       integer;
  v_taken      integer;
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

  perform public.prune_expired_shop_reserves(); -- frigör utgångna holds först (produkt OCH kurs)

  -- Deterministisk lås-ordning (undvik deadlock vid omvänd cart-ordning): lås ALLA
  -- berörda varianter sorterat på id INNAN rad-loopen rör dem. Oförändrat från 0042.
  perform 1 from public.shop_product_variants
   where tenant_id = v_tenant
     and id in (select (e->>'variant_id')::uuid from jsonb_array_elements(p_items) e
                 where coalesce(e->>'kind','product') = 'product' and e ? 'variant_id')
   order by id
   for update;

  -- Samma sak för tillfällena: låsta i id-ordning, så två samtidiga korgar med samma
  -- två kurser inte kan låsa varandra i motsatt ordning.
  perform 1 from public.tenant_events
   where tenant_id = v_tenant
     and id in (select (e->>'event_id')::uuid from jsonb_array_elements(p_items) e
                 where e->>'kind' = 'event' and e ? 'event_id')
   order by id
   for update;

  insert into public.shop_orders (tenant_id, fulfilment, status, session_token, expires_at,
                                  subtotal_cents, total_cents, currency)
  values (v_tenant, p_fulfilment, 'reserved', p_token, now() + make_interval(mins => p_ttl_min),
          0, 0, 'SEK')
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_kind := coalesce(v_item->>'kind', 'product');

    -- ═══ PRODUKT — oförändrad kod från 0042, rad för rad. ═══
    if v_kind = 'product' then
      v_qty := coalesce((v_item->>'quantity')::int, 0);
      if v_qty <= 0 then raise exception 'bad_quantity' using errcode = '22023'; end if;

      select * into v_variant from public.shop_product_variants
       where id = (v_item->>'variant_id')::uuid and tenant_id = v_tenant and active = true;
      if v_variant.id is null then raise exception 'invalid_variant' using errcode = 'P0002'; end if;

      if v_variant.stock is not null and (v_variant.stock - v_variant.reserved_qty) < v_qty then
        raise exception 'out_of_stock' using errcode = '23P01';
      end if;

      update public.shop_product_variants
         set reserved_qty = reserved_qty + v_qty
       where id = v_variant.id;

      select p.name into v_prod_name from public.shop_products p where p.id = v_variant.product_id;
      v_prod_name := coalesce(v_prod_name, v_variant.name)
                     || case when v_variant.name is not null and v_variant.name <> 'Standard'
                             then ' — ' || v_variant.name else '' end;

      insert into public.shop_order_items (tenant_id, order_id, product_id, variant_id,
                                           product_name, unit_price_cents, quantity, item_type)
      values (v_tenant, v_order, v_variant.product_id, v_variant.id,
              v_prod_name, v_variant.price_cents, v_qty, 'product');

      v_currency := v_variant.currency;
      v_subtotal := v_subtotal + (v_variant.price_cents * v_qty);
      v_count := v_count + 1;

    -- ═══ PRESENTKORT — inget lager, men beloppet MÅSTE vara kundens eget. ═══
    elsif v_kind = 'giftcard' then
      -- Modul-gate SERVER-SIDE. App-lagret gatar redan; det här lagret är inte bypassbart.
      select tm.state, tm.config into v_gift_state, v_gift_cfg
        from public.tenant_modules tm
       where tm.tenant_id = v_tenant and tm.module_key = 'presentkort';
      if v_gift_state is distinct from 'live' then
        raise exception 'module_not_live' using errcode = 'P0001';
      end if;

      -- Kundens belopp-lista. `amounts` är den nya nyckeln (goal-64); `amount_presets`
      -- är 0036:s ursprungliga och läses som fallback så inga befintliga kunder tappar
      -- sina belopp. Saknas BÅDA → presentkort kan inte köpas (inget att välja på), och
      -- en TOM lista betyder uttryckligen "inga belopp" — inte "ge default".
      v_amounts := coalesce(v_gift_cfg->'amounts', v_gift_cfg->'amount_presets');
      if v_amounts is null or jsonb_typeof(v_amounts) <> 'array' or jsonb_array_length(v_amounts) = 0 then
        raise exception 'gift_amounts_not_configured' using errcode = 'P0001';
      end if;

      v_amount := coalesce((v_item->>'amount')::int, 0);
      if not exists (
        select 1 from jsonb_array_elements(v_amounts) a
         where jsonb_typeof(a) = 'number' and a::text::int = v_amount
      ) then
        -- Klienten hittade på ett belopp. Nej.
        raise exception 'invalid_gift_amount' using errcode = '22023';
      end if;

      -- Beloppen lagras i HELA KRONOR (0036 amount_presets), ordern i ören.
      v_price := v_amount * 100;
      v_mode := nullif(btrim(coalesce(v_item->>'delivery_mode','')), '');
      if v_mode is not null and v_mode not in ('digital','in_store') then
        raise exception 'invalid_delivery_mode' using errcode = '22023';
      end if;
      -- Utelämnat val → kundens konfigurerade variant (0036 fulfilment: digital|physical).
      if v_mode is null then
        v_mode := case when v_gift_cfg->>'fulfilment' = 'physical' then 'in_store' else 'digital' end;
      end if;

      -- Ett presentkort är ETT kort. Kvantitet är alltid 1 — vill man ha två köper man
      -- två rader (annars måste ett "3 st"-köp utfärda tre koder ur en rad, och då
      -- spricker order_item_id som idempotens-nyckel).
      insert into public.shop_order_items (tenant_id, order_id, product_name, unit_price_cents,
                                           quantity, item_type, gift_delivery_mode,
                                           gift_recipient_name, gift_recipient_email, gift_message)
      values (v_tenant, v_order,
              'Presentkort ' || v_amount::text || ' kr', v_price, 1, 'giftcard', v_mode,
              nullif(btrim(coalesce(v_item->>'recipient_name','')), ''),
              nullif(btrim(coalesce(v_item->>'recipient_email','')), ''),
              nullif(btrim(coalesce(v_item->>'message','')), ''));

      v_subtotal := v_subtotal + v_price;
      v_count := v_count + 1;

    -- ═══ KURSPLATS — priset är kursens, och platsen HÅLLS som lager. ═══
    elsif v_kind = 'event' then
      select tm.state, tm.config into v_kurs_state, v_kurs_cfg
        from public.tenant_modules tm
       where tm.tenant_id = v_tenant and tm.module_key = 'kurser';
      if v_kurs_state is distinct from 'live' then
        raise exception 'module_not_live' using errcode = 'P0001';
      end if;
      -- Kunden tar betalt PÅ PLATS → kursplatsen hör inte hemma i en kassa. Den
      -- befintliga anmälningsvägen (KursAnmalanForm) är fortfarande den enda.
      if coalesce(v_kurs_cfg->>'payment', 'onsite') <> 'checkout' then
        raise exception 'kurs_payment_not_checkout' using errcode = 'P0001';
      end if;

      v_qty := coalesce((v_item->>'quantity')::int, 0);
      if v_qty <= 0 or v_qty > 20 then raise exception 'bad_quantity' using errcode = '22023'; end if;

      -- Raden är redan låst (FOR UPDATE ovan) → läsningen nedan kan inte tävla.
      select * into v_event from public.tenant_events
       where id = (v_item->>'event_id')::uuid and tenant_id = v_tenant;
      if v_event.id is null or v_event.status <> 'open' or v_event.starts_at < now() then
        raise exception 'invalid_event' using errcode = 'P0002';
      end if;

      select coalesce(sum(r.party_size), 0) into v_taken
        from public.event_registrations r
       where r.event_id = v_event.id and r.status = 'confirmed';
      v_left := v_event.capacity - v_taken - v_event.reserved_qty;
      if v_left < v_qty then
        -- Samma felkod som slutsåld produkt → app-lagret behöver ingen ny gren.
        raise exception 'out_of_stock' using errcode = '23P01';
      end if;

      update public.tenant_events
         set reserved_qty = reserved_qty + v_qty
       where id = v_event.id;

      insert into public.shop_order_items (tenant_id, order_id, product_name, unit_price_cents,
                                           quantity, item_type, event_id)
      values (v_tenant, v_order, v_event.title || ' (kursplats)', v_event.price_cents, v_qty, 'event', v_event.id);

      v_subtotal := v_subtotal + (v_event.price_cents * v_qty);
      v_count := v_count + 1;

    else
      raise exception 'bad_item_kind' using errcode = '22023';
    end if;
  end loop;

  if v_count = 0 then raise exception 'empty_cart' using errcode = '22023'; end if;

  update public.shop_orders
     set subtotal_cents = v_subtotal, total_cents = v_subtotal, currency = v_currency
   where id = v_order;

  return v_order;
end;
$$;
revoke all on function public.reserve_shop_order(text,jsonb,text,text,integer) from public;
grant execute on function public.reserve_shop_order(text,jsonb,text,text,integer) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. _commit_shop_order_stock — nu utfärdar den ocksÅ VÄRDET.
--
-- Latchen (stock_committed) är oförändrad: en-gångs, oberoende av expires_at, körs
-- ALLTID medan ordern fortfarande håller sitt hold. Det är den som gör en dubbel-
-- levererad Stripe-webhook harmlös. Ovanpå den ligger UNIQUE(order_item_id) på både
-- gift_cards och event_registrations — bälte OCH hängslen, för det här är den enda
-- kodväg i systemet som skapar pengar och platser ur ingenting.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public._commit_shop_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  record;
  v_item   record;
  v_gift   uuid;
  v_reg    uuid;
  v_code   text;
  v_prefix text;
  v_cfg    jsonb;
begin
  -- en-gångs: gör inget om redan committat ELLER om holdet redan släppts (status bytt).
  select o.* into v_order from public.shop_orders o
   where o.id = p_order_id and o.stock_committed = false
     and o.status in ('reserved','awaiting_payment')
   for update;
  if v_order.id is null then
    return;
  end if;

  -- (a) PRODUKTER — oförändrat: held → committat.
  update public.shop_product_variants v
     set stock = case when v.stock is null then null else greatest(0, v.stock - oi.quantity) end,
         reserved_qty = greatest(0, v.reserved_qty - oi.quantity)
    from public.shop_order_items oi
   where oi.order_id = p_order_id and oi.variant_id = v.id and oi.item_type = 'product';

  select tm.config into v_cfg from public.tenant_modules tm
   where tm.tenant_id = v_order.tenant_id and tm.module_key = 'presentkort';
  v_prefix := nullif(btrim(coalesce(v_cfg->>'code_prefix', '')), '');

  for v_item in
    select * from public.shop_order_items
     where order_id = p_order_id and item_type in ('giftcard','event')
     order by created_at
  loop
    -- (b) PRESENTKORT — kortet FÖDS här, med kod och saldo. Aldrig innan pengarna finns.
    if v_item.item_type = 'giftcard' then
      v_code := public._generate_gift_code(v_order.tenant_id, v_prefix);
      insert into public.gift_cards (tenant_id, code, initial_amount_cents, balance_cents, currency,
                                     status, delivery_mode, recipient_name, recipient_email, message,
                                     order_id, order_item_id, issued_at)
      values (v_order.tenant_id, v_code, v_item.unit_price_cents, v_item.unit_price_cents,
              coalesce(v_order.currency, 'SEK'), 'active', v_item.gift_delivery_mode,
              coalesce(v_item.gift_recipient_name, v_order.customer_name),
              coalesce(v_item.gift_recipient_email, v_order.customer_email),
              v_item.gift_message, p_order_id, v_item.id, now())
      on conflict (order_item_id) where order_item_id is not null do nothing
      returning id into v_gift;

      -- Redan utfärdat (omlevererad webhook som slank förbi latchen) → hämta kortet
      -- i stället för att skapa ett andra. Två koder för ett köp = pengar ur luften.
      if v_gift is null then
        select id into v_gift from public.gift_cards where order_item_id = v_item.id;
      end if;
      update public.shop_order_items set gift_card_id = v_gift where id = v_item.id;

    -- (c) KURSPLATS — anmälan skapas, och holdet blir en riktig bokad plats.
    elsif v_item.item_type = 'event' and v_item.event_id is not null then
      insert into public.event_registrations (tenant_id, event_id, name, email, phone,
                                              party_size, message, status, order_item_id)
      values (v_order.tenant_id, v_item.event_id,
              coalesce(v_order.customer_name, 'Kund'), v_order.customer_email, v_order.customer_phone,
              least(greatest(v_item.quantity, 1), 20), null, 'confirmed', v_item.id)
      on conflict (order_item_id) where order_item_id is not null do nothing
      returning id into v_reg;
      if v_reg is null then
        select id into v_reg from public.event_registrations where order_item_id = v_item.id;
      else
        -- Holdet släpps BARA när vi faktiskt skapade anmälan — annars skulle en andra
        -- körning dra av platserna två gånger och öppna kursen för överbokning.
        update public.tenant_events
           set reserved_qty = greatest(0, reserved_qty - v_item.quantity)
         where id = v_item.event_id;
      end if;
      update public.shop_order_items set event_registration_id = v_reg where id = v_item.id;
    end if;
  end loop;

  update public.shop_orders set stock_committed = true, expires_at = null where id = p_order_id;
end;
$$;
revoke all on function public._commit_shop_order_stock(uuid) from public;
grant execute on function public._commit_shop_order_stock(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. release_shop_order + prune — kursplatsens hold måste också SLÄPPAS.
--    En övergiven korg med sista platsen i får aldrig låsa kursen för alltid.
-- ════════════════════════════════════════════════════════════════════════════
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
  if v_order.id is null then return; end if;

  if (select auth.role()) is distinct from 'service_role' then
    if p_token is null or v_order.session_token is null or v_order.session_token <> p_token then
      raise exception 'forbidden_order' using errcode = '42501';
    end if;
  end if;

  if v_order.status not in ('reserved','awaiting_payment') then return; end if; -- inget hold att släppa

  update public.shop_product_variants v
     set reserved_qty = greatest(0, v.reserved_qty - oi.quantity)
    from public.shop_order_items oi
   where oi.order_id = p_order_id and oi.variant_id = v.id and oi.item_type = 'product';

  update public.tenant_events e
     set reserved_qty = greatest(0, e.reserved_qty - oi.quantity)
    from public.shop_order_items oi
   where oi.order_id = p_order_id and oi.event_id = e.id and oi.item_type = 'event';

  update public.shop_orders set status = p_status, expires_at = null where id = p_order_id;
end;
$$;
revoke all on function public.release_shop_order(uuid,text,text) from public;
grant execute on function public.release_shop_order(uuid,text,text) to anon, authenticated, service_role;

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
     where oi.order_id = v_order.id and oi.variant_id = v.id and oi.item_type = 'product';

    update public.tenant_events e
       set reserved_qty = greatest(0, e.reserved_qty - oi.quantity)
      from public.shop_order_items oi
     where oi.order_id = v_order.id and oi.event_id = e.id and oi.item_type = 'event';

    update public.shop_orders set status = 'expired', expires_at = null where id = v_order.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.prune_expired_shop_reserves() from public;
grant execute on function public.prune_expired_shop_reserves() to anon, authenticated, service_role;

-- ── 10. Sanity (no-op) ─────────────────────────────────────────────────────
do $$
declare v_cols int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema = 'public'
     and ((table_name = 'shop_order_items' and column_name in ('item_type','gift_card_id','event_id'))
       or (table_name = 'tenant_events'    and column_name = 'reserved_qty')
       or (table_name = 'gift_cards'       and column_name in ('order_item_id','emailed_at')));
  raise notice '0058 korgens radtyper: %/6 kolumner på plats (item_type/gift_card_id/event_id/reserved_qty/order_item_id/emailed_at)', v_cols;
end $$;
