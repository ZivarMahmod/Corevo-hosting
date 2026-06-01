# 01 – Databas-schema (Corevo Booking Platform)

> **Synkad mot ADR 01 (tenant/tema), 02 onboarding, 03 pengaflöde.** Theming i `tenant_settings.branding`/`settings`, avgift i `tenant_settings.service_fee_*`. Auth = Supabase Auth, `tenant_id` som JWT-claim i `app_metadata`.

**Status:** Planering. Ingen kod körs, ingen migration appliceras.
**Stack:** Next.js + Supabase (Postgres + Auth) + Cloudflare R2 + Stripe Connect.
**Källa:** Arkitektur Modul 9 + modul-PDF:er (3 boknings, 4 kund, 5 personal, 6 admin, 8 betalning, 12 säkerhet).

> ✅ **Verifierat mot Supabase officiella RLS-doc** (supabase.com, uppdaterad 2026-05-29) + WebSearch maj 2026. Mönstret nedan (`app_metadata`-claim via Custom Access Token Hook, `(select auth.jwt()...)`-wrapping för planner-cache, index på `tenant_id`) är aktuell best practice. Källor längst ner.

---

## 1. Principer

| # | Princip | Innebörd |
|---|---------|----------|
| 1 | Multi-tenant från dag 1 | Alla salonger delar samma databas. Ingen ny DB per kund. |
| 2 | `tenant_id` på nästan allt | Varje affärstabell har `tenant_id`. Skalar automatiskt. |
| 3 | RLS isolerar | Row Level Security på alla tenant-tabeller. Isolering i DB, inte bara i app-kod. |
| 4 | Ingen tenant ser annan tenants data | Aldrig. Hård regel, hela vägen ner till radnivå. |
| 5 | Audit raderas aldrig | `audit_logs` är append-only. Ingen UPDATE/DELETE, inte ens för owner. |
| 6 | Ingen kortdata lagras | Aldrig PAN/CVV i vår DB. Stripe håller kortet. Vi lagrar bara Stripe-ID:n + status. |
| 7 | Minsta möjliga åtkomst | Roll styr vad som syns (8 nivåer: publik → kund → frisör → reception → manager → owner → Corevo admin → super admin). |

---

## 2. Komplett tabell-lista (grupperad)

**Notation:** PK = primärnyckel, FK = främmande nyckel, T = har `tenant_id` (uuid, RLS-scopad).
Alla affärstabeller har dessutom `created_at timestamptz default now()` och `updated_at timestamptz`.

### Core / tenant
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `tenants` | id, name, slug, status, plan, stripe_account_id | id | – | – (är tenant) |
| `tenant_domains` | id, tenant_id, domain, is_primary, verified | id | tenant_id→tenants | T |
| `tenant_settings` | id, tenant_id, payment_mode, branding(jsonb), settings(jsonb), service_fee_type, service_fee_value | id | tenant_id→tenants | T |

### Users / roller / behörigheter
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `users` | id(=auth.users.id), tenant_id, email, phone, role_id, status | id | tenant_id, role_id | T |
| `roles` | id, tenant_id(null=global), name, level(int 1-8) | id | tenant_id | T (nullbar) |
| `permissions` | id, code, description | id | – | – |
| `role_permissions` | role_id, permission_id | (role_id,permission_id) | båda | – |
| `user_sessions` | id, user_id, ip, user_agent, created_at, expires_at | id | user_id→users | T |

### Customers + loyalty
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `customers` | id, tenant_id, name, phone, email, status | id | tenant_id | T |
| `customer_profiles` | id, customer_id, birthdate, notes, marketing_consent | id | customer_id | T |
| `customer_preferences` | id, customer_id, favorite_barber_id, prefs(jsonb) | id | customer_id, barber_id | T |
| `customer_loyalty_accounts` | id, customer_id, points_balance | id | customer_id | T |
| `customer_loyalty_transactions` | id, account_id, delta(int), reason, booking_id | id | account_id, booking_id | T |

### Bookings + history + messages
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `bookings` | id, tenant_id, location_id, barber_id, customer_id, service_id, starts_at, ends_at, status, payment_status, price_cents, comment | id | location, barber, customer, service | T |
| `booking_history` | id, booking_id, action, old_status, new_status, by_user_id, at | id | booking_id, user | T |
| `booking_messages` | id, booking_id, sender_type, sender_id, body, created_at | id | booking_id | T |

### Barbers + schema + availability
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `barbers` | id, tenant_id, user_id, location_id, name, active | id | user, location | T |
| `barber_schedules` | id, barber_id, weekday(0-6), start_time, end_time | id | barber_id | T |
| `barber_availability` | id, barber_id, date, type(break/vacation/extra), start_ts, end_ts | id | barber_id | T |
| `barber_services` | barber_id, service_id | (barber_id,service_id) | båda | T |

### Locations + öppettider
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `locations` | id, tenant_id, name, address, phone, email, active | id | tenant_id | T |
| `location_hours` | id, location_id, weekday(0-6), open_time, close_time, closed | id | location_id | T |

### Services + priser
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `services` | id, tenant_id, name, category, duration_min, active | id | tenant_id | T |
| `service_prices` | id, service_id, location_id(null=alla), price_cents, valid_from | id | service, location | T |

### Payments + refunds + events
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `payments` | id, tenant_id, booking_id, mode(on_site/online), status, amount_cents, currency, stripe_payment_intent_id | id | booking_id | T |
| `refunds` | id, payment_id, amount_cents, reason, stripe_refund_id, status | id | payment_id | T |
| `payment_events` | id, payment_id, type, stripe_event_id, raw(jsonb), created_at | id | payment_id | T |

### CMS / media
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `news_posts` | id, tenant_id, location_id(null=alla), title, body, published, published_at | id | tenant_id, location | T |
| `media_assets` | id, tenant_id, r2_key, url, type, alt, size_bytes | id | tenant_id | T |

### Audit / logs
| Tabell | Nyckelkolumner | PK | FK | T |
|--------|----------------|----|----|---|
| `audit_logs` | id, tenant_id, actor_user_id, action, entity_type, entity_id, before(jsonb), after(jsonb), ip, created_at | id | tenant_id | T |

> **Kort om kortdata:** vi sparar **endast** `stripe_payment_intent_id`, `stripe_refund_id`, `stripe_event_id`, belopp och status. Aldrig kortnummer.

---

## 3. CREATE TABLE-skisser (Postgres)

> Skiss, körbar som utgångspunkt – ej produktionsfärdig. UUID via `gen_random_uuid()` (pgcrypto/pgcrypto-inbyggt i Postgres 13+).

```sql
-- ===== CORE =====
create table tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  status            text not null default 'active',   -- active | suspended
  plan              text not null default 'standard',
  stripe_account_id text,                              -- Stripe Connect acct_...
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create table tenant_domains (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  domain     text not null unique,
  is_primary boolean not null default false,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create table tenant_settings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  payment_mode text not null default 'on_site',        -- on_site | online | both | coming_soon
  -- ===== THEMING (ADR 01, tema-lager 3 nivåer) =====
  branding     jsonb not null default '{}'::jsonb,      -- nivå 1: { logo_url, color_primary, font_body, ... }
  settings     jsonb not null default '{}'::jsonb,      -- nivå 2: settings.layout {nav_variant,hero_variant,...}
                                                        -- nivå 3: settings.custom_override (flagga + ref, scopad [data-tenant])
  -- ===== SERVICE-AVGIFT (ADR 01 §5 + pengaflöde §3, per tenant) =====
  service_fee_type  text not null default 'fixed'
    check (service_fee_type in ('fixed','percent')),    -- 'fixed' = öre, 'percent' = procent
  service_fee_value int  not null default 500,          -- 500 öre = 5 kr (default), eller procent-tal vid 'percent'
  unique (tenant_id)
);

-- ===== USERS / ROLES =====
create table roles (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,  -- null = global roll
  name      text not null,
  level     int  not null,                               -- 1..8 (säkerhetsnivå)
  unique (tenant_id, name)
);

create table users (
  id        uuid primary key,                            -- = auth.users.id (Supabase)
  tenant_id uuid not null references tenants(id) on delete cascade,
  email     text,
  phone     text,
  role_id   uuid references roles(id),
  status    text not null default 'active',
  created_at timestamptz not null default now()
);

-- ===== CUSTOMERS =====
create table customers (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name      text not null,
  phone     text,
  email     text,
  status    text not null default 'active',
  created_at timestamptz not null default now()
);

-- ===== LOCATIONS =====
create table locations (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name      text not null,
  address   text,
  phone     text,
  email     text,
  active    boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== SERVICES =====
create table services (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  category     text,
  duration_min int  not null,
  active       boolean not null default true
);

create table service_prices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  service_id  uuid not null references services(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,  -- null = gäller alla
  price_cents int  not null,
  valid_from  date not null default current_date
);

-- ===== BARBERS =====
create table barbers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid references users(id),
  location_id uuid references locations(id),
  name        text not null,
  active      boolean not null default true
);

create table barber_schedules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  barber_id  uuid not null references barbers(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);

-- ===== BOOKINGS =====
create table bookings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  location_id    uuid not null references locations(id),
  barber_id      uuid not null references barbers(id),
  customer_id    uuid references customers(id),
  service_id     uuid not null references services(id),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'booked',     -- booked|completed|cancelled|no_show
  payment_status text not null default 'unpaid',     -- unpaid|pay_on_site|paid_online|refunded
  price_cents    int,
  comment        text,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- ===== PAYMENTS =====
create table payments (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  booking_id               uuid not null references bookings(id) on delete cascade,
  mode                     text not null,            -- on_site | online
  status                   text not null,            -- pending|succeeded|failed|refunded
  amount_cents             int  not null,
  currency                 text not null default 'sek',
  stripe_payment_intent_id text,                      -- aldrig kortdata
  created_at               timestamptz not null default now()
);

-- ===== AUDIT (append-only) =====
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  actor_user_id uuid references users(id),
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  ip            inet,
  created_at    timestamptz not null default now()
);
-- INGEN update/delete tillåts (se RLS nedan).
```

---

## 4. RLS-strategi (tenant-isolering)

**Mönster:** `tenant_id` läses ur JWT som en **custom claim i `app_metadata`** (server-satt, kan ej manipuleras av användaren — till skillnad från `user_metadata`). En `STABLE SECURITY DEFINER`-helper cachar värdet så det inte räknas om per rad.

### Steg 1 – Sätt `tenant_id` i JWT
Vid inloggning/registrering sätter backend (eller en Supabase Auth Hook / custom access token hook) `tenant_id` i användarens `app_metadata`. Det följer sedan med i varje JWT.

### Steg 2 – Helper-funktion
```sql
create or replace function auth.tenant_id()
returns uuid
language sql stable
as $$
  select nullif(
    ((current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'tenant_id')), ''
  )::uuid
$$;
```

### Steg 3 – Aktivera RLS + policy per tabell
```sql
alter table bookings enable row level security;

-- Läs: bara egen tenant
create policy bookings_select on bookings
for select using ( tenant_id = (select auth.tenant_id()) );

-- Skriv/ändra: bara egen tenant
create policy bookings_write on bookings
for all
using      ( tenant_id = (select auth.tenant_id()) )
with check ( tenant_id = (select auth.tenant_id()) );
```
> `(select auth.tenant_id())` wrappas i subquery → planner cachar (Supabase performance-mönster, undvik per-rad-eval).

### Audit append-only
```sql
alter table audit_logs enable row level security;

create policy audit_select on audit_logs
for select using ( tenant_id = (select auth.tenant_id()) );

create policy audit_insert on audit_logs
for insert with check ( tenant_id = (select auth.tenant_id()) );
-- INGEN update/delete-policy => ingen kan ändra/radera. Append-only.
-- Komplettera ev. med en trigger som hårt blockerar UPDATE/DELETE.
```

### JWT-claim vs lookup-tabell
| | JWT `app_metadata`-claim | Lookup mot memberships-tabell |
|---|---|---|
| Prestanda | **Bäst** (ingen join per rad) | Sämre (join/subquery per rad) |
| Säkerhet | Hög (server-satt, signerad) | Hög |
| Multi-tenant per user | Krångligt om en user → flera tenants | Naturligt |
| **Rekommendation** | **Default-val** (1 user = 1 tenant) | Använd bara om user kan tillhöra flera tenants — då via `SECURITY DEFINER`-helper, ej rå join i policyn |

> Corevo: 1 personal/kund hör normalt till **1 tenant** → välj JWT-claim. Corevo Admin/Super Admin (nivå 7-8) hanteras via separat global roll / service-role, ej tenant-scopad.

---

## 5. Index & constraints (kritiska)

```sql
-- Tenant-index på alla heta tabeller (RLS filtrerar på tenant_id)
create index on bookings        (tenant_id);
create index on customers       (tenant_id);
create index on payments        (tenant_id);
create index on barbers         (tenant_id);
create index on audit_logs      (tenant_id, created_at);

-- Heta sök-index för lediga tider
create index on bookings (barber_id, starts_at);
create index on bookings (location_id, starts_at);

-- DUBBELBOKNINGSSKYDD: ingen frisör kan ha två överlappande bokningar
create extension if not exists btree_gist;
alter table bookings
  add constraint no_double_booking
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status in ('booked','completed'));   -- avbokade/no_show blockerar ej
```

| Constraint | Skyddar mot |
|------------|-------------|
| `no_double_booking` (EXCLUDE + btree_gist) | Två bokningar på samma frisör som överlappar i tid |
| `check (ends_at > starts_at)` | Negativ/noll-längd bokning |
| `tenant_domains.domain unique` | Två tenants på samma domän |
| `roles unique (tenant_id, name)` | Dubblettroller |
| FK `on delete cascade` från tenants | Föräldralös data när tenant raderas |

---

## 6. Öppna frågor (besvara före migration)

| # | Fråga | Varför viktig |
|---|-------|---------------|
| 1 | Hur sätts `tenant_id` i JWT konkret — Supabase **Custom Access Token Hook** (rekommenderas) eller egen backend-logik vid signup? | Avgör att claim **alltid** finns i token. Mönstret i sig är verifierat (avsnitt 4). |
| 2 | Ska `auth.tenant_id()`-helpern ligga i eget schema (`private`/`auth`) som ej är exponerat i API? | Säkerhet: `SECURITY DEFINER`-funktioner får ej ligga i exponerat schema (Supabase-krav). |
| 3 | Kan en **frisör/owner tillhöra flera tenants/salonger**? | Om ja → byt JWT-claim mot memberships-helper (avsnitt 4). |
| 4 | Ska RLS dessutom **rollscopa inom tenant** (frisör ser bara egna bokningar, owner ser allt)? | Modul 12 har 8 nivåer; kräver extra policy-villkor. |
| 5 | **Belopp som `int cents` eller `numeric`?** Och stödjs flera valutor i v1? | Påverkar payments/service_prices-typer. |

---

## Källor (verifierat maj 2026)

- Supabase – Row Level Security (off. doc, uppdaterad 2026-05-29): https://supabase.com/docs/guides/database/postgres/row-level-security
  - Bekräftar: `app_metadata` (=`raw_app_meta_data`) kan **ej** ändras av användaren → rätt plats för `tenant_id`. `user_metadata` får ALDRIG användas för authz.
  - Bekräftar: wrappa JWT-funktioner i `(select ...)` → planner-cache (`initPlan`), upp till 99.9% snabbare.
  - Bekräftar: index på alla kolumner i policys; `SECURITY DEFINER`-funktioner ej i exponerat schema; använd `TO authenticated`.
- Supabase – Custom Claims & RBAC (Custom Access Token Hook): https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase – RLS Performance & Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- AntStack – Multi-Tenant Applications with RLS on Supabase: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/
- MakerKit – Supabase RLS Best Practices (multi-tenant): https://makerkit.dev/blog/tutorials/supabase-rls-best-practices

> **Viktig nyans (från doc):** JWT är inte alltid "färsk". Byter en user tenant uppdateras `auth.jwt()` först när token refreshas. För Corevo (1 user = 1 tenant, byts ~aldrig) är detta ett icke-problem. Om Öppen fråga 3 blir "ja" måste token-refresh hanteras.
