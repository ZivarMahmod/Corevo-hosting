# Plan 013: Identitets-keystone — claim/merge gäst↔konto + telefondedup

> **Executor instructions**: Följ steg för steg, verifiera varje steg. STOP-villkor
> gäller. Detta är en KÄNSLIG PII/RLS-yta — auto-merga aldrig på svagt signal.
> Uppdatera statusraden i `plans/README.md` när klar.
>
> **Drift check**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/lib/kund 5-Kod/apps/web/app/boka/actions.ts 5-Kod/supabase/migrations | head`

## Status

- **Priority**: P1 (keystone — allt i engagemangsmotorn hänger på stabil identitet)
- **Effort**: L
- **Risk**: HÖG (PII, RLS, merge av kundkort — fel merge exponerar en kunds data för fel konto)
- **Depends on**: none (schemat finns redan)
- **Category**: feature / data-integrity
- **Planned at**: commit `6cdd690`, 2026-07-17
- **Beslut:** identitet byggs FÖRST. Se `plans/DIREKTION-engagemangsmotor.md`.

## Why this matters

Samma människa blir idag 2–3 `customers`-rader utan sätt att slå ihop: gäst-via-mejl,
gäst-via-telefon (annat hash), och inloggad. `resolve_customer_id` har två grenar
(`auth_user_id` ELLER `contact_hash`) som **aldrig korsar** varandra. Utan en
sammanslagen identitet ärver klippkort, preferenser och rekommendationer fel subjekt.
Schemat byggdes för merge (surrogat-id, nullable `auth_user_id`, `contact_hash`) —
bara koden saknas. Visionens inloggningsflöde (SMS-bekräftelse med claim-länk →
kunden loggar in → kortet kopplas) kräver exakt detta.

## Current state

- Tabell `customers` (migr `0011_customers_identity_and_schedule.sql:52-77`): `id,
  tenant_id, auth_user_id→users, contact_hash, display_name, name_hidden, full_name,
  email, phone, status[active|anonymized], first/last_seen_at`.
- `bookings.customer_id → customers(id)` (FK, 0011:81-82). `bookings.customer_profile_id`
  = legacy plain uuid, INGEN FK — rör inte.
- `contact_hash = sha256(tenant || coalesce(email, phone))` — **email-first** (0011:249-267).
  Olika mejl + samma telefon ⇒ olika hash ⇒ duplikatkort.
- `resolve_customer_id` (`0015_booking_customer_id_resolve.sql:31-55`, redef
  `0068_oversikt_auto_bekrafta.sql:113-115`) — två icke-korsande grenar.
- `getOrCreateCustomerId` (`lib/kund/customer.ts:57-82`) — nycklar bara på `auth_user_id`.
- Stale seam: `app/boka/actions.ts:341-344` skriver fortfarande `Gäst: namn <mejl> tel`-not
  med kommentar "customers table is a future goal" (FELAKTIG — kortet mintas redan).
- `/konto`-yta finns (`app/(kund)/konto/`), gate `requirePortal('kund')`. **Ingen
  claim/koppla-route.**
- GDPR: `lib/gdpr/erase.ts` scrubbar `customers`; 0011-headern varnar att erase måste
  nå ny PII.

## Scope

**In scope**:
- Ny migration (>=0089): `claim_token` på `customers` (opak, unik, nullbar) + merge-RPC.
- Claim-route `/konto/koppla/[token]` (server action) som kopplar inloggad auth-user
  till gästkortet bakom token.
- Merge-RPC (SECURITY DEFINER): flytta `bookings`, `customer_favorites`,
  `loyalty_ledger`, `customer_notes` från duplikatkort till kanoniskt kort, anonymisera
  duplikatet. Transaktionellt, guard-medvetet (append-only-triggers på ledger/history).
- Telefondedup: sekundär telefonuppslag i `resolve_customer_id` + verifieringssteg
  innan ett annat mejl auto-kopplas.
- `lib/kund/customer.ts` + `app/boka/actions.ts` (avveckla stale seam som sanningskälla).
- `lib/gdpr/erase.ts` (nå merge-artefakter).

**Out of scope**:
- Preferens-frågeflödet (plan 016) — bara identitetskopplingen här.
- Push/PWA-prompten efter claim (plan 015).
- `konto.corevo.se` som egen subdomän — `/konto` på tenant-host räcker (rör inte host-routing/deploy).

## Steps

### Step 1: claim_token + claim-länk i SMS-bekräftelsen
Ny migration: lägg `claim_token uuid unique` (default `gen_random_uuid()`) på `customers`.
Bekräftelse-SMS/mejl (`lib/notifications/booking.ts`) får en länk
`https://<tenant>/konto/koppla/<claim_token>`. Token är opak, per kort, engångskänsla
(invalideras efter lyckad koppling).

**Verify**: `select claim_token from customers limit 1` ger uuid; bekräftelsemallen
innehåller länken (grep i booking-templates).

### Step 2: claim-route kopplar auth-user → gästkort
`/konto/koppla/[token]`: kräver inloggad kund (`requirePortal('kund')` — om ej inloggad,
skicka till login med return-url). Slår upp kortet på `claim_token`. Om kortets
`auth_user_id` är null ⇒ sätt `= auth.uid()`, nolla `claim_token`. Om redan kopplat
till SAMMA user ⇒ no-op (visa "redan kopplat"). Om kopplat till ANNAN user ⇒ STOP
(visa fel, koppla inte).

**Verify**: skapa gästbokning i DEMO (CLI) → hämta token → simulera claim → `select
auth_user_id from customers where claim_token is null` visar kopplingen. RLS: en annan
users token-claim ska nekas.

### Step 3: merge-RPC när användaren redan har ett kort i tenanten
Om den inloggade auth-usern REDAN har en `customers`-rad i tenanten (authed-grenen
skapade en) och nu claimar ett gästkort ⇒ merga. SECURITY DEFINER RPC `merge_customer(
canonical_id, duplicate_id)`: flytta `bookings.customer_id`, `customer_favorites`,
`loyalty_ledger`, `customer_notes` till canonical; sätt duplikatets `status='anonymized'`,
nolla dess PII. Transaktionellt; disable/enable append-only-triggers INNE i transaktionen
(mönster: se `scratchpad/frisor1-teardown.sql` + kund-purge). Canonical = det äldsta
aktiva kortet med `auth_user_id`.

**Verify**: seed två DEMO-kort (ett authed, ett gäst, samma person) med bokningar på
båda → kör merge → canonical har alla bokningar, duplikat `anonymized`, ledger-summan
bevarad. Guards `tgenabled='O'` efteråt.

### Step 4: telefondedup + verifiering (svaga-signal-skyddet)
I `resolve_customer_id`/`getOrCreateCustomerId`: innan ett nytt gästkort mintas för ett
mejl, kolla om ett kort med SAMMA telefon finns i tenanten. Om ja ⇒ minta INTE nytt;
antingen (a) attachera till befintligt om telefonen är verifierad, eller (b) skapa kort
men flagga `possible_duplicate_of` för ägar-merge. Auto-koppla ALDRIG bara på mejl-match
(delad familje-mejl). Vision: "bekräfta telefonnummer eller låt kunden verifiera innan
kontot kopplas".

**Verify**: DEMO — boka som gäst mejl A + tel X, boka igen mejl B + tel X ⇒ 1 kort (eller
1 + flagga), inte 2 orelaterade. Boka mejl A tel X och mejl A tel Y ⇒ hanteras utan krasch.

### Step 5: avveckla stale "Gäst:"-seam som sanningskälla
`app/boka/actions.ts:341-344`: `customer_id` är auktoritativt. Behåll noten som ren
display-fallback om du vill, men sluta lita på den för identitet; uppdatera den
felaktiga kommentaren.

**Verify**: `pnpm typecheck` → 0; gästbokning i DEMO skriver `customer_id`, inte bara noten.

### Step 6: GDPR-täckning
`lib/gdpr/erase.ts`: erase av en kund måste nå ihop-mergeade rader (anonymiserade
duplikat) + nolla `claim_token`. Bekräfta att erase-vägen täcker alla `customers`-rader
länkade till samma person.

**Verify**: erase en DEMO-kund med ett mergeat duplikat ⇒ båda raderna scrubbade.

## Done criteria

- [ ] `claim_token` finns; bekräftelse innehåller claim-länk
- [ ] Claim-route kopplar auth-user → gästkort; nekar annans token (RLS-bevisad i DEMO)
- [ ] `merge_customer`-RPC flyttar barn + anonymiserar duplikat, guards återställda
- [ ] Telefondedup hindrar duplikat; auto-kopplar aldrig på enbart mejl
- [ ] Stale seam nedgraderad; `customer_id` auktoritativt
- [ ] Erase når mergeade rader
- [ ] `pnpm test && pnpm typecheck` → 0; statusrad i README uppdaterad

## STOP conditions

- Merge skulle koppla ett kort till en auth-user som inte äger token/telefonen → STOP,
  koppla inte. Identitetsläckage är värre än ett duplikat.
- Append-only-guard (ledger/history) blockerar merge → disable/enable INNE i samma
  transaktion (aldrig utanför); om det inte går atomiskt, STOP och rapportera.
- Migrationsnummer krockar (0089 taget av annan plan) → ta nästa lediga, synka README.

## Maintenance notes

- Detta är subjektet allt annat hänger på: preferenser (016), samtycke/outbox (014),
  push (015), klippkort/referral (018) refererar `customers.id` — landa detta stabilt först.
- Duplikat-flaggan (`possible_duplicate_of`) kan senare driva en ägar-"slå ihop kunder"-knapp.
