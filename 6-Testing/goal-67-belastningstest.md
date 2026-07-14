# goal-67 — Belastningstest av bokningsmotorn (bevisuppdrag)

Datum: 2026-07-14 · Kört mot den länkade Supabase-DB:n (`clylvowtowbtotrahuad`)
i en **isolerad fejktenant** (`lasttest-zzz-fejk`, alla bokningar 2030-06-05).
Ingen befintlig kunddata rördes. Alla testrader städades (verifierat: 0 kvar).

**Kort svar:** krockskyddet håller. 50 samtidiga bokningar på samma tid → exakt
1 rad i DB:n. Inga dubbletter, inga tappade bokningar, inga 500:or i något
scenario. **Två riktiga fynd:** (1) idempotens-skyddet i 0048 läcker `23P01` vid
samtidig retry — exakt den bugg migrationen skrevs för att stoppa, och (2)
`moveBooking` har en TOCTOU-lucka som låter en avbokad bokning flyttas.

Kör om: `cd 5-Kod && node apps/web/scripts/last-test/concurrency.mjs`
Enhetstester: `cd 5-Kod && ./node_modules/.bin/vitest run --root apps/web` (1051 gröna, varav 14 nya i `lib/booking/conflict.test.ts`)

---

## Vad skyddet faktiskt är

```sql
-- supabase/migrations/0001_core_schema.sql:163-169 (verifierat live i pg_constraint)
alter table public.bookings add constraint no_double_booking
  exclude using gist (staff_id with =, tstzrange(start_ts, end_ts) with &&)
  where (status in ('pending','confirmed','completed'));
```

Utesluter: överlapp per **resurs** (staff_id), halvöppet intervall `[start, end)`.
Utesluter INTE: `cancelled`/`no_show` (de blockerar ingenting — avsiktligt),
**buffer_min** (constrainten ser bara start_ts/end_ts) och tenant (irrelevant,
staff_id är globalt unikt).

---

## A) Concurrency mot DB:n — 12 scenarier

`apps/web/scripts/last-test/concurrency.mjs` (+ `_env.mjs`).
Anropen går som **anon** genom `create_public_booking` — samma väg som en riktig
kund. Admin-vägarna (`moveBooking`/`setBookingStatus`) är server actions bakom
auth och kan inte anropas från ett skript; skriptet reproducerar därför **exakt
samma SQL-skrivning** de gör (samma filter, samma fält, samma avsaknad av vakt).

| # | Scenario | Försök | Lyckade | Rader i DB | Utfall |
|---|---|---|---|---|---|
| A1 | Samtidig bokning samma tid+resurs, N=2 | 2 | 1 | **1** | ✅ HÅLLER (1× 23P01) |
| A1 | Samma, N=10 | 10 | 1 | **1** | ✅ HÅLLER (9× 23P01) |
| A1 | Samma, N=50 | 50 | 1 | **1** | ✅ HÅLLER (49× 23P01, 0 övriga fel, 0 timeouts) |
| A2 | Idempotens: samma `request_id` ×10 samtidigt | 10 | 9 (kör 2: 1) | **1** | ❌ **BRAST** — 1–9 anropare fick `23P01` i stället för sitt eget boknings-id |
| A4 | Avboka + omboka SAMMA bokning samtidigt | 2 | 2 | 1 | ❌ **BRAST** — den avbokade bokningen flyttades ändå (lost update på app-vakten) |
| A5 | Två OLIKA bokningar flyttas till samma tid samtidigt | 2 | 1 | **1 på måltiden** | ✅ HÅLLER (förloraren: 23P01, originalet orört) |
| A6 | SAMMA bokning flyttas 2× samtidigt till samma tid | 2 | 2 | **1** | ✅ HÅLLER (radlås serialiserar, idempotent slutläge) |
| A7 | 10 samtidiga bokningar i lucka som PRECIS avbokades | 10 | 1 | 1 aktiv + 1 avbokad | ✅ HÅLLER |
| A8 | Återställ avbokning + ny bokning i samma lucka samtidigt | 2 | 1 | **1 aktiv** | ✅ HÅLLER (nybokningen avvisades 23P01) |
| A9 | Kant-mot-kant (10:00–10:30 + 10:30–11:00) | 2 | 2 | 2 | ✅ HÅLLER (tillåtet — `[)`) |
| A10 | Blandad last: 60 samtidiga anrop, 12 unika (resurs,tid) | 60 | 12 | **12** | ✅ HÅLLER (48× 23P01, 0 övriga fel) |
| A11 | Buffert-krock (buffer_min=15, nästa bokning direkt efter) | 2 | 2 | 2 | ⚠️ NOTIS — DB:n stoppar inte buffertkrock |

**Aldrig i något scenario:** en tappad bokning, en dubblett, en 500:a, en
timeout. Under 50-vägs-race fick vinnaren sin rad och alla 49 andra ett rent
`23P01` som appen redan översätter till "tiden togs precis" (`app/boka/actions.ts:330`).

---

## FYND 1 (P0) — Idempotens-skyddet läcker 23P01 vid samtidig retry

**Fil:** `supabase/migrations/0048_booking_idempotency.sql:116–120`

```sql
  exception when unique_violation then
    -- Race: två identiska retries samtidigt — förloraren läser vinnarens rad.
    if p_request_id is null then raise; end if;
    select b.id into v_id from public.bookings b
     where b.tenant_id = v_tenant and b.request_id = p_request_id;
```

Handlern fångar **bara `unique_violation` (23505)**. Två samtidiga inserts med
samma `request_id` krockar dock på **två** constraints: `bookings_tenant_request_id_uniq`
OCH `no_double_booking` (samma resurs, samma tid). Vilken som fyrar först är inte
garanterad — i praktiken vinner EXCLUDE-constrainten. Då kastas `23P01`, den
passerar handlern orörd, och anroparen får **"tiden togs precis — välj en annan tid"
för sin EGEN bokning**.

Mätt: 10 samtidiga anrop med samma request_id → **1 rad i DB:n (korrekt)**, men
9 anropare (kör 2: 1 anropare) fick 23P01 i stället för sitt boknings-id.

Det är exakt scenariot 0048 skrevs för att döda: kunden vars svar tappades gör en
retry, får "tiden är tagen" och **styrs aktivt mot en dold dubbelbokning**.
Dataintegriteten i DB:n håller — men användaren blir aktivt vilseledd.

*Sekventiell retry (efter commit) fungerar* — då träffar förhandskollen högst upp
i funktionen. Det är bara det samtidiga fönstret (dubbelklick, klient-retry,
proxy-retry) som läcker.

**Fix (ej gjord — bevisuppdrag):** utöka handlern till
`exception when unique_violation or exclusion_violation then` + samma
återläsning, och `raise` bara om ingen rad hittas.

---

## FYND 2 (P2) — moveBooking: TOCTOU, en avbokad bokning kan flyttas

**Fil:** `apps/web/lib/admin/calendar-actions.ts:113–137`

```ts
const { data: current } = await supabase.from('bookings')
  .select('start_ts, end_ts, status')...          // ← rad 113: LÄSER status
if (current.status === 'cancelled' || ...) return { error: ... }   // ← rad 120: VAKT
...
const { error } = await supabase.from('bookings')
  .update({ start_ts, end_ts, staff_id })
  .eq('id', input.bookingId).eq('tenant_id', tenant.id)            // ← rad 128-136: INGEN status-filter
```

Vakten på rad 120 läser statusen, men UPDATE:n på rad 136 filtrerar inte på den.
Avbokar någon mellan läsningen och skrivningen flyttas den avbokade bokningen ändå.
**Bevisat i A4:** slutstatus `cancelled`, `flyttad=true`.

Skadan är begränsad (ingen dubblett — EXCLUDE gäller inte cancelled-rader, och en
avbokad rad syns inte som upptagen), men den blir verklig om någon sedan trycker
**Ångra avbokning** (`restoreBooking`, rad 417): bokningen väcks då på en tid som
kunden aldrig fick veta om. Fixen är en rad: lägg
`.in('status', ['pending','confirmed','completed'])` på UPDATE:n så DB:n, inte
läsningen, avgör.

---

## FYND 3 (P2, notis) — bufferten är ingen krockspärr

`services.buffer_min` / `staff.buffer_min` finns, och `computeSlots`
(`lib/booking/availability.ts:56–104`) döljer tider vars `[t, t+duration+buffer)`
krockar. Men constrainten och `create_public_booking` känner inte till bufferten
(`end_ts = start + duration_min`). En bokning som äter upp bufferten kan alltså
skapas — via admin-vägen, via en direkt RPC, eller av en kund med en stale sida.
**Bufferten är en presentationsregel, inte ett skydd.** Bevisat i A11 + i
`lib/booking/conflict.test.ts` ("buffert döljer tiden i listan — men DB:n känner
inte till bufferten"). Detta är rimligen medvetet (ägaren ska få boka tätt), men
det bör vara ett *dokumenterat* val, inte en överraskning.

---

## B) Deterministiska enhetstester — `apps/web/lib/booking/conflict.test.ts` (14 tester, gröna)

Speglar constrainten som en ren funktion och kör **samma fall genom både DB-regeln
och `computeSlots`** — de får inte säga olika saker.

Täcker: exakt samma tid · kant-mot-kant (båda hållen) · inuti · omslutande ·
delvis överlapp åt båda håll · 1-minuts överlapp · annan resurs · cancelled/no_show
blockerar ingenting · completed blockerar · buffertfallet · frigjord lucka ·
korsvalidering (varje tid `computeSlots` erbjuder är krockfri enligt DB-regeln).

**Kant-mot-kant: kod och DB är överens — det är TILLÅTET.** `tstzrange` är
halvöppet `[)` och `overlaps()` i `availability.ts:47` använder strikt `<`.
En bokning 10:00–11:00 hindrar inte en start 11:00, och 09:00–10:00 hindrar den
inte heller. Verifierat både i DB (A9: 2 rader) och i koden.

---

## C) Läs-konsistens — kan två användare se olika data?

**Motbevisat på servern, sant (men ofarligt) i klienten.**

* Ingen cache i bokningsvägen. `app/boka/page.tsx:14`, `app/boka/layout.tsx:12`
  och `app/(admin)/admin/page.tsx:13` är alla `force-dynamic`. Ingen
  `unstable_cache`, ingen `revalidateTag`, ingen `fetch`-cache rör bokningar.
  (`revalidateTag('tenant:…')` finns bara i kurs-modulen.)
* Ingen realtidskanal. Noll träffar på `channel(` / `postgres_changes` i hela
  `apps/web`. Kalendern pollar inte heller — den läser vid render och efter
  `revalidatePath('/admin')` (`lib/admin/actions.ts:1617–1618`).
* Lediga tider hämtas alltid live: `app/boka/actions.ts:192` (`get_busy_intervals`)
  → `computeSlots`. Två användare som laddar samma sekund ser samma DB-snapshot.

**Det som ÄR stale:** en öppen flik. Kunden A får sin slot-lista, kund B bokar,
kund A:s flik vet inget. Men A:s klick går genom samma RPC → EXCLUDE avvisar →
23P01 → `app/boka/actions.ts:330` visar "tiden togs precis". **Stale UI leder
aldrig till en dubbelbokning, bara till ett ärligt fel.** Det är rätt design.
Den enda kvarvarande UX-skulden: listan uppdateras inte av sig själv (ingen
polling/realtid), så en upptagen tid ser ledig ut tills man klickar.

---

## Farligaste raderna

| Fil:rad | Risk |
|---|---|
| `supabase/migrations/0048_booking_idempotency.sql:116` | `exception when unique_violation` — fångar inte `exclusion_violation`. Idempotenta retries får 23P01 för sin egen bokning. **P0.** |
| `apps/web/lib/admin/calendar-actions.ts:120` + `:128-136` | Status-vakt läser, UPDATE filtrerar inte på status → avbokad bokning kan flyttas. **P2.** |
| `apps/web/lib/booking/availability.ts:70` (`reservedMs = duration + buffer`) | Buffert finns bara här, inte i DB:n → buffertkrock kan skrivas. **P2, ev. medvetet.** |
| `apps/web/lib/admin/actions.ts:1603-1604` | Hanterar 23P01 vid återaktivering — korrekt, men enda stället som gör det för status-vägen. Nya statusvägar måste kopiera det. |

## Vad som INTE testades

* `slot_holds` (migration 0014) är **inte applicerad** i DB:n → holds finns inte,
  ingen squat-risk att testa.
* Betalningsvägen (Stripe) och notismejl — utanför krockskyddets scope.
* Playwright `@mutating` kördes aldrig (regeln: aldrig mot molndatabasen).
  Hela A-sviten är ett fristående Node-skript mot en isolerad fejktenant.
