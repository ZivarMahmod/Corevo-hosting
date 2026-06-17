# Modul: Bokning (booking)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. LIVE i DB idag. Djupaste modulen — 12 branscher använder den. Idag INTE bransch-medveten i kod (bara `wizard`/`compact`-läge). Följer princip 10: EN motor, aldrig fork.

## 1. Kärna (universell)

Boka en **tid** hos en tenant. Ett flöde, samma motor för alla branscher:

**välj objekt (tjänst/bord/syntest) → ev. personal → ledig tid → kontaktuppgifter → bekräftelse.**

- **owns_tables (LIVE):** `bookings`, `services`, `staff`, `staff_services`, `working_hours`, `time_off`, `slot_holds` (källa: DB-sanning §1.1).
- **Skrivning sker ALDRIG som direkt INSERT** — alltid via RPC `create_public_booking(...)` (SECURITY DEFINER, anon-anrop). Besökaren har ingen INSERT-policy på `bookings` (DB-sanning §4.2).
- **Dubbelbokning omöjlig på DB-nivå:** EXCLUDE-constraint `no_double_booking` (btree_gist) + index `bookings(barber_id, starts_at)` (DB-sanning §1.1 / cfg-data `MODULES.booking.build`).
- **Lediga tider** drivs av RPC `get_busy_intervals(...)` + `seed_explicit_slots_from_hours(staff, step)` (genererar bokningsbara slots ur `working_hours`). `slot_holds` håller en tid tillfälligt under check-out.
- **Default state:** `tenant_modules` → `booking: live`. "Utan den finns ingen produkt" (cfg-data `why`). Kärnmodul i praktiken.
- **payment_status:** `unpaid` / `pay_on_site` som standard (betal-rails pausade, beslut 14.2). Deposit-grind = separat modul (se `deposit.md`).
- **Automation som redan finns** (DB-sanning §8): `get_public_booking(id)` (bekräftelsesida), `earn_loyalty_on_completed()` (trigger → loyalty), `record_booking_status_change()` (→ `booking_status_history`), `expire_abandoned_pending_bookings(ttl)` (cron städar pending), `check_rate_limit(...)` (spam-skydd), `tenant_modules_state_guard()`, `block_booking_hard_delete()` (append-only-skydd).

## 2. Universal vs variant — beslut + axlar

**Beslut: EN booking-motor. Bransch-skillnad = config i lager, aldrig en fork, aldrig kundkod** (princip 10).

> ⚠️ **DB-sanning vs mockup-konflikt (måste lösas av Zivar — se §8):** `02-Arkitektur-sanning.md §1.1` säger booking har `variant_schema: {}` ("ingen variant — beteende styrs av `services`/`staff`-data"). Men mockupen (`cfg-data.js`) + RITNING §2 + §7.2-exemplet säger beteendet ska härledas ur **`verticals.rules.booking`** (`object`, `capture`). **Båda är "data, inte kod" → uppfyller principen.** Tolkningen i denna spec: booking har inget eget enum-`variant_schema`; varianten bor i **`verticals.rules.booking`** (lager 2) + **`verticals.terminology`** (lager 3) + **`tenant_modules.config`** (lager 4). Det matchar DB-sanningens "beteende styrs av data" OCH mockupens `rules.booking.object`.

### De fyra lagren applicerade på booking (princip 10)

| Lager | Var | Booking-exempel |
|---|---|---|
| 1. `variant_schema` (enum+params på modulen) | `modules.variant_schema` | **Tomt idag** (`{}`). Om enum behövs senare: se §8-förslag `object` som modul-enum. Default: härled ur lager 2. |
| 2. `verticals.rules.booking` (objekt + capture) | `verticals.rules` (jsonb) | `object: slot \| table \| dropoff \| syntest` · `staff_pick: true \| false` · `slot_source: service \| fixed` · `capture: [adress, party_size, fordon, husdjur, intag]` · `deposit_gate: true \| false` |
| 3. `verticals.terminology` (orden i UI) | `verticals.terminology` (jsonb) | `staff`: Frisör/Behandlare/Mekaniker/Artist · `service`: Behandling/Servicetyp/Bord · `unit`: tid/fordon/bord |
| 4. `tenant_modules.config` (per kund) | `tenant_modules.config` (jsonb) | Override branschens default: t.ex. en frisör som stänger av personal-val, eller en klinik som sätter slot 60 min. |

### Variant-axlar (det som faktiskt skiljer branscher) — alla = data

- **`object`** — vad man bokar: `slot` (person-tid), `table` (bord + party_size), `dropoff` (inlämningstid, ej exakt slot), `syntest` (fast tjänst-slot, ingen personal). Härleds ur `verticals.rules.booking.object`.
- **`staff_pick`** (personal-val on/off) — frisör/nagel/klinik/tatuering = on; bilverkstad/cykel/optiker/städ/restaurang = off. `staff` på bokningen kan vara NULL.
- **`slot_source`** — slot-längd ur `services.duration_min` (per tjänst) eller fast (`fixed`, t.ex. optiker 30 min, restaurang 90–120 min).
- **`capture[]`** — extra fält som fångas och var de hamnar: `adress` → `bookings.address`/`comment`, `party_size` → `bookings.party_size` (NY kolumn, se §4), `fordon`/`husdjur`/`intag` → FK till respektive roadmap-modul-tabell (`vehicles`/`pets`/`intake_forms`), annars NULL.
- **`deposit_gate`** — kräver deposit innan `confirmed` (tatuering). Ägs av deposit-modulen (`deposit.md`), booking läser bara flaggan.

**Varför aldrig forkad:** alla 12 branscher gör samma sak — reserverar en tid utan dubbelbokning, mot samma `bookings`-tabell, samma RPC, samma RLS, samma kalender-admin. Skillnaderna (objekt, ord, fält) är 100% uttryckbara som rader i `verticals` + jsonb-config. En fork skulle duplicera dubbelboknings-constraint, RLS och kalender 12 gånger → 12× buggyta, 0 vinst. En kundspecifik regel = `tenant_modules.config`, aldrig en if-sats på tenant-id.

## 3. Per bransch — alla 12 från backloggen (`09-...backlog.md`)

| Bransch | variant-val (rules/terminology) | UI-skillnad (storefront) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| **frisör** ✅bransch | `object:slot` · `staff_pick:true` · `slot_source:service` (20–45 min) · terms: Frisör/Behandling | Tjänst → frisör → tid → bekräfta | Personal-val (`staff_id`/barber_id), tjänstetyp (`service.category`), korta slots | Klassisk tid+person. Kunden vill ofta ha "sin" frisör. |
| **nagel** ✅bransch | `object:slot` · `staff_pick:true` (valbart) · `slot_source:service` (korta) | Som frisör; personal-val kan döljas | Tjänst + ev. personal, korta slots | "Som frisör" (cfg-data `nagel`). Ibland vem-som-helst. |
| **klinik** 🌱 | `object:slot` · `staff_pick:true` · `slot_source:service` (45–90 min) · `capture:[intag]` · terms: Behandlare/Behandling | Behandlare → behandling → längre tid; ev. hälsoformulär-länk | Längre slots, journalanteckning (`bookings.comment`, krypterad), intag-modul kopplad | Legitimerad vård, längre besök, känslig data (GDPR → intag.md). |
| **bilverkstad** 🌱 | `object:dropoff` · `staff_pick:false` · `capture:[fordon]` · terms: Mekaniker/Servicetyp | Servicetyp → **inlämningsdag/-fönster** (ej exakt minut) → fordon → bekräfta | Drop-off-tid istället för exakt slot, ingen personal-val, fordonsinfo kopplad (modul fordon → regnr/märke) | Verkstaden sekvenserar jobb internt kring tekniker + delar; kunden lämnar bilen på morgonen, får "klar"-notis. Stagger drop-offs, inte alla 08:00. [3] |
| **cykel** 🌱 | `object:dropoff` · `staff_pick:false` · `capture:[inlamning]` · terms: Mekaniker/Servicetyp | Servicetyp → inlämning → beskriv cykel | Service-typ, inlämning kopplad (modul inlamning), ingen personal-val | Samma logik som verkstad: lämna in, hämta klart. Kvittonr via inlämnings-modul. |
| **hund** 🌱 | `object:slot` · `staff_pick:false` · `slot_source:service` (60–90 min, **storleksstyrd**) · `capture:[husdjur]` · terms: Personal/Behandling | Tjänst → tid; slot-längd följer hundstorlek | Hundstorlek styr slot-längd, ras kopplad till husdjursprofil (modul husdjur) | Liten korthårig ≈ 30–60 min; stor dubbelpäls ≈ 2–2,5 h; svårt mattad ≈ 3 h. Slot måste variera med storlek/päls. [4] |
| **tatuering** 🌱 | `object:slot` · `staff_pick:true` (artist) · `slot_source:service` (session-längd) · `deposit_gate:true` · terms: Artist/Session | Artist → session → tid → **deposit krävs innan bekräftelse** | Artist-val (`staff_id` som artist), session-längd, **deposit grindar `status`** (modul deposit) | Artisten har rit-/förberedelsetid; deposit skyddar mot no-show och täcker förlorad lön. Bekräftas först när deposit betald. [1] (→ deposit.md) |
| **restaurang** ✅bransch | `object:table` · `staff_pick:false` · `slot_source:fixed` (90–120 min) · `capture:[party_size]` · terms: —/Bord | **Antal personer** → datum/tid → bekräfta. INGEN tjänst, INGEN personal | Party_size istället för tjänst, längre fasta slots, ingen tjänstetyp/personal. `bookings.party_size` | Man bokar ett bord för X gäster, inte en person/tjänst. Sittning typiskt 1,5–2 h; bord hålls 15–30 min grace. Ev. deposit vid stora sällskap/peak. [2] |
| **städ** 🌱 | `object:slot` (hembesök) · `staff_pick:false` · `capture:[adress]` · `recurring:true` · terms: Städare/Städtyp | Städtyp → datum → **adress + access-info** → ev. återkommande | Adress (`bookings.address`/`comment`), access-info, återkommande-flagga (modul recurring) | Jobbet sker hemma hos kund → adress + nyckel/portkod krävs. Ofta vecka/varannan/månad (→ recurring.md). [5] |
| **fotograf** 🌱 | `object:slot` · `staff_pick:false` (oftast solo) · `slot_source:service` · `capture:[adress?]` · terms: —/Shoot-typ | Shoot-typ → plats (studio/on-location) → längd → tid | Shoot-typ (`service.category`), plats on-location vs studio, längd | Olika shoot-typer (porträtt/event/produkt) = olika längd och plats. On-location kräver adress. |
| **skräddare** 🌱 | `object:slot` (provning) ELLER `dropoff` (upphämtning) · `staff_pick:false` · `capture:[inlamning]` · terms: —/— | Två slot-typer: **provning** (boka tid) vs **upphämtning** (lämna plagg) | Provning ELLER upphämtning (två slot-typer), plagg-koppling (modul inlamning) | Provning kräver att kunden är där en bestämd tid; upphämtning/inlämning är drop-off. Två lägen i samma motor. |
| **optiker** 🌱 | `object:syntest` · `staff_pick:false` · `slot_source:fixed` (30–45 min) · terms: —/Syntest | Syntest → fast tid → bekräfta. Ingen personal | Syntest-bokning, ingen personal-val, fast slot-längd | Syntest är en standardiserad tjänst med fast längd; vilken optiker som helst utför den. |

> **Inte i den primära booking-listan men nämnda i cfg-data** (booking sällan primär): **florist** (booking sällan — kör shop/offert; ev. konsultation), **café** (bordsbokning valfri — annars meny+shop), **second hand** (booking sällan — inlämningstid via inlamning), **låssmed** (utryckning vs bokad tid · adress · brådska-flagga). Dessa aktiverar booking bara om kunden vill; samma motor, `object` enligt behov.

## 4. DB-form

**Allt LIVE idag** (källa: DB-sanning §1.1 + §4) utom de markerade tilläggen.

| Tabell | Roll | Nyckelkolumner | RLS | LIVE/NY |
|---|---|---|---|---|
| `bookings` | Själva bokningen | `id`, `tenant_id`, `staff_id` (NULL om `staff_pick:false`), `service_id` (NULL för table/syntest), `starts_at`, `ends_at`, `status`, `payment_status`, `comment`, **`party_size`** (NY — restaurang), **`address`** (NY el. via `comment` — städ/foto) | Anon: **ingen** direkt-läs/skriv. Skapas via RPC. Kund ser egna (`current_customer_id()`). Personal (`role_level()>=3`) ser tenantens. | LIVE (kolumn `party_size`/`address` = **NY/migration** om de inte finns — Zivar-go) |
| `services` | Tjänster/behandlingar/shoot-typer | `id`, `tenant_id`, `category`, `duration_min`, `price`, `active` | **Anon SELECT** (active) | LIVE |
| `staff` | Personal/behandlare/artister/mekaniker | `id`, `tenant_id`, `active` | **Anon SELECT** (active) | LIVE |
| `staff_services` | Vilken personal gör vilken tjänst | `staff_id`, `service_id` | **Anon SELECT** | LIVE |
| `working_hours` | Öppettider/scheman | `tenant_id`, `staff_id`, dag/tid | **Anon SELECT** | LIVE |
| `time_off` | Frånvaro/stängt | `tenant_id`, `staff_id`, spann | personal/anon-läs (driver lediga slots) | LIVE |
| `slot_holds` | Tillfällig reservation under checkout | `tenant_id`, slot, ttl | via RPC | LIVE |
| `working_hour_slots` | Genererade bokningsbara slots | per `seed_explicit_slots_from_hours` | **Anon SELECT** (DB-sanning §4.2 listar `working_hour_slots`) | LIVE |
| `booking_status_history` | Audit av statusbyten | append-only | personal-läs; `block_audit_mutation()` | LIVE |

**FK-kopplingar:** `bookings.tenant_id → tenants`, `.staff_id → staff`, `.service_id → services`. Vid roadmap-moduler: `.vehicle_id → vehicles` (fordon), `.pet_id → pets` (husdjur), `.intake_id → intake_forms` (intag) — **alla NY**, byggs per kund (DB-sanning §7.2, princip "build-once").

**RLS-svar (på frågorna i mallen):**
- **Anon-läs?** Ja för `services`/`staff`/`staff_services`/`working_hours`/`working_hour_slots`/`locations` (för att kunna visa lediga tider). **Nej** för `bookings` (skydd mot att se andras bokningar).
- **role_level>=3?** Ja — ägare/personal ser och hanterar tenantens bokningar via `private.role_level() >= 3` + matchande `tenant_id`.
- **Skrivning:** anon skriver bokning **enbart** via `create_public_booking(...)` (SECURITY DEFINER). Ingen INSERT-policy för anon på `bookings` (DB-sanning §4.2).

## 5. Två ytor

**Storefront (besökare)** — `MODULE_FACES.booking.sf`: "Besökaren bokar tid: tjänst → tid → bekräftelse." Bransch-medveten rendering enligt `verticals.rules.booking.object`:
- `slot` → tjänst (+ ev. personal) → kalender → kontakt → bekräftelse.
- `table` → party_size-väljare → datum/tid → kontakt (ingen tjänst/personal).
- `dropoff` → servicetyp → inlämningsfönster + (fordon/cykel-fält) → bekräftelse.
- `syntest` → fast tjänst → tid → bekräftelse.
- Kod idag: `components/booking/BookingWizard.tsx` + `BookingMount` vid `<corevo-module>`-markör (RITNING §1). Kör bara `wizard`/`compact` — **bransch-medvetenhet saknas** (enda nybygget i modul-lagret, RITNING §2).

**Admin (ägare)** — `MODULE_FACES.booking.adm`: "Ägaren ser bokningskalendern, av-/ombokar och sätter scheman." Lägger `services`/`staff`, sätter `working_hours`/`time_off`. Core-yta (RITNING §1: admin-komp = "(core)"). Bransch påverkar etiketter (terminology) men inte kalender-logiken.

## 6. Verklighets-koll

- **Funkar varje variant i samma motor?** Ja — `slot`/`table`/`dropoff`/`syntest` är fyra renderingar av samma "reservera tid utan dubbelbokning". Skillnaden är vilka fält som visas/sparas, inte själva motorn.
- **Edge cases:**
  - **Restaurang utan personal/tjänst** — `staff_id` + `service_id` får vara NULL; slot-längd = fast (`rules.slot_source:fixed`). Dubbelboknings-constraint måste fortfarande hindra två bokningar på samma bord/tid → constraint behöver kunna scope:a på "kapacitet" (antal bord), inte bara `staff_id`. **Öppen fråga, §8.**
  - **Drop-off (verkstad/cykel)** — ingen exakt minut → boka mot ett **fönster** (t.ex. "lämna 07–09"). Constraint på exakt `starts_at` passar dåligt → drop-off räknar kapacitet per dag, inte per minut. **§8.**
  - **Hund storleksstyrd slot** — slot-längd måste kunna sättas per tjänst×storlek; idag bara `services.duration_min`. Lös via flera service-rader (Liten/Mellan/Stor) = data, ingen kod. [4]
  - **No-show** — täcks delvis av `expire_abandoned_pending_bookings` (pending). No-show på bekräftad bokning = manuell statusändring i admin (eller deposit behålls, → deposit.md).
- **Svenska krav:**
  - **GDPR** — `bookings.comment` för klinik = journal/känsligt → krypterad + hård RLS (DB-sanning nämner kryptering; intag-modulen tar pnr/symtom separat). `customer_contact_hash()` + `scrub_customer_notes_on_anonymize()` finns redan (DB-sanning §8).
  - **Moms/kvitto** — bara relevant när betalning sker. Betal-rails pausade (14.2) → ingen moms/kvitto-hantering i booking idag. När deposit/betalning slås på: kvitto + moms måste in (svensk bokföringslag). Ej i scope nu.
- **Vad som lätt missas:** (a) party_size/address-kolumner finns kanske inte → migration krävs (Zivar-go); (b) dubbelboknings-constraint är byggd kring `barber_id`/`staff_id` → table/dropoff bryter antagandet; (c) terminology måste täcka ALLA ord per bransch annars läcker "Frisör" in på en verkstad; (d) `staff_pick:false` får inte tvinga fram ett tomt personal-steg.

## 7. Status idag vs bygg

| Del | Status |
|---|---|
| `bookings`+6 tabeller, RPC `create_public_booking`, dubbelboknings-constraint, lediga-tider, loyalty-trigger, status-history, cron-städ | **Finns i kod/DB** (LIVE) |
| `components/booking/BookingWizard.tsx` (wizard/compact) | **Finns** men generiskt `staff`/`service` |
| Bransch-medvetenhet (`object: slot/table/dropoff/syntest` ur `verticals.rules`) | **Nybygge** — enda riktiga modul-nybygget (RITNING §2). Config-driven, inga nya tabeller för slot/table. |
| `verticals.rules.booking` + `terminology` ifyllda per bransch | **Variant-config kvar** — en `verticals`-rad per bransch (DB-sanning §7.2). Billigt. |
| `bookings.party_size` / `.address` kolumner | **NY/migration** om saknas — Zivar-go (schema bara på go) |
| FK till `vehicles`/`pets`/`intake_forms` | **NY** — byggs per kund med respektive roadmap-modul (fordon/husdjur/intag) |
| Deposit-grind | **Separat modul** (deposit.md), rails pausade |
| Drop-off kapacitet-bokning (fönster ist. exakt slot) | **Öppen/nybygge** — §8 |

> Loop-skydd (RITNING §4): bygg INTE om befintliga sektioner — justera. Skapa INGA nya tabeller utan Zivars go. Rör INTE betal-rails.

## 8. Öppna beslut för Zivar

1. **variant_schema vs verticals.rules** — DB-sanning §1.1 säger `variant_schema:{}`; mockup+RITNING säger `verticals.rules.booking.object`. **Bekräfta:** booking-varianten bor i `verticals.rules` (lager 2), inte ett modul-enum. (Denna spec antar det.)
2. **`object: table` (restaurang)** — kräver kapacitets-modell (antal bord) så dubbelboknings-constraint fungerar utan `staff_id`. Egen kapacitetstabell, eller `staff`-rader som "bord"? Beslut om schema (bara på go).
3. **`object: dropoff` (verkstad/cykel/skräddare-upphämtning)** — boka mot **dagsfönster** ist. exakt slot. Hur räknar vi kapacitet/dag? Ny kolumn/regel?
4. **`bookings.party_size` + `.address`** — finns de? Annars migration (go krävs).
5. **Hund storleksstyrd slot** — accepterar vi "flera service-rader per storlek" (data) som lösning, eller behövs storleks-axel i schema?
6. **När en bransch onboardas** — vem fyller `verticals.rules`/`terminology`? Super-admin-studio vs seed-migration.
7. **No-show-policy utan deposit** — manuell admin-status räcker, eller automatik?

## 9. Källor

**DB-doc + repo-filer:**
- `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.1 (booking owns_tables, `variant_schema:{}`, RPC), §4 (RLS-nivåer + anon-läs exakt), §7.2 (verticals-rad-exempel bilverkstad), §8 (befintliga RPC/triggers), §9 (Lansera-sekvens).
- `4-Dokument-Underlag/01-acceptans/super-admin/cfg-data.js` → `MODULES.booking` (tables, build, why, `variants.*` per bransch), `BRANCHES.*` (terms, rec/opt, variant), `MODULE_FACES.booking`.
- `4-Dokument-Underlag/01-acceptans/super-admin/preview.jsx` → `ModBooking` (storefront-rendering), `ModuleSection`, `SECTION_TITLES`.
- `1-Planering/05-multibransch-bygge/09-modul-bransch-spec-backlog.md` (alla branscher + byggstatus).
- `1-Planering/05-multibransch-bygge/10-arkitekturprincip-universal-vs-variant.md` (4 lager, regel variant vs ny modul).
- `1-Planering/06-sajtbyggare/02-RITNING-v3-moduler-storefront.md` §1 (modul-matris, kod-komp), §2 (booking bransch-medveten = enda nybygget), §4 (loop-skydd).

**Webb (verklighet, best practice):**
- [1] Tattoo deposit-normer (procent/flat, non-refundable, no-show, 48–72h varsel): [MyTattoo deposit guide](https://mytattoo.software/blog/tattoo-deposit-guide/) · [Venue Ink deposits strategy](https://www.venue.ink/blog/how-to-handle-tattoo-deposits-strategy) · [InkDesk no-show best practices](https://inkdesk.app/blog/avoiding-no-shows-best-practices-for-tattoo-artists)
- [2] Restaurang bord/party_size, sittning 1,5–2 h, grace 15–30 min, deposit vid stora sällskap: [SevenRooms reservation deposits](https://sevenrooms.com/blog/restaurant-reservation-deposits/) · [Push Operations no-show fees](https://www.pushoperations.com/blog/understanding-restaurant-reservation-deposits-and-no-show-fees) · [Carbonara hold time](https://www.carbonaraapp.com/reservation-no-show/) · [Toast reservation etiquette](https://pos.toasttab.com/blog/on-the-line/restaurant-reservation-etiquette)
- [3] Bilverkstad drop-off (staggra, morgon-fönster, "klar"-notis): [Identifix scheduling best practices](https://www.identifix.com/blogs/auto-repair-shop-scheduling-best-practices-for-maximizing-efficiency/) · [BayIQ scheduling](https://blog.bayiq.com/appointment-scheduling-best-practices)
- [4] Hundsalong slot-längd per storlek/päls: [Williamsburg Pet Hotels — how long grooming takes](https://williamsburgpethotels.com/how-long-does-dog-grooming-take/) · [MoeGo grooming software](https://www.moego.pet/blog/best-dog-grooming-appointment-software)
- [5] Optiker syntest + verklighets-bransch-kontext: branschpraxis (fast slot-längd syntest), se booking-software-jämförelser ovan.
