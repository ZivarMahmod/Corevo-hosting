-- ============================================================================
-- DRAFT 0011 — EJ APPLICERAD, kräver Zivars godkännande innan flytt till
-- packages/db (faktiskt: 5-Kod/supabase/migrations/) + apply.
-- ============================================================================
-- VAG0 kund-identitet + dependent-moduler, reconcilerad till EN additiv migration.
--
-- Innehåll (allt ADDITIVT — BUILD-ONCE-NEVER-DELETE, inga DROP/destruktiva ALTER):
--   KEYSTONE : public.customers + bookings.customer_id + kontakt-hash + PII-fn
--   M4       : customer_favorites + loyalty_ledger + private.current_customer_id()
--   M5       : customer_notes (internt klientkort) + GDPR-scrub-trigger
--   M6       : working_hour_slots + staff/services step/buffert + seed-funktion
--
-- ORÖRT (live-kontrakt): bookings.customer_profile_id lämnas exakt som i 0001/0010.
--   Den är RLS-nyckel (0010:49), app-filter (kund/bookings.ts:77), GDPR-nyckel
--   (lib/gdpr/erase.ts:42). customer_id är den NYA stabila identiteten parallellt.
--
-- KÖRORDNING (load-bearing — avviker MEDVETET från "tabeller→index→rls→policy→
-- backfill" i uppdraget eftersom CREATE POLICY parsar sina uttryck och CREATE
-- FUNCTION (language sql) validerar sin body vid skapande):
--   1. Tabeller (CREATE + ALTER ADD COLUMN)
--   2. Index (inkl. partiella unika)
--   3. Funktioner  (sql-fn behöver att tabellerna finns; policies behöver fn:erna)
--   4. Triggers    (behöver sina funktioner)
--   5. RLS enable
--   6. Policies    (behöver private.current_customer_id m.fl.)
--   7. Backfill    (idempotent; A inloggade före B gäster)
--
-- ⚠️ PRE-APPLY-BLOCKERARE (måste verifieras av Zivar INNAN apply):
--   (P1) pgcrypto-schema: customer_contact_hash anropar extensions.digest().
--        På Supabase Cloud bor pgcrypto vanligen i schema `extensions`. Är den i
--        `public` MÅSTE detta bytas till public.digest(...) ANNARS faller hela
--        migrationen vid CREATE FUNCTION (language sql validerar bodyn direkt).
--        Verifiera: select extnamespace::regnamespace from pg_extension
--                   where extname='pgcrypto';  (mot clylvowtowbtotrahuad)
--   (P2) GDPR-RÄCKVIDD (app-kod, INTE denna SQL, men BLOCKERANDE för PII-laglighet):
--        lib/gdpr/erase.ts:38-49 nollar idag BARA bookings (note→null,
--        customer_profile_id→null). Efter 0011 finns NY PII i public.customers
--        (full_name/email/phone/contact_hash) och i public.customer_notes som
--        erase.ts INTE når. M5-scrub-triggern fyrar bara när customers.status
--        sätts till 'anonymized' — vilket erase.ts inte gör idag. Att applicera
--        0011 utan att utöka erase.ts = en GDPR-regression införd av denna migration.
--        Måste fixas i app-lagret i samma release. Se VAG0-design.md (e).
-- ============================================================================


-- ############################################################################
-- FAS 1 — TABELLER
-- ############################################################################

-- ── 1.1 KEYSTONE: stabil per-tenant kund-identitet ──────────────────────────
-- id = eget surrogat (INTE auth.uid()): låter gästrad finnas utan auth-user och
-- låter en gäst som senare registrerar sig länkas till sin auth-user / merge:as.
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  -- Identitets-länkar (en av dem, eller båda när en gäst sen registrerats):
  auth_user_id  uuid references public.users(id) on delete set null,  -- inloggad kund (= auth.uid())
  contact_hash  text,                                                 -- gäst-dedup: hash(tenant||normaliserad e-post|telefon)

  -- Kund-styrt visningsnamn (M6 §4: "kan visa valt namn / initial").
  display_name  text,                                                 -- valfritt; null ⇒ UI faller tillbaka på maskerat/initial
  name_hidden   boolean not null default false,                       -- true ⇒ visa aldrig fullt namn, bara display_name/initial

  -- KONTAKT-PII (minimerad, tidsbunden — exponeras BARA via get_customer_contact).
  -- Ligger på raden men läs-skyddas på app-/funktionslagret (RLS kan ej tids-gata
  -- en kolumn). full_name = senast kända fulla namn (gallras vid GDPR-erase).
  full_name     text,
  email         text,
  phone         text,

  status        text not null default 'active'
                  check (status in ('active', 'anonymized')),         -- anonymized = GDPR-skrubbad stub
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

-- ── 1.2 KEYSTONE: NY identitets-länk på bookings (additiv, nullable, egen FK) ──
-- customer_profile_id LÄMNAS ORÖRD. customer_id är det stabila bandet framåt.
alter table public.bookings
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- ── 1.3 M4: customer_favorites — kund favoritmarkerar frisör ELLER tjänst ────
-- Riktiga FK:er + kind-diskriminator + CHECK. on delete cascade → favoriten
-- städas auto när staff/service tas bort. tenant_id denormaliserad (krävs av RLS).
create table if not exists public.customer_favorites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)   on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,

  kind        text not null check (kind in ('staff', 'service')),
  -- Exakt EN av kolumnerna satt, matchande kind (referensintegritet + auto-städ):
  staff_id    uuid references public.staff(id)    on delete cascade,
  service_id  uuid references public.services(id) on delete cascade,

  created_at  timestamptz not null default now(),

  check (
    (kind = 'staff'   and staff_id   is not null and service_id is null) or
    (kind = 'service' and service_id is not null and staff_id   is null)
  )
);

-- ── 1.4 M4: loyalty_ledger — DURABEL, append-only poäng-transaktioner ────────
-- Modellerad på audit_log (0002:75) MEN read-only för authenticated: skrivs BARA
-- via service-role / SECURITY DEFINER (RLS-bypass). Saldo + tier HÄRLEDS
-- (sum(points_delta); tier = f(lifetime, trösklar i tenant_settings.settings JSON))
-- — INGA lagrade saldo/tier-kolumner. points_delta signerad: + intjäning, − inlösen.
create table if not exists public.loyalty_ledger (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id)   on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  -- Bok-bandet (nullable: manuella/bonus-justeringar saknar bokning). on delete
  -- set null → behåll poäng-historiken om bokningen senare anonymiseras/raderas.
  booking_id    uuid references public.bookings(id) on delete set null,

  points_delta  int  not null,                       -- signerad: +intjäning / −inlösen
  reason        text not null
                  check (reason in ('earn_completed', 'redeem', 'adjustment')),
  note          text,                                 -- INGEN direkt PII (se GDPR-not)
  created_at    timestamptz not null default now()
);

-- ── 1.5 M5: customer_notes — ETT internt klientkort per (tenant, kund) ───────
-- Persistent, inte append-many: "per kund, följer med till nästa besök" +
-- strukturerade prefs = ett bestående kort som uppdateras. STRIKT INTERNT — visas
-- ALDRIG på kundens storefront/M4 (ingen kund-läsbar RLS, se FAS 6).
-- customer_id FK = customers(id), NOT NULL, on delete cascade (en NOT NULL-kolumn
-- kan inte vara on delete set null). GDPR-radering hanteras av scrub-triggern i
-- FAS 4 (keystone DELETE:ar aldrig customers hårt → cascade fyrar inte).
create table if not exists public.customer_notes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id)   on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,

  -- ── STRUKTURERADE preferensfält (innehållsskyddat, M5 §2.3) ──
  -- Taggade arrayer, inte fri text → svårt att skriva olämpligt; lätt att rendera
  -- som chips i klientkortet. Exakt form finputsas vid bygge (text[] rätt nu).
  preferences   text[] not null default '{}',    -- t.ex. {'kort sidor','4 på toppen','fön efter'}
  allergies     text[] not null default '{}',    -- t.ex. {'PPD-blekning','parfymerat'}
  products      text[] not null default '{}',    -- använda/föredragna produkter

  -- Strukturerade enum-fält (vanliga klientkorts-attribut, vaktade).
  hair_type     text check (hair_type   in ('rakt','vågigt','lockigt','afro')),
  hair_length   text check (hair_length in ('kort','medel','långt')),
  sensitivity   text check (sensitivity in ('normal','känslig hårbotten','känslig hud')),

  -- VAKTAD fri text (tillåten men sekundär — spec: "hellre strukturerat",
  -- inte "förbjud fritext"). Aldrig kund-facing; samma RLS-fence som raden.
  internal_note text,

  created_by    uuid references public.users(id) on delete set null,  -- staff som skrev (revision)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,

  unique (tenant_id, customer_id)   -- ETT klientkort per kund per salong (idempotent upsert)
);

-- ── 1.6 M6: working_hour_slots — explicita bokbara starttider per (staff,weekday) ─
-- SAMEXISTERAR med working_hours (envelopen). Tom lista för (staff,weekday) →
-- motorn faller tillbaka på range-rastret (noll regression). Lista finns →
-- motorn erbjuder bara dessa starts. tenant_id bärs EXPLICIT (RLS nycklar på den).
create table if not exists public.working_hour_slots (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)   on delete cascade,
  staff_id    uuid not null references public.staff(id)     on delete cascade,
  location_id uuid          references public.locations(id),           -- nullable, multi-store-framtidssäkring
  weekday     int  not null check (weekday between 0 and 6),           -- 0 = Sunday (matchar working_hours/tz.weekdayOf)
  start_time  time not null,
  active      boolean not null default true,                           -- soft-disable utan radering
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  -- en starttid kan inte listas två gånger samma dag för samma frisör
  unique (tenant_id, staff_id, weekday, start_time)
);

-- ── 1.7 M6: per-frisör + per-tjänst steg/buffert (ADDITIVA nullable-kolumner) ─
-- Nullable ⇒ befintliga rader får NULL = "använd hårdkodad default" (15/0), exakt
-- nuvarande beteende. Ingen backfill behövs. Resolution: service → staff → 15/0.
--   · slot_step_min : raster-granularitet i FALLBACK-läge + boot-import-steg
--                     (påverkar INTE explicit-läge — där är listan stegen).
--   · buffer_min    : krävt fritt gap EFTER passet (gäller i BÅDA lägen).
alter table public.staff    add column if not exists slot_step_min int
  check (slot_step_min is null or slot_step_min between 1 and 240);
alter table public.staff    add column if not exists buffer_min int
  check (buffer_min is null or buffer_min between 0 and 240);
alter table public.services add column if not exists slot_step_min int
  check (slot_step_min is null or slot_step_min between 1 and 240);
alter table public.services add column if not exists buffer_min int
  check (buffer_min is null or buffer_min between 0 and 240);


-- ############################################################################
-- FAS 2 — INDEX (inkl. partiella unika idempotens-nycklar)
-- ############################################################################

-- customers
create index if not exists customers_tenant_id_idx     on public.customers (tenant_id);
create index if not exists customers_auth_user_id_idx  on public.customers (auth_user_id);
-- en inloggad kund = en rad per tenant; en gästkontakt = en rad per tenant
-- (partiella → null krockar ej). Bär backfill-idempotens + framtida upsert.
create unique index if not exists customers_tenant_auth_uniq
  on public.customers (tenant_id, auth_user_id) where (auth_user_id is not null);
create unique index if not exists customers_tenant_contact_uniq
  on public.customers (tenant_id, contact_hash) where (contact_hash is not null);

-- bookings.customer_id
create index if not exists bookings_customer_id_idx on public.bookings (customer_id);

-- customer_favorites
create index if not exists customer_favorites_tenant_id_idx   on public.customer_favorites (tenant_id);
create index if not exists customer_favorites_customer_id_idx on public.customer_favorites (customer_id);
-- Ingen dubblett-favorit per kund (partiella → null-target krockar ej):
create unique index if not exists customer_favorites_staff_uniq
  on public.customer_favorites (customer_id, staff_id)   where (staff_id is not null);
create unique index if not exists customer_favorites_service_uniq
  on public.customer_favorites (customer_id, service_id) where (service_id is not null);

-- loyalty_ledger
create index if not exists loyalty_ledger_tenant_id_idx   on public.loyalty_ledger (tenant_id);
create index if not exists loyalty_ledger_customer_id_idx on public.loyalty_ledger (customer_id, created_at);
-- IDEMPOTENS / NO-SHOW-GATE: en completed bokning kan ALDRIG dubbel-belöna
-- (belt-and-suspenders mot dubbel-intjäning; själva gaten lever på skrivvägen).
create unique index if not exists loyalty_ledger_earn_once
  on public.loyalty_ledger (booking_id) where (reason = 'earn_completed');

-- customer_notes
create index if not exists customer_notes_tenant_id_idx   on public.customer_notes (tenant_id);
create index if not exists customer_notes_customer_id_idx on public.customer_notes (customer_id);

-- working_hour_slots
create index if not exists working_hour_slots_tenant_id_idx on public.working_hour_slots (tenant_id);
create index if not exists working_hour_slots_staff_id_idx  on public.working_hour_slots (staff_id);
create index if not exists working_hour_slots_location_idx  on public.working_hour_slots (location_id);
-- hot path: motorn slår upp (tenant, staff-set, weekday) → speglar working_hours-läsningen
create index if not exists working_hour_slots_lookup_idx
  on public.working_hour_slots (tenant_id, weekday, staff_id) where (active);


-- ############################################################################
-- FAS 3 — FUNKTIONER  (i beroendeordning)
-- ############################################################################

-- ── 3.1 KEYSTONE: deterministisk kontakt-hash (gäst-dedup + GDPR-raderbar nyckel) ─
-- Normaliserar (lower/trim) + tenant-saltar så samma gäst (e-post ELLER telefon)
-- känns igen mellan besök men hashen inte är trivialt korrelerbar mellan tenants.
-- ⚠️ language sql ⇒ extensions.digest resolvas VID CREATE. Se P1 i headern.
create or replace function public.customer_contact_hash(
  p_tenant uuid, p_email text, p_phone text
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(nullif(btrim(lower(p_email)), ''), nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),'')) is null
      then null
    else encode(
      extensions.digest(
        p_tenant::text || '|' ||
        coalesce(nullif(btrim(lower(p_email)), ''), '') || '|' ||
        coalesce(nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),''), ''),
        'sha256'
      ), 'hex')
  end
$$;

-- ── 3.2 M4: tenant-scopad current-customer-helper (RLS-fundament) ────────────
-- Mirror av private.role_level() (0010:26) MEN tenant-scopad. KRITISKT: kund-
-- identitet är PER TENANT (customers unique (tenant_id, auth_user_id)). En auth-
-- user har legitimt kund-rader i FLERA tenants (white-label). Utan tenant-filtret
-- returnerar subquery flera rader → RLS-checken kraschar. SECURITY DEFINER så
-- policyn kan läsa customers utan att rekursera genom dess RLS. STABLE → wrappas
-- (select ...) vid call-site (initplan). DEFINIERAS HÄR ÉN GÅNG (M5 har ingen
-- kund-gren och behöver den inte).
create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select c.id
  from public.customers c
  where c.auth_user_id = (select auth.uid())
    and c.tenant_id    = (select private.tenant_id())
  limit 1
$$;
revoke all on function private.current_customer_id() from public;
grant execute on function private.current_customer_id() to authenticated;

-- ── 3.3 KEYSTONE: tidsbunden PII-exponering (M5 §2.2) ────────────────────────
-- RLS kan inte tids-gata en KOLUMN, så drift-fönstret är en SECURITY DEFINER-fn.
-- Returnerar full kontakt-PII BARA om kunden har en bokning i det operativa
-- fönstret kring nu; annars maskerat. Anroparen återkollas mot customers-fencen
-- inuti (DEFINER kringgår RLS). Fönstret (p_before_h/p_after_h) defaultar brett;
-- exakt värde = öppen fråga (se VAG0-design.md, beslut 1).
create or replace function public.get_customer_contact(
  p_customer    uuid,
  p_before_h    int default 720,   -- 30 dygn före (config-bart; M6 §10 finputsar)
  p_after_h     int default 24     -- 1 dygn efter
) returns table (display_name text, full_name text, email text, phone text, pii_visible boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant  uuid := (select private.tenant_id());
  v_level   int  := (select private.role_level());
  v_uid     uuid := (select auth.uid());
  v_row     public.customers%rowtype;
  v_in_win  boolean;
begin
  select * into v_row from public.customers c where c.id = p_customer;
  if v_row.id is null then return; end if;

  -- Åtkomst-fence (spegel av customers_rls; DEFINER kringgår RLS så vi kollar här).
  if not (
    (select private.is_platform_admin())
    or (v_row.tenant_id = v_tenant
        and (v_level >= 3 or v_row.auth_user_id = v_uid))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Drift-fönster: finns en bokning vars start ligger i [now - before, now + after]?
  select exists (
    select 1 from public.bookings b
     where b.customer_id = p_customer
       and b.status in ('pending','confirmed','completed')
       and b.start_ts between (now() - make_interval(hours => p_before_h))
                          and (now() + make_interval(hours => p_after_h))
  ) into v_in_win;

  -- Kunden själv ser alltid sin egen PII; annars gatas den av fönstret.
  v_in_win := v_in_win or (v_row.auth_user_id = v_uid);

  display_name := coalesce(v_row.display_name,
                    case when v_row.name_hidden then left(coalesce(v_row.full_name,''),1) else v_row.full_name end);
  pii_visible  := v_in_win;
  full_name    := case when v_in_win and not v_row.name_hidden then v_row.full_name else null end;
  email        := case when v_in_win then v_row.email else null end;
  phone        := case when v_in_win then v_row.phone else null end;
  return next;
end;
$$;
revoke all     on function public.get_customer_contact(uuid, int, int) from public;
grant  execute on function public.get_customer_contact(uuid, int, int) to authenticated;

-- ── 3.4 M5: GDPR-scrub av klientkort vid anonymisering ───────────────────────
-- Keystone-GDPR ANONYMISERAR kunden (customers.status -> 'anonymized'), DELETE:ar
-- inte raden → FK-cascade fyrar ALDRIG. Utan denna trigger överlever internt PII
-- en "rätten att bli glömd". DELETE (ej skrubb): rena PII, ingen Bokföringslagen-
-- retention (till skillnad mot payments). Hård DB-garanti oberoende av app-lagret.
create or replace function public.scrub_customer_notes_on_anonymize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.customer_notes where customer_id = new.id;
  return new;
end;
$$;
revoke all on function public.scrub_customer_notes_on_anonymize() from public;

-- ── 3.5 M6: boot-import GENERATOR (OPT-IN, INTE en migrations-backfill) ───────
-- VIKTIGT: ingen global backfill. Att slots FINNS för (staff, weekday) flippar den
-- dagen från raster→explicit; en blanket-backfill skulle frysa ALLA salonger på
-- explicita listor och divergera så fort en tjänstelängd ändras. Därför: en SEC
-- DEFINER-fn som admin anropar PER frisör för att seeda explicita slots ur
-- nuvarande working_hours-mönster. Idempotent (on conflict do nothing). Tenant-
-- scoping verifieras INNE i funktionen. Härdning som 0004/0005/0008.
create or replace function public.seed_explicit_slots_from_hours(
  p_staff uuid,
  p_step  int default 15
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant   uuid;
  v_location uuid;
  v_count    int := 0;
begin
  if p_step is null or p_step <= 0 then
    raise exception 'invalid_step' using errcode = '22023';
  end if;

  -- Frisören MÅSTE tillhöra anroparens tenant (eller platform-admin).
  select s.tenant_id, s.location_id into v_tenant, v_location
    from public.staff s
   where s.id = p_staff
     and (s.tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));
  if v_tenant is null then
    raise exception 'unknown_or_forbidden_staff' using errcode = 'P0002';
  end if;

  -- Rastrera varje working_hours-fönster för frisören med p_step → starttider.
  -- sista start <= end_time - step.
  insert into public.working_hour_slots (tenant_id, staff_id, location_id, weekday, start_time)
  select v_tenant, p_staff, coalesce(wh.location_id, v_location), wh.weekday, gs::time
    from public.working_hours wh
    cross join lateral generate_series(
      ('2000-01-01'::date + wh.start_time),
      ('2000-01-01'::date + wh.end_time) - (p_step * interval '1 minute'),
      (p_step * interval '1 minute')
    ) as gs
   where wh.staff_id = p_staff
     and wh.tenant_id = v_tenant
  on conflict (tenant_id, staff_id, weekday, start_time) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.seed_explicit_slots_from_hours(uuid, int) from public;
grant  execute on function public.seed_explicit_slots_from_hours(uuid, int) to authenticated;


-- ############################################################################
-- FAS 4 — TRIGGERS  (guardade — CREATE TRIGGER saknar IF NOT EXISTS)
-- ############################################################################

-- ── 4.1 updated_at-triggers (mönster ur 0001/0005) ──
do $$
begin
  if not exists (select 1 from pg_trigger
     where tgname = 'trg_customers_updated' and tgrelid = 'public.customers'::regclass) then
    create trigger trg_customers_updated before update on public.customers
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger
     where tgname = 'trg_customer_notes_updated' and tgrelid = 'public.customer_notes'::regclass) then
    create trigger trg_customer_notes_updated before update on public.customer_notes
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger
     where tgname = 'trg_working_hour_slots_updated' and tgrelid = 'public.working_hour_slots'::regclass) then
    create trigger trg_working_hour_slots_updated before update on public.working_hour_slots
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── 4.2 M4: loyalty_ledger hård append-only-vakt (mönster = audit_log 0002:84) ─
-- NB: block_audit_mutation() finns sedan 0002:84. DELETE-vakten blockerar även
-- FK on-delete-cascade från en HÅRD customer-radering — men keystone-GDPR raderar
-- aldrig hårt (status='anonymized'-stub), så cascade triggas i praktiken inte.
do $$
begin
  if not exists (select 1 from pg_trigger
     where tgname = 'trg_loyalty_no_update' and tgrelid = 'public.loyalty_ledger'::regclass) then
    create trigger trg_loyalty_no_update before update on public.loyalty_ledger
      for each row execute function public.block_audit_mutation();
  end if;
  if not exists (select 1 from pg_trigger
     where tgname = 'trg_loyalty_no_delete' and tgrelid = 'public.loyalty_ledger'::regclass) then
    create trigger trg_loyalty_no_delete before delete on public.loyalty_ledger
      for each row execute function public.block_audit_mutation();
  end if;
end $$;

-- ── 4.3 M5: GDPR-scrub-trigger på customers (status → 'anonymized') ──
do $$
begin
  if not exists (select 1 from pg_trigger
     where tgname = 'trg_customers_anonymize_scrub_notes' and tgrelid = 'public.customers'::regclass) then
    create trigger trg_customers_anonymize_scrub_notes
      after update on public.customers
      for each row
      when (new.status = 'anonymized' and old.status is distinct from 'anonymized')
      execute function public.scrub_customer_notes_on_anonymize();
  end if;
end $$;


-- ############################################################################
-- FAS 5 — RLS ENABLE  (alla 5 nya tabeller)
-- ############################################################################
alter table public.customers          enable row level security;
alter table public.customer_favorites enable row level security;
alter table public.loyalty_ledger     enable row level security;
alter table public.customer_notes     enable row level security;
alter table public.working_hour_slots enable row level security;


-- ############################################################################
-- FAS 6 — POLICIES  (0010-mönster: is_platform_admin / private.tenant_id /
--                    role_level / current_customer_id — INTE generiska 0002)
-- ############################################################################

-- ── 6.1 customers ──
-- platform_admin → alla; level>=3 (staff/admin) → hela egna tenanten (M5/M6
-- kunddatabas); level<3 (kund) → BARA sin egen rad (auth_user_id = auth.uid()).
drop policy if exists customers_rls on public.customers;
create policy customers_rls on public.customers
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and ((select private.role_level()) >= 3 or auth_user_id = (select auth.uid()))
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and ((select private.role_level()) >= 3 or auth_user_id = (select auth.uid()))
    )
  );

-- ── 6.2 customer_favorites: full CRUD för kund (egna rader), staff/admin tenant-wide ─
-- Ägarskap resolvar auth.uid() → customers.id via private.current_customer_id()
-- (tenant-scopad) — INTE customer_id = auth.uid().
drop policy if exists customer_favorites_rls on public.customer_favorites;
create policy customer_favorites_rls on public.customer_favorites for all to authenticated
using (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and (
      (select private.role_level()) >= 3
      or customer_id = (select private.current_customer_id())
    )
  )
)
with check (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and (
      (select private.role_level()) >= 3
      or customer_id = (select private.current_customer_id())
    )
  )
);

-- ── 6.3 loyalty_ledger: SELECT-ONLY för authenticated ──
-- Medveten avvikelse från audit_log (som ger authenticated INSERT). Skrivs BARA
-- via service-role/SEC-DEFINER (RLS-bypass) — ingen INSERT/UPDATE/DELETE-policy
-- ⇒ nekas för auth. Kund läser egna rader; staff/admin tenant-wide; platform allt.
drop policy if exists loyalty_ledger_select on public.loyalty_ledger;
create policy loyalty_ledger_select on public.loyalty_ledger for select to authenticated
using (
  (select private.is_platform_admin())
  or (
    tenant_id = (select private.tenant_id())
    and (
      (select private.role_level()) >= 3
      or customer_id = (select private.current_customer_id())
    )
  )
);

-- ── 6.4 customer_notes: BARA staff/admin (role_level>=3) + platform-admin ──
-- KRITISKT: ingen kund-self-scope-gren (till skillnad mot bookings_rls 0010:49).
-- Det är frånvaron av den grenen som gör noteringen strikt intern. Ingen anon-
-- policy → publik storefront/M4-sida ser aldrig kortet.
drop policy if exists customer_notes_rls on public.customer_notes;
create policy customer_notes_rls on public.customer_notes
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3      -- enbart staff/admin; INGEN kund-self-scope
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
    )
  );

-- ── 6.5 working_hour_slots: authenticated tenant-fence (admin/personal) ──
-- Mönster = working_hours_rls (0002). for all (select+write) — admin justerar slots.
drop policy if exists working_hour_slots_rls on public.working_hour_slots;
create policy working_hour_slots_rls on public.working_hour_slots
  for all to authenticated
  using      (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_platform_admin()));

-- ── 6.6 working_hour_slots: anon public-read (publika bokningsmotorn M3) ──
-- KRITISK: matar M3 slot-generering som kör som anon. Spegel av
-- working_hours_public_read (0005) — gated på aktiv tenant, ingen PII.
-- (active-filtret görs i app-läsningen, samma stil som staff_public_read.)
drop policy if exists working_hour_slots_public_read on public.working_hour_slots;
create policy working_hour_slots_public_read on public.working_hour_slots
  for select to anon
  using (exists (
    select 1 from public.tenants t
     where t.id = working_hour_slots.tenant_id and t.status = 'active'
  ));


-- ############################################################################
-- FAS 7 — BACKFILL  (IDEMPOTENT; A inloggade FÖRE B gäster)
-- ############################################################################
-- Behåller note (task: "behåller note tills migrerad"). Sätter bara customer_id
-- där den är null. PRIORITET: customer_profile_id (inloggad) FÖRE note (gäst) —
-- en rebookad inloggad bokning bär båda (actions.ts:228) och får ALDRIG mynta en
-- gäst-dubblett. Allt gatas på `customer_id is null` + ON CONFLICT på partiella
-- unika index → fullt återkörbart.

-- ── A. Inloggade kunder → en customers-rad per (tenant, auth_user_id) ──
-- PII ur public.users (e-post/telefon); full_name ur user_metadata nås ej i SQL
-- (lämnas null, UI fyller via auth-profilen).
insert into public.customers (tenant_id, auth_user_id, email, phone, contact_hash, first_seen_at, last_seen_at)
select b.tenant_id,
       b.customer_profile_id,
       u.email,
       u.phone,
       public.customer_contact_hash(b.tenant_id, u.email, u.phone),
       min(b.created_at),
       max(b.start_ts)
  from public.bookings b
  join public.users u on u.id = b.customer_profile_id
 where b.customer_profile_id is not null
 group by b.tenant_id, b.customer_profile_id, u.email, u.phone
on conflict (tenant_id, auth_user_id) where (auth_user_id is not null)
  do update set last_seen_at = greatest(customers.last_seen_at, excluded.last_seen_at),
                email        = coalesce(customers.email, excluded.email),
                phone        = coalesce(customers.phone, excluded.phone);

-- Länka de inloggade bokningarna (bara där customer_id ännu är null).
update public.bookings b
   set customer_id = c.id
  from public.customers c
 where b.customer_id is null
   and b.customer_profile_id is not null
   and c.tenant_id = b.tenant_id
   and c.auth_user_id = b.customer_profile_id;

-- ── B. Gästbokningar (customer_profile_id IS NULL, note = gäst-söm) → customers ──
-- Parse-CTE speglar produktionsregexarna EXAKT:
--   namn   : lib/notifications/parse.ts:14  /Gäst:\s*([^<]+?)\s*</
--   e-post : lib/notifications/parse.ts:8   /<...@...\....>/
--   telefon: lib/notifications/sms.ts:68    text efter '>' före ' — '/' - ', ≥4 siffror
-- Endast rader med en hash-bar kontakt (e-post ELLER telefon) blir customers;
-- rena "Gäst: Namn" utan kontakt HOPPAS ÖVER (ingen stabil dedup-nyckel — note
-- behålls orörd, kan länkas manuellt sen).
with g as (
  select b.id as booking_id,
         b.tenant_id,
         b.created_at,
         b.start_ts,
         nullif(btrim((regexp_match(b.note, 'Gäst:\s*([^<]+?)\s*<'))[1]), '')            as g_name,
         lower((regexp_match(b.note, '<([^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)>'))[1])           as g_email,
         -- telefon: text efter '>'-bracketen, före ' — '/' - ', ≥4 siffror
         nullif(btrim(split_part(
            coalesce((regexp_match(b.note, '<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*(.*)$'))[1], ''),
            ' — ', 1)), '')                                                              as g_tail
    from public.bookings b
   where b.customer_id is null
     and b.customer_profile_id is null
     and b.note like 'Gäst:%'
),
gp as (
  select *,
         -- splittra även på ' - ' (hyphen) som produktions-parsern, behåll telefon-delen
         case when regexp_match(split_part(g_tail, ' - ', 1), '\d{4,}') is not null
              then btrim(split_part(g_tail, ' - ', 1)) end as g_phone
    from g
),
seed as (
  select tenant_id,
         g_name  as full_name,
         g_email as email,
         g_phone as phone,
         public.customer_contact_hash(tenant_id, g_email, g_phone) as h,
         min(created_at) as first_seen, max(start_ts) as last_seen
    from gp
   where public.customer_contact_hash(tenant_id, g_email, g_phone) is not null
   group by tenant_id, g_name, g_email, g_phone, public.customer_contact_hash(tenant_id, g_email, g_phone)
)
insert into public.customers (tenant_id, contact_hash, full_name, email, phone, first_seen_at, last_seen_at)
select tenant_id, h, full_name, email, phone, first_seen, last_seen
  from seed
on conflict (tenant_id, contact_hash) where (contact_hash is not null)
  do update set last_seen_at = greatest(customers.last_seen_at, excluded.last_seen_at),
                full_name    = coalesce(customers.full_name, excluded.full_name),
                email        = coalesce(customers.email, excluded.email),
                phone        = coalesce(customers.phone, excluded.phone);

-- Länka gästbokningarna via hash (note BEHÅLLS — tas bort först i en senare fas
-- när app-vägen läser från customers i stället för note-sömmen).
update public.bookings b
   set customer_id = c.id
  from public.customers c
 where b.customer_id is null
   and b.customer_profile_id is null
   and b.note like 'Gäst:%'
   and c.tenant_id = b.tenant_id
   and c.contact_hash = public.customer_contact_hash(
        b.tenant_id,
        lower((regexp_match(b.note, '<([^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)>'))[1]),
        nullif(btrim(split_part(split_part(
           coalesce((regexp_match(b.note, '<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*(.*)$'))[1], ''),
           ' — ', 1), ' - ', 1)), '')
      );

-- ============================================================================
-- SLUT DRAFT 0011. EJ APPLICERAD. Verifiera P1 (pgcrypto-schema) + planera P2
-- (erase.ts GDPR-utökning) INNAN flytt till 5-Kod/supabase/migrations/ + apply.
-- ============================================================================
