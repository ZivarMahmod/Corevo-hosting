-- ============================================================================
-- 0057 — CLAUDE DESIGN-MALLARNA FÅR SIN VERKLIGHET (goal-64)
--
-- Zivar: "om plattformen inte har den — se till att plattformen får dessa och att
-- de möter de mockade delarna. Inget får gå mista. Dessa filer exakt som de är ska
-- kunna vara verkliga i plattformen. Det får inte vara något som inte är därbara
-- för de är mock och vi inte har de nu. Dessa kommer kanske lägga till saker vi
-- inte har — ja, men då ska de tillkomma i verkligheten med, i databasen om de
-- behövs."
--
-- De 12 levererade .dc.html-mallarna visar funktioner som motorn saknade. En kartläggning
-- (alla 12 filers `class Component extends DCLogic` mot schemat) gav 19 luckor. Den här
-- migrationen bygger DATAT för dem. Koden (routes, vyer, actions, admin) följer i samma
-- goal — men utan kolumnerna kan mallen bara ljuga eller amputeras, och båda är förbjudna.
--
-- Inget droppas, inget skrivs över (build-once-never-delete). IDEMPOTENT.
-- ============================================================================

-- ── 1. shop_products: kategori, badge, jämförelsepris, "från"-pris ──────────
-- `services` fick det här redan i 0046 (badge/sale_price_cents) — produkterna låg
-- efter. Kategorin är det som gör butikens filterchips sanna (7 av 12 mallar renderar
-- dem: calytrix "Buketter/Rosor/Säsong", kalla "Rengöring/Serum/Verktyg", siluett
-- "Schampo/Vård/Styling"). Utan kolumnen kunde mallarna bara utelämna raden.
alter table public.shop_products
  add column if not exists category text,                 -- fri text; null = ofiltrerad
  add column if not exists badge text,                    -- "Bästsäljare" · "DROP 27" · "Nyss inkommet"
  add column if not exists compare_at_price_cents integer -- föregående pris → ▲/▼/— (blomstertorgets kurstavla)
    check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  add column if not exists price_from boolean not null default false; -- "fr. 950 kr" (aurora/eloria)

create index if not exists shop_products_tenant_category_idx
  on public.shop_products (tenant_id, category) where category is not null;

-- ── 2. blog_posts: tagg ─────────────────────────────────────────────────────
-- 8+ mallar renderar en liten etikett över rubriken ("Torgliv", "Skötselråd",
-- "Bakom kulisserna"). Ren presentation — men den måste komma ur kundens inlägg.
alter table public.blog_posts
  add column if not exists tag text;

-- ── 3. staff: presentationsfälten som teamsidan kräver ──────────────────────
-- De tre salong-mallarna har `team` som egen nav-punkt, och HANDOFF §4 är uttrycklig:
-- "teamkorten och prisraderna förifyller bokningen via bookAs() — behåll den kopplingen".
-- staff hade title/avatar_url/show_on_site men varken kortnamn, specialitet eller bio.
alter table public.staff
  add column if not exists short_name text,   -- "Vera" — används i bokningens förifyllnad
  add column if not exists specialties text,  -- "Korta klipp · Siluetter · Konsultation"
  add column if not exists bio text;

-- ── 4. shop_shipping_options: leveransvalen ─────────────────────────────────
-- ALLA 12 mallar har ett leveranssteg med tre val och ett pris ("Bud samma dag 79 kr",
-- "Hämta i studion — Fritt", "Leverans imorgon 59 kr"). Motorn hade EN fulfilment-variant
-- per kund (kunden valde ingenting) och shop_orders.shipping_cents sattes alltid 0 — dvs.
-- kassans totalsumma var osann så fort designen visade frakt. Nu äger kunden sina val.
create table if not exists public.shop_shipping_options (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,                              -- 'bud' | 'hamta' | 'imorgon' …
  name        text not null,                              -- "Bud samma dag (före kl 14)"
  description text,                                       -- "Beställ före kl 14, levereras 16–21"
  cost_cents  integer not null default 0 check (cost_cents >= 0), -- 0 = "Fritt"
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  unique (tenant_id, key)
);
create index if not exists shop_shipping_options_tenant_idx
  on public.shop_shipping_options (tenant_id, active, sort_order);

alter table public.shop_shipping_options enable row level security;

-- Publik LÄSNING av aktiva val (storefrontens kassa körs som anon, samma fence som
-- shop_products: app-lagret filtrerar på tenant_id, RLS isolerar inte anon).
drop policy if exists shop_shipping_options_public_read on public.shop_shipping_options;
create policy shop_shipping_options_public_read on public.shop_shipping_options
  for select using (active = true);

-- Kundens egen admin skriver sina val (private.tenant_id() = tenant-fencen).
drop policy if exists shop_shipping_options_tenant_all on public.shop_shipping_options;
create policy shop_shipping_options_tenant_all on public.shop_shipping_options
  for all using (tenant_id = private.tenant_id())
  with check (tenant_id = private.tenant_id());

-- ── 5. shop_orders: valt leveranssätt, betalsätt, läsbart ordernummer ───────
-- payment_method: mallarna visar Kort · Swish · Klarna · PayPal · Apple Pay med villkorad
-- hinttext (HANDOFF §4, står som `verbatim` i alla 12 manifest). Kolumnen lagrar VAD kunden
-- valde; provider-integrationen ligger i koden.
-- order_no: bekräftelsesidan visar designens "#OX-4821" / "No. E-1204" / "N°..." — inte en uuid.
alter table public.shop_orders
  add column if not exists shipping_option_id uuid references public.shop_shipping_options(id) on delete set null,
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('card','swish','klarna','paypal','applepay')),
  add column if not exists order_no text;

create unique index if not exists shop_orders_tenant_order_no_idx
  on public.shop_orders (tenant_id, order_no) where order_no is not null;

-- ── 6. contact_messages: kontaktformuläret ─────────────────────────────────
-- Minst 5 mallar ritar namn/e-post/meddelande + "Skicka". Motorn hade ingen endpoint, så
-- agenterna utelämnade hela högerspalten ("en submit som inte skickar något är värre än
-- inget formulär"). Samma anon-intake-fence som offert_requests (0033).
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  subject    text,
  message    text not null,
  status     text not null default 'new' check (status in ('new','read','archived')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_tenant_idx
  on public.contact_messages (tenant_id, status, created_at desc);

alter table public.contact_messages enable row level security;

-- Anon FÅR skriva (gästen som fyller i formuläret). Tenant-id sätts SERVER-side ur
-- middleware-headern, aldrig av klienten — precis som offert-intaken.
drop policy if exists contact_messages_public_insert on public.contact_messages;
create policy contact_messages_public_insert on public.contact_messages
  for insert with check (true);

-- Bara kunden själv läser sin inkorg.
drop policy if exists contact_messages_tenant_read on public.contact_messages;
create policy contact_messages_tenant_read on public.contact_messages
  for select using (tenant_id = private.tenant_id());

drop policy if exists contact_messages_tenant_write on public.contact_messages;
create policy contact_messages_tenant_write on public.contact_messages
  for update using (tenant_id = private.tenant_id())
  with check (tenant_id = private.tenant_id());

-- ── 7. gallery_items: galleriet ────────────────────────────────────────────
-- Alla 12 manifest har `galleri: { module: null, route: '/galleri' }`, och Ateljé Vinters
-- "rum iii — arkivet" länkar dit. Sidan fanns inte → nav-länken pekade på en 404.
-- Bilden bor i media_assets (kundens egna foton); raden bär bara mallens bildtext-fält.
create table if not exists public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  asset_id     uuid references public.media_assets(id) on delete set null,
  caption      text,   -- "samling nr 13 — ranunkel, sju stjälkar" · "Behandlingsrummet"
  tag          text,   -- siluett/snitt: "Klipp" · onyx: "FIG. 01 — MAGNOLIA NOIR"
  year_label   text,   -- ateljevinter: "juni 2026"
  aspect_ratio text,   -- '3/2' | '4/5' | '3/4' — mallens masonry-rytm
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists gallery_items_tenant_idx
  on public.gallery_items (tenant_id, active, sort_order);

alter table public.gallery_items enable row level security;

drop policy if exists gallery_items_public_read on public.gallery_items;
create policy gallery_items_public_read on public.gallery_items
  for select using (active = true);

drop policy if exists gallery_items_tenant_all on public.gallery_items;
create policy gallery_items_tenant_all on public.gallery_items
  for all using (tenant_id = private.tenant_id())
  with check (tenant_id = private.tenant_id());

-- Galleriet blir en EGEN modul (Zivar: "en av och på som jag kan välja för varje kund").
insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'galleri',
  'Galleri',
  '["gallery_items"]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'main'
)
on conflict (key) do update
  set name = excluded.name, owns_tables = excluded.owns_tables, updated_at = now();

-- ── 8. loyalty_plans: klubbens nivåer & prenumerationer ────────────────────
-- Källa har tre nivåer (Droppe 195 / Källa 445 / Flod 745 kr per månad, var och en med sina
-- förmåner och en utmärkt "featured"-nivå). Siv & Säv har "Söndagsklubben" per leverans.
-- Lojalitet-modulen hade bara points/stämpelkort — ingen prisbärande nivå.
create table if not exists public.loyalty_plans (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,                       -- "Droppe" · "Källa" · "Flod"
  price_cents integer not null default 0 check (price_cents >= 0),
  interval    text not null default 'month'
    check (interval in ('month','delivery','visit','year')),  -- "per månad" · "per leverans"
  perks       jsonb not null default '[]'::jsonb,  -- ["En ritual i månaden", "10% i Apoteket"]
  featured    boolean not null default false,      -- mallens markerade mittennivå
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists loyalty_plans_tenant_idx
  on public.loyalty_plans (tenant_id, active, sort_order);

alter table public.loyalty_plans enable row level security;

drop policy if exists loyalty_plans_public_read on public.loyalty_plans;
create policy loyalty_plans_public_read on public.loyalty_plans
  for select using (active = true);

drop policy if exists loyalty_plans_tenant_all on public.loyalty_plans;
create policy loyalty_plans_tenant_all on public.loyalty_plans
  for all using (tenant_id = private.tenant_id())
  with check (tenant_id = private.tenant_id());

-- ── 8b. loyalty_members: MEDLEMSKAPET — designens joinClub() blir sann ──────
-- ALLA 12 mallar har en "GÅ MED"-knapp (`onClick="{{ joinClub }}"`). I mocken sätter den
-- bara `clubJoined: true` i mallens state — inget lämnar sidan. Motorn hade ingenting att
-- ta emot den med: loyalty_ledger (0016) är EARN-ONLY (points_delta + booking_id, skrivs
-- bara av SECURITY DEFINER vid slutfört besök) och bär inget medlemskap. Utan den här
-- tabellen kunde knappen bara ljuga (låtsad tack-ruta) eller amputeras — båda förbjudna.
--
-- EN rad per (tenant, kund). Kunden är public.customers (0011), samma entitet som
-- bokningen skapar — klubbmedlemmen och gästen som bokar är SAMMA person, annars får
-- kunden två kundregister som aldrig möts.
create table if not exists public.loyalty_members (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)   on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  -- Vald nivå (Källas Droppe/Källa/Flod). null = klubb utan nivåer (stämpelkort/poäng).
  plan_id     uuid references public.loyalty_plans(id) on delete set null,
  -- Var medlemskapet kom ifrån (klubbsidan idag; kassan/bokningen kan följa).
  source      text not null default 'klubb',
  status      text not null default 'active' check (status in ('active','cancelled')),
  joined_at   timestamptz not null default now(),
  -- EN medlem per kund och kund-tenant → "gå med" två gånger med samma e-post uppdaterar
  -- raden i stället för att spränga (idempotent, se join_loyalty_club nedan).
  unique (tenant_id, customer_id)
);
create index if not exists loyalty_members_tenant_idx
  on public.loyalty_members (tenant_id, status, joined_at desc);

alter table public.loyalty_members enable row level security;

-- INGEN anon-policy: gästen skriver ALDRIG direkt (raden pekar på customers, som anon
-- inte får röra). Vägen in är join_loyalty_club() nedan — SECURITY DEFINER, precis som
-- create_public_booking (0015). Bara kunden själv läser sin medlemslista.
drop policy if exists loyalty_members_tenant_all on public.loyalty_members;
create policy loyalty_members_tenant_all on public.loyalty_members
  for all using (tenant_id = private.tenant_id())
  with check (tenant_id = private.tenant_id());

-- ── 8c. join_loyalty_club(): anon-intaget bakom en definer-funktion ─────────
-- Mönstret är create_public_booking (0015) ORDAGRANT: anon får EXECUTE, funktionen
-- resolverar tenanten ur slug:en själv, gatar modulen SERVER-side, återanvänder
-- private.resolve_customer_id() (samma gäst-dedup på contact_hash som bokningen — en
-- e-post som redan bokat blir INTE en andra kundrad) och skriver EN rad.
--
-- Varför en funktion och inte en insert från app-lagret: public.customers RLS är
-- `for all to authenticated` — anon kan varken läsa eller skapa en kund. Ett anon-intag
-- som skulle skriva customers direkt hade krävt en permissiv anon-policy på hela
-- kundregistret. Det vore att öppna PII-tabellen för att få in en e-postadress.
create or replace function public.join_loyalty_club(
  p_tenant_slug text,
  p_email       text,
  p_name        text default null,
  p_plan        uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant   uuid;
  v_customer uuid;
  v_state    text;
  v_id       uuid;
begin
  if coalesce(btrim(p_email), '') = '' then
    raise exception 'email_required' using errcode = 'P0002';
  end if;

  select t.id into v_tenant from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002'; end if;

  -- Modulen re-gatas HÄR också (app-lagret gatar redan, men lagret är bypassbart —
  -- det här är det inte). En stängd klubb tar aldrig emot en medlem.
  select tm.state into v_state from public.tenant_modules tm
   where tm.tenant_id = v_tenant and tm.module_key = 'lojalitet';
  if v_state is distinct from 'live' then
    raise exception 'module_not_live' using errcode = 'P0001';
  end if;

  -- Nivån måste vara kundens EGEN och aktiv (en tampererad plan_id från en annan tenant
  -- får aldrig fastna på raden). Okänd nivå → null, inte fel: medlemskapet är det viktiga.
  if p_plan is not null and not exists (
    select 1 from public.loyalty_plans lp
     where lp.id = p_plan and lp.tenant_id = v_tenant and lp.active = true
  ) then
    p_plan := null;
  end if;

  v_customer := private.resolve_customer_id(v_tenant, null, nullif(btrim(p_name),''), btrim(p_email), null);
  if v_customer is null then raise exception 'customer_unresolved' using errcode = 'P0002'; end if;

  -- IDEMPOTENT: samma e-post två gånger → samma rad, uppdaterad nivå. Ingen dubblett,
  -- inget fel i ansiktet på en kund som klickade två gånger.
  insert into public.loyalty_members (tenant_id, customer_id, plan_id, source, status)
  values (v_tenant, v_customer, p_plan, 'klubb', 'active')
  on conflict (tenant_id, customer_id) do update
    set plan_id = coalesce(excluded.plan_id, public.loyalty_members.plan_id),
        status  = 'active'
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.join_loyalty_club(text,text,text,uuid) from public;
grant execute on function public.join_loyalty_club(text,text,text,uuid) to anon, authenticated;

-- ── 9. gift_cards: leveranssätt ────────────────────────────────────────────
-- Aurora har `giftModes = ['Digitalt', 'Inslaget i butik']`. Kolumnen finns inte i 0036.
alter table public.gift_cards
  add column if not exists delivery_mode text
    check (delivery_mode is null or delivery_mode in ('digital','in_store'));
