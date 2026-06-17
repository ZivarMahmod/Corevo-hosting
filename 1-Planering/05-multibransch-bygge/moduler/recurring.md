# Modul: Återkommande bokning (recurring)

> Status-källa: DB-sanning + cfg-data. **ROADMAP** (`live:false` i mockup, ingen rad i `modules`, ingen tabell än). **Påslag på booking** — bygg INTE fristående. Cross-ref: `booking.md`. Görs per riktig kund som kräver den (build-once, princip 10).

## 1. Kärna (universell)

En bokning som **upprepas på en regel** (vecka / varannan vecka / månad). Inte en ny boknings-typ — en **serie** som genererar vanliga `bookings`-rader framåt. Kunden kan pausa/avsluta serien; admin ser den som EN serie, inte 50 lösa rader.

- **Tillägg ovanpå booking** (cfg-data `recurring.why`: "Påslag på bokningsmodulen"). All boknings-kärna (dubbelboknings-constraint, RPC, RLS, lediga-tider) ärvs från `booking.md` §1 — recurring äger BARA serie-regeln + genereringen.
- **owns_tables (NY):** `booking_series` (regel) + skriver till befintliga `bookings` (cfg-data `recurring.tables: ["booking_series (ny)", "bookings"]`).
- **Genereringslogik:** `booking_series` håller en regel (rrule/intervall) → genererar `bookings` framåt (cfg-data `recurring.build`). Varje genererad rad är en helt vanlig bokning → ärver dubbelboknings-skydd, loyalty-trigger, status-history automatiskt.
- **Livscykel:** serien kan pausas/avslutas av kund; framtida genererade bokningar stoppas/avbokas.

## 2. Universal vs variant — beslut + axlar

**Beslut: EN recurring-motor som påslag på EN booking-motor. Aldrig per bransch.** Bara två branscher använder den (städ, klinik) och skillnaden är ren config.

> **variant_schema (förslag, NY — ingen i DB idag):** `recurring.frequency` enum = `weekly | biweekly | monthly` · params: `interval` (int, default 1), `count`/`until` (slut), `weekday`/`day_of_month`. Detta är ett rent modul-`variant_schema` (lager 1, princip 10) — samma enum för alla branscher, bara olika default.

### Lager (princip 10)

| Lager | Booking-recurring-exempel |
|---|---|
| 1. `variant_schema` (modul) | `frequency: weekly\|biweekly\|monthly` + `interval`/`until` (samma för alla) |
| 2. `verticals.rules` | `booking.recurring: true` flaggar att serien erbjuds för branschen |
| 3. `verticals.terminology` | ärver booking-orden (Städare/Behandlare) |
| 4. `tenant_modules.config` | per kund: default-frekvens, max horisont (hur långt fram serien genereras), avboknings-varsel (t.ex. 48h) |

**Varför aldrig forkad:** städ och klinik gör exakt samma sak — en regel som spottar ut framtida bokningar. "Veckovis städ" och "behandlingsserie varje vecka" är identisk logik med olika ord. En fork = duplicerad rrule-motor för noll vinst. En kund som vill ha "varannan vecka utom juli" = config, inte kod.

## 3. Per bransch — branscher som använder modulen (från backloggen)

| Bransch | variant-val | UI-skillnad (storefront) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| **städ** 🌱 | `frequency: weekly/biweekly/monthly` · ärver `object:slot` + `capture:[adress]` från booking · terms: Städare/Städtyp | Vid bokning: välj "Återkommande" → frekvens (Varje vecka / Varannan vecka / Varje månad). Mockup `ModRecurring` visar dessa tre + "Avboka enkelt med 48h varsel." | Boka första tiden → serie genererar resten framåt på samma veckodag/tid + adress | Hemstäd/kontorsstäd är nästan alltid abonnemang (vecka/varannan/månad) → förutsägbar intäkt för städaren, oavbruten städ för kunden. [1] |
| **klinik** 🌱 | `frequency: weekly/monthly` · ärver `object:slot` (45–90 min) + `capture:[intag]` · terms: Behandlare/Behandling | "Fast tid varje vecka/månad" (behandlingsserie) | Behandlingsserie: samma behandlare, samma tid, X gånger | Rehab/naprapat/psykolog jobbar i serier (t.ex. 10 ggr varannan vecka) — patienten vill ha samma fasta tid. [klinik-rad i cfg-data] |

> Andra branscher kan slå på `recurring` om en kund vill (samma motor), men backloggen listar bara städ + klinik som behov. Bygg per riktig kund.

## 4. DB-form

| Tabell | Roll | Nyckelkolumner | RLS | LIVE/NY |
|---|---|---|---|---|
| `booking_series` | Serie-regeln | `id`, `tenant_id`, `customer_id`, `staff_id` (NULL om `staff_pick:false`), `service_id`, `rrule`/`frequency`+`interval`, `start_date`, `until`/`count`, `time_of_day`, `address` (städ), `status` (active/paused/ended) | Kund ser egna serier (`current_customer_id()`); personal (`role_level()>=3`) ser tenantens; **ingen anon** (serie skapas inloggad eller via RPC efter första bokning) | **NY/migration** — Zivar-go |
| `bookings` | Genererade enskilda bokningar | + ev. `series_id → booking_series` (NY FK) för att binda raden till sin serie | Som booking.md §4 (ingen anon-läs på `bookings`) | LIVE (FK `series_id` = NY) |

**FK-kopplingar:** `booking_series.tenant_id → tenants`, `.customer_id → customers/customer_profiles`, `.service_id → services`, `.staff_id → staff`. `bookings.series_id → booking_series` (NY, nullable — lösa bokningar har NULL).

**RLS-svar:** Anon-läs? **Nej** (serier är kundkopplade, inte publika). role_level>=3? **Ja** — personal hanterar/ser tenantens serier. Generering bör köras SECURITY DEFINER (RPC/cron) så den respekterar dubbelboknings-constraint precis som `create_public_booking`.

## 5. Två ytor

**Storefront (besökare)** — i boknings-flödet: en "Återkommande?"-växel → frekvensval. Mockup `ModRecurring` (preview.jsx) visar tre frekvenser + nästa/planerade datum + "Avboka enkelt med 48h varsel." Kund kan pausa/avsluta serien i "Mitt konto".

**Admin (ägare)** — serien visas som EN post (inte 50 rader) med "nästa" + "planerade" tider. Ägaren kan avbryta serien, hoppa över en gång, eller boka om. Ärver booking-kalendern (genererade rader syns där som vanliga bokningar, märkta med serie).

## 6. Verklighets-koll

- **Funkar för båda branscher?** Ja — identisk regel-motor, bara ord + default-frekvens skiljer.
- **Edge cases:**
  - **Krock med befintlig bokning** vid generering — en genererad rad kan kollidera (helgdag, annan kund tog tiden). Genereringen måste hantera "hoppa/flagga konflikt" snarare än att krascha mot dubbelboknings-constraint. **§8.**
  - **Hur långt fram genereras?** Rullande horisont (t.ex. 8 veckor) via cron, eller hela serien direkt? Rullande = mindre skräp vid avslut. **§8.**
  - **Pris/betalning** — abonnemang implicerar återkommande betalning, men betal-rails är pausade (14.2). Recurring idag = bara schemaläggning, ingen autodebitering. När rails öppnas: detta blir prenumerations-fakturering (moms/kvitto per tillfälle). [1]
  - **Avboknings-varsel** — mockup säger 48h. En enskild instans vs hela serien måste gå att avboka separat.
- **Svenska krav:** GDPR — `booking_series` för klinik kopplar patient + behandlingsserie = känsligt → samma hårda RLS + ev. kryptering som klinik-booking. Moms/kvitto bara relevant när betalning slås på (då: kvitto per genererad bokning, ej per serie).
- **Lätt missat:** (a) genererade rader måste ärva ALLT från en vanlig bokning (loyalty, status-history) — annars tappar serie-bokningar funktioner; (b) "paus" måste stoppa framtida generering utan att radera historik (`block_booking_hard_delete` gäller); (c) tidszon (Europe/Stockholm) + sommartid får inte glida i genererade tider.

## 7. Status idag vs bygg

| Del | Status |
|---|---|
| Boknings-kärnan recurring bygger på | **Finns** (booking.md, LIVE) |
| `booking_series`-tabell + `frequency` variant_schema | **NY** — ingen rad i `modules`, ingen tabell (cfg-data `live:false`). Schema bara på Zivar-go. |
| Genererings-logik (rrule → bookings, rullande horisont) | **Nybygge** |
| `bookings.series_id` FK | **NY/migration** |
| Storefront frekvens-växel + "Mitt konto" pausa/avsluta | **Nybygge** (mockup `ModRecurring` = referens, ej kod) |
| Admin serie-vy | **Nybygge** |

> Loop-skydd (RITNING §4): recurring är en av roadmap-modulerna — bygg INTE förrän en riktig kund (städ/klinik) kräver den, och först på Zivars go. Märk "Roadmap" i studion tills dess.

## 8. Öppna beslut för Zivar

1. **rrule vs enkelt enum** — full RFC-5545 rrule (kraftfullt, komplext) eller bara `frequency+interval+until` (täcker städ/klinik)? Förslag: börja enkelt (enum).
2. **Genererings-horisont** — hela serien direkt vs rullande fönster via cron. Förslag: rullande (t.ex. 8 v) → mindre skräp vid avslut.
3. **Konflikt vid generering** — hoppa över + notifiera, eller boka närmaste lediga? Beslut om beteende.
4. **Avboknings-granularitet** — en instans vs hela serien; varsel-regel (48h?) per kund i `tenant_modules.config`?
5. **Betalning** — när rails öppnas: blir recurring autodebitering/abonnemang? (Idag: schemaläggning only.)
6. **`booking_series` schema** — godkänn migration (schema bara på go).

## 9. Källor

**DB-doc + repo-filer:**
- `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §0b (LIVE vs ROADMAP), §8 (befintliga triggers som genererade rader ärver), §4 (RLS-nivåer).
- `4-Dokument-Underlag/01-acceptans/super-admin/cfg-data.js` → `MODULES.recurring` (`live:false`, `tables:["booking_series (ny)","bookings"]`, `build`, `why`, `variants: {stad, klinik}`).
- `4-Dokument-Underlag/01-acceptans/super-admin/preview.jsx` → `ModRecurring` (frekvenser, "Avboka enkelt med 48h varsel").
- `1-Planering/05-multibransch-bygge/09-modul-bransch-spec-backlog.md` (recurring under Städ + Privatklinik; "De 9 NYA modulerna" → `booking_series (rrule) → genererar bookings`).
- `1-Planering/05-multibransch-bygge/10-arkitekturprincip-universal-vs-variant.md` (regel: påslag = variant/config, inte ny fork).
- Cross-ref: `moduler/booking.md` (all boknings-kärna ärvs härifrån).

**Webb (verklighet, best practice):**
- [1] Återkommande städ vecka/varannan/månad = abonnemang, förutsägbar intäkt, autobokning + påminnelser: [Anolla cleaning software](https://anolla.com/en/cleaning-service-software) · [Jobber recurring visits](https://schedulingkit.com/scheduling-software/cleaning-services) · [Housecall Pro recurring jobs](https://www.housecallpro.com/industries/maid-service-software/) · [FieldVibe recurring](https://www.fieldvibe.com/free-cleaning-scheduling-app)
