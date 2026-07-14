# Bransch-lagret i bokningsmotorn — vad är GEMENSAMT, VALBART, BRANSCHSPECIFIKT?

> Corevo = EN motor, EN DB, EN kodbas. Branschen ska överlagra ORD och MODULER —
> aldrig forka koden. Den här kartan säger var det stämmer idag, och var det inte gör det.
>
> Skriven 2026-07-14 (C-06/C-07). Faktabas: `verticals`-tabellen + `bookings`-schemat i
> live-DB (`clylvowtowbtotrahuad`), inte antaganden. Testet som bevakar detta:
> `5-Kod/apps/web/lib/admin/bransch-kalender.test.ts`. Vakten: `scripts/vakt-bransch.mjs`.

## 0. Nuläget i DB (mätt, inte gissat)

**Branscher som FINNS** (`select key from verticals`): `barbershop`, `florist`, `frisör`,
`generell`, `nagelstudio`, `restaurang`.

**Branscher Zivar kräver stöd för som INTE finns:** `ateljé`, `tatueringsstudio`,
`cykelverkstad`, `verkstad`, `ekonomibyrå`, `rådgivning`. De är inte blockerade av motorn —
de är bara inte seedade. Ateljé är prio 3 och behöver en rad.

**Terminologi-nycklar i bruk** (`lib/platform/actions/verticals.ts`): `staff`, `staff_plural`,
`service`, `unit`, `business`, `primary_cta_label`, `primary_cta_href`.

**Bokningsraden** (`bookings`): `staff_id` **NOT NULL**, `service_id` **NOT NULL**,
`location_id` **NOT NULL**, `start_ts`/`end_ts` NOT NULL, `status`, `customer_profile_id` (null-bar).
Det finns **ingen** objekt-/resurs-/tillgångstabell i hela schemat. **Personalen ÄR resursen.**

---

## 1. GEMENSAM — samma för alla branscher, aldrig bransch-medveten

Detta är motorn. Den läser tid, inte bransch. Bevisat: samma tider ger identisk
lane-geometri för frisör, florist och ateljé (`bransch-kalender.test.ts`).

| Funktion | Var | Kommentar |
|---|---|---|
| Tid (start/slut, tidszon, DST) | `CalendarBoard.tsx` väggklocka→UTC | Räknar aldrig på UTC-offset |
| Resurs-kolumn (vem/vad utför) | `bookings.staff_id` | Alltid en PERSON idag — se §4 |
| Kund | `customers` / `customer_profile_id` | Bransch-neutral |
| Status + FSM | `bookings.status`, `booking_status_history` | Bransch-neutral |
| Krockskydd / lanes | `placeOverlaps()` | Ren geometri, bransch-blind |
| Blockering, frånvaro | `time_off`, block-serier | Bransch-neutral |
| Arbetstider → bokbara tider | `working_hours`, `working_hour_slots` | Bransch-neutral |
| Platser | `locations` | Bransch-neutral |

**Regel:** ingen `if (bransch === 'x')` får någonsin införas här. Behöver en bransch något
annat — bygg det som en MODUL eller ett FÄLT, aldrig som en gren i kalendern.

## 2. VALBAR — modul på/av per kund (`tenant_modules`)

Inte bransch-logik, utan ett val. En florist kan ha lojalitet; en frisör kan ha webshop.
Branschen sätter bara ett DEFAULT (`verticals.default_modules`), kunden bestämmer.

| Modul | Tabeller |
|---|---|
| booking | `bookings`, `services`, `staff` |
| webshop | `shop_products`, `shop_orders`, `shop_shipping_options` |
| offert | `offert_requests` |
| kurser/event | `event_registrations` |
| lojalitet | `loyalty_plans`, `loyalty_ledger` |
| presentkort | `gift_cards` |
| blogg / galleri | `blog_posts`, `gallery_items` |
| betalning (Stripe) | `payments` |

## 3. BRANSCHSPECIFIK — idag: BARA ord och copy

Det enda som skiljer branscherna i motorn just nu är `verticals.terminology` +
`default_copy` + tema. Ordet resolvas i UI:t via `resolveTerm` / `termPlural`
(`lib/platform/verticals-shared.ts`) — call-siten skickar alltid ett neutralt fallback,
så en tenant utan överlagring får plattformens ord, aldrig frisörens.

| Bransch | staff | service | business |
|---|---|---|---|
| frisör | Stylist | Klippning | — |
| barbershop | Barberare | Klippning | — |
| florist | Florist (pl. Florister) | **saknas → "Tjänst"** | Butik |
| nagelstudio | Nagelteknolog | Behandling | — |
| restaurang | Personal | Rätt | (unit: bord) |
| ateljé *(ej seedad)* | Formgivare | Ateljébesök | Ateljé |

---

## 4. ÄRLIGT: var motorn INTE räcker till

Detta är den värdefulla delen. Terminologin räcker för att BYTA ORD. Den räcker **inte**
när branschen bokar något strukturellt annat. Fyra äkta gap:

### GAP 1 — Bokningen kräver alltid en PERSON (`staff_id NOT NULL`)
- **Ekonomibyrå / rådgivning** bokar ett *möte* — ofta utan att kunden väljer person.
  Idag måste en staff-rad finnas och pekas ut. Går att bruka (en "Rådgivning"-rad), men
  det är en workaround, inte en modell.

- ⛔ **FÄLLAN: gör INTE `staff_id` null-bar.** Krockskyddet ÄR den kolumnen:
  ```sql
  exclude using gist (staff_id with =, tstzrange(start_ts, end_ts) with &&)
  where (status in ('pending','confirmed','completed'))
  ```
  `NULL = NULL` är inte sant i SQL → en null-bar `staff_id` gör att EXCLUDE **tyst slutar
  gälla** för precis de bokningar som saknar resurs. Två möten kan då läggas på varandra
  utan att DB:n säger ifrån. Det offrar dataintegriteten, som går före allt.

- **Fixen är motsatsen:** `staff_id` förblir NOT NULL, men `staff` slutar betyda "en
  människa". Lägg till `staff.kind` ('person' | 'objekt' | 'resurs') så att en byrå kan
  lägga upp resursen "Rådgivning" och en verkstad resursen "Lyft 1" — utan att UI:t kallar
  dem personal. Krockskyddet fortsätter fungera oförändrat. Kalendern rör vi inte: den
  ritar redan kolumner ur en lista och bryr sig inte om vad raderna föreställer.

### GAP 2 — Det finns ingen OBJEKT-entitet (verkstad/cykelverkstad)

> **RÄTTAD 2026-07-14.** Första versionen av det här stycket sa att verkstaden "bokar
> objektet". Det är fel, och felet spelar roll: hade vi byggt på det hade cykeln blivit
> en RESURS-kolumn i kalendern.
>
> Verkstaden bokar **mekanikern** (eller lyften) — det är den som upptar tid och kan
> dubbelbokas. **Cykeln är vad jobbet HANDLAR OM, inte vad som utför det.** Objektet är
> alltså ett ATTRIBUT på bokningen, inte en resurs.

- Idag: **ingen tabell för objektet.** Det kan bara skrivas som fritext i `bookings.note`
  → går inte att söka på, inte statusa, ingen historik ("den här cykeln har varit inne 3 ggr").
- **Fixen (när en riktig verkstadskund finns):** `assets` (kund-ägt objekt: modell, reg.nr,
  ägare) + `bookings.asset_id` **null-bar**. Krockskyddet rörs INTE — det sitter kvar på
  `staff_id`. Kalendern rörs inte alls.
- Kalendern kan däremot rita en **objekt-som-utför**-kolumn (lyft, bås, stol) redan idag —
  det är bara en `staff`-rad. Det som saknas för det är `staff.kind` ('person' | 'objekt'),
  så att UI:t slutar kalla en lyft för "personal". Litet, men inte gjort.

### GAP 3 — Florist: leverans-FÖNSTER finns inte i kalendern
- En florist säljer *leverans mellan 12–16 på fredag* — ett tidsfönster + adress, utan
  fast tjänstelängd och ofta utan utpekad person.
- Idag: leveranser lever i `shop_orders` (webshop-modulen). Det finns **ingen koppling till
  kalendern** — floristens leveranser syns alltså inte där floristen planerar sin dag.
- `bookings` har varken adress eller "fönster"-semantik (`service_id NOT NULL` tvingar fram
  en tjänst med duration).
- **Fix:** låt en shop_order kunna projicera en bokning (fönster som start/end), eller ett
  `booking_kind = 'leverans'`. Fortfarande ingen fork — bara en till rad-typ.

### GAP 4 — Ingen kapacitet / flera samtidiga per resurs
- `restaurang` har `unit: 'bord'` — men `unit` är **bara en etikett**. Det finns ingen
  bords-/kapacitets-entitet och ingen sällskapsstorlek. Motorn är strikt 1 resurs = 1 bokning
  i taget (krockskyddet är byggt så).
- Ateljé/kurs med flera deltagare löses idag via kurs-modulen (`event_registrations`),
  inte via kalendern.

### Mindre, men verkligt: terminologin
- **Floristen saknar `service`-ord** → en florists tjänst heter "Tjänst". Lägg till
  `service: 'Beställning'` på florist-raden. (Testet vaktar att den ALDRIG blir "Klippning".)
- **`business` lagras i OBESTÄMD form** ("Butik") → det går inte att bygga svensk genitiv
  ur den ("butiks öppettider" ✗). Därför är possessiv copy omskriven neutralt
  ("öppettiderna", "tidszonen"). Vill vi ha "butikens öppettider" måste nyckeln
  standardiseras till bestämd form ("Butiken") — då fungerar `-s` för alla branscher.
- Svenska plural är oregelbundna → `termPlural` GISSAR ALDRIG, den kräver `<key>_plural`.
  Bara floristen har det idag.

---

## 5. Regeln framåt

1. **Ord** → `verticals.terminology` + `resolveTerm`. Aldrig hårdkodat. Vaktas av
   `scripts/vakt-bransch.mjs` (baseline = städlista) och `bransch-kalender.test.ts`.
2. **Funktion på/av** → modul, inte bransch-gren.
3. **Äkta strukturskillnad** (objekt, leveransfönster, kapacitet, resurslös bokning) →
   nytt FÄLT eller ny ENTITET som alla branscher kan använda. Aldrig `if (bransch === …)`.
