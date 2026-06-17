# Modul: Depositbetalning (deposit)

> Status-källa: DB-sanning + cfg-data. **ROADMAP** (`live:false`, ingen rad i `modules`, ingen egen tabell än). **Betal-rails PAUSADE (beslut 14.2) — UI only, inga pengar rör sig.** Grindar boknings-bekräftelse. Cross-ref: `booking.md` + `offert.md`. Build-once per riktig kund (princip 10).

## 1. Kärna (universell)

En **deposit som måste betalas innan en bokning blir bekräftad**. Booking skapas som `pending` → deposit betalas → `confirmed`. Skydd mot no-show; täcker artistens förlorade lön + rit-/förberedelsetid.

- **Grind, inte egen yta:** deposit lägger en spärr på boknings-`status`. cfg-data `MODULES.deposit` → "`payments`-grind på bokning (rails pausade)". Booking äger flödet; deposit äger grinden + betal-statusen.
- **owns_tables (NY):** `payments`-grind kopplad till `bookings` (cfg-data + backlog "Depositbetalning → `payments`-grind på bokning"). Ingen helt egen domän — en betal-post + en flagga på bokningen.
- **Rails pausade:** UI visar deposit-krav, belopp, villkor — men ingen Stripe-debitering sker (precis som shop/presentkort: "checkout-UI finns men betalning avstängd"). `payment_status` stannar tills rails öppnas.
- **Booking-koppling:** `verticals.rules.booking.deposit_gate: true` (tatuering) → booking-flödet kräver deposit-steg innan `confirmed`. booking.md §2 läser bara flaggan; deposit-modulen äger logiken.

## 2. Universal vs variant — beslut + axlar

**Beslut: EN deposit-grind. Bara tatuering kräver den idag, men byggd universellt + togglad per tenant.** Aldrig kundkod.

> **variant_schema (förslag, NY):** `deposit.basis` enum = `fixed | percent` · params: `amount_cents` (för fixed, t.ex. 50000 = 500 kr), `percent` (för percent, t.ex. 30), `refundable_hours` (default 48), `forfeit_on_noshow` (bool, default true), `applies_to` (`booking | offert`). Rent modul-`variant_schema` (lager 1) — samma enum, olika params per tenant.

### Lager (princip 10)

| Lager | Deposit-exempel |
|---|---|
| 1. `variant_schema` (modul) | `basis: fixed\|percent`, `percent`, `amount_cents`, `refundable_hours`, `forfeit_on_noshow` |
| 2. `verticals.rules` | `booking.deposit_gate: true` (branschen kräver deposit för att bekräfta) |
| 3. `verticals.terminology` | "Deposit" / "Handpenning" — ordval per bransch |
| 4. `tenant_modules.config` | per kund: exakt %/belopp, avboknings-varsel, om no-show behåller deposit |

**Varför aldrig forkad:** deposit-logiken (skapa pending → kräv betalning → bekräfta vid betald → behåll vid no-show) är identisk oavsett bransch. En tatuerare som tar 30% och en (framtida) klinik som tar 500 kr använder samma grind med olika params. En fork skulle duplicera betal-grind + status-maskin per bransch = ren skuld. Kundspecifik %/belopp = `tenant_modules.config`, aldrig if-tenant-kod.

## 3. Per bransch — branscher som använder modulen (från backloggen)

| Bransch | variant-val | UI-skillnad (storefront) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| **tatuering** 🌱 | `basis: percent` · `percent: 30` · `refundable_hours: 48` · `forfeit_on_noshow: true` · `applies_to: booking` (+ ev. `offert`) · `deposit_gate:true` | Mockup `ModDeposit`: "Deposit krävs · **30 %** · av offertens belopp · dras av vid besök". Villkorskort: "Tiden bekräftas först när deposit är betald · Avbokning > 48h: full återbetalning · No-show: deposit behålls" | Boka artist+session → deposit (30% av offert) → `pending` tills betald → `confirmed`. Dras av från slutpriset vid besök. | Tatuerare lägger rit-/förberedelsetid + binder en lång session; deposit skyddar mot no-show och täcker förlorad lön. Branschnorm: 10–50% (ofta ~30% för större jobb) eller flat $50–200; non-refundable; 48–72h varsel för återbetalning; no-show = förlorad deposit. [1][2] |

> **Endast tatuering** i backloggen. Mockupens `ModDeposit` har en `else`-gren ("500 kr · betalas vid bokning") → den **flat-varianten är redan förberedd universellt** för vilken framtida bransch som helst (t.ex. klinik/fotograf med dyr utrustning) utan kod — bara `basis: fixed` + `amount_cents`. Bygg per kund.

## 4. DB-form

| Tabell | Roll | Nyckelkolumner | RLS | LIVE/NY |
|---|---|---|---|---|
| `payments` (grind) | Deposit-betalningsposten | `id`, `tenant_id`, `booking_id → bookings`, `offert_id → offert_requests` (om kopplad), `amount_cents`, `basis` (fixed/percent), `status` (pending/paid/refunded/forfeited), `currency` (SEK) | Kund ser egna (`current_customer_id()`); personal (`role_level()>=3`) ser tenantens; **ingen anon-läs** (betaldata) | **NY/migration** — Zivar-go |
| `bookings` | Bokningen grinden styr | `status` (pending→confirmed), `payment_status` (unpaid→deposit_paid) | Som booking.md §4 (ingen anon-läs) | LIVE (logiken som läser deposit = NY) |

**FK-kopplingar:** `payments.booking_id → bookings`, `payments.offert_id → offert_requests` (deposit kan grinda en accepterad offert, jfr offert→booking-bron). `payments.tenant_id → tenants`.

**RLS-svar:** Anon-läs? **Nej** — betaldata är aldrig publik. role_level>=3? **Ja** — ägare/personal ser tenantens deposit-poster (vem har betalat, vem är pending). Booking-statusbyte vid betald deposit körs SECURITY DEFINER (samma mönster som `create_public_booking`).

## 5. Två ytor

**Storefront (besökare)** — efter val av artist+tid: ett deposit-steg. Mockup `ModDeposit` (preview.jsx): belopp (30% eller flat), "dras av vid besök", + villkorslista (bekräftas vid betald / >48h full återbetalning / no-show behålls). Knapp "Betala deposit" → (rails pausade) markerar avsikt; när rails öppnas → faktisk betalning → bokning `confirmed`.

**Admin (ägare)** — ser per bokning: deposit-status (pending/betald/återbetald/behållen). Kan markera betald manuellt (medan rails är pausade), återbetala, eller behålla vid no-show. Sätter %/belopp + villkor i modul-config.

## 6. Verklighets-koll

- **Funkar för tatuering (enda branschen)?** Ja — `basis:percent`+`percent:30`+`refundable_hours:48` matchar branschnorm direkt. Flat-grenen finns för framtida branscher utan kod.
- **Edge cases:**
  - **Rails pausade** — hela betalningen är UI-only idag. Bokning kan inte faktiskt grindas på "betald" förrän rails öppnas → tills dess: deposit-steget är informativt + manuell admin-markering. **§8.**
  - **Deposit på offert vs bokning** — tatuering: 30% "av offertens belopp" → deposit hänger på en accepterad offert som blir bokning. Kräver offert→booking-koppling (`payments.offert_id`). Cross-ref offert.md. **§8.**
  - **Återbetalning/forfeit** — >48h = full återbetalning, no-show = behåll. Med pausade rails kan ingen automatisk återbetalning ske → manuell tills rails öppnas.
  - **Pending-städ** — obetald deposit-bokning är `pending` → `expire_abandoned_pending_bookings(ttl)` (DB-sanning §8) städar den efter TTL. Bra default-skydd.
- **Svenska krav (viktigt när rails öppnas):**
  - **Moms** — deposit på en momspliktig tjänst (tatuering 25% moms) ska momsredovisas vid betalning (förskott/à conto enligt svensk momslag). Deposit-modulen måste bära momssats när rails går live.
  - **Kvitto** — betald deposit kräver kvitto (kassaregisterlag/bokföringslag). Ej i scope medan rails pausade, men måste byggas in före go-live.
  - **Konsumentköp/ångerrätt** — "non-refundable deposit" + ångerrätt: tjänst på bestämd dag (bokad tid) är ofta undantagen ångerrätt, men villkoren måste vara tydliga vid köp (svensk konsumentlag). Villkorskortet i `ModDeposit` är därför inte bara design — det är ett rättsligt krav.
- **Lätt missat:** (a) deposit-grind får inte gå live medan rails är pausade utan att vara tydligt UI-only; (b) moms+kvitto måste in INNAN riktiga pengar tas; (c) offert-kopplingen (30% av offert) kräver att offert blivit bokning först; (d) `refundable_hours` + no-show-policy måste matcha det som visas för kunden (avtalsbindande).

## 7. Status idag vs bygg

| Del | Status |
|---|---|
| Boknings-kärnan + `pending`/`confirmed`-status + pending-städ-cron | **Finns** (booking.md, LIVE) |
| `ModDeposit` storefront-rendering (30%/flat + villkor) | **Finns som mockup** (preview.jsx) — ej kod |
| `payments`-grind-tabell + `deposit.basis` variant_schema | **NY** — ingen rad i `modules`, ingen tabell (cfg-data `live:false`). Schema bara på go. |
| Grind-logik (pending→confirmed vid betald) | **Nybygge** — men UI-only tills rails öppnas |
| Betal-rails (Stripe) | **PAUSADE** (beslut 14.2) — rör INTE |
| Offert→deposit-koppling (`payments.offert_id`) | **NY** — cross-ref offert.md |
| Moms + kvitto | **Nybygge, krav före riktiga pengar** — ej i scope nu |

> Loop-skydd (RITNING §4): deposit är roadmap — bygg INTE förrän tatuerings-kund kräver den + Zivars go. **Rör ALDRIG betal-rails** (UI ja, pengar nej, beslut 14.2). Märk "Roadmap" i studion.

## 8. Öppna beslut för Zivar

1. **UI-only-grind nu** — medan rails är pausade: deposit-steget informativt + manuell admin-markering "betald", eller hålls hela modulen mörk tills rails öppnas? Förslag: UI + manuell markering (som shop/presentkort).
2. **percent av vad** — 30% av offert-belopp kräver accepterad offert→bokning. Bygger vi offert-kopplingen samtidigt, eller stödjer vi först bara `fixed`?
3. **Moms + kvitto** — måste vara klart före go-live med riktiga pengar. När byggs det? (Plattformsbrett, inte bara deposit.)
4. **Återbetalning/forfeit-automatik** — manuell tills rails öppnas; sedan automatik (>48h refund, no-show forfeit)?
5. **`payments` schema** — godkänn migration (schema bara på go). Återanvänds `payments` även för shop/presentkort när rails öppnas, eller deposit-specifik?
6. **terminology** — "Deposit" vs "Handpenning" i svensk UI?

## 9. Källor

**DB-doc + repo-filer:**
- `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §0b (LIVE vs ROADMAP), §8 (`expire_abandoned_pending_bookings` städar obetalda), §4 (RLS), §9 (Lansera: `payments_enabled:false`, `payment_mode:'on_site'`).
- `4-Dokument-Underlag/01-acceptans/super-admin/cfg-data.js` → `MODULES.deposit` (`live:false`, "`payments`-grind på bokning (rails pausade)"), `MODULES.booking.variants.tatuering` ("deposit KRÄVS före bekräftelse · modul deposit grindar status"), `BRANCHES.tatuering`.
- `4-Dokument-Underlag/01-acceptans/super-admin/preview.jsx` → `ModDeposit` (30%/500kr-grenar, villkorskort: bekräftas vid betald / >48h återbetalning / no-show behålls).
- `1-Planering/05-multibransch-bygge/09-modul-bransch-spec-backlog.md` (Tatueringsstudio → Deposit 🆕; "De 9 NYA" → Depositbetalning · `payments`-grind på bokning · rails pausade).
- `1-Planering/05-multibransch-bygge/10-arkitekturprincip-universal-vs-variant.md` (variant vs ny modul; params per tenant).
- Cross-ref: `moduler/booking.md` (grinden sitter på boknings-status), `moduler/offert.md` (30% av offert-belopp → offert→booking-bron).

**Webb (verklighet, best practice):**
- [1] Tatuerings-deposit: 10–50% (ofta ~30% för större jobb) eller flat, non-refundable, täcker rit-tid/förlorad lön: [MyTattoo deposit guide](https://mytattoo.software/blog/tattoo-deposit-guide/) · [Venue Ink deposits strategy](https://www.venue.ink/blog/how-to-handle-tattoo-deposits-strategy) · [Anatomy Tattoo deposit policy](https://anatomytattoo.com/faq/what-to-expect-during-a-tattoo/tattoo-deposit-policy/)
- [2] No-show/avbokning: full deposit vid no-show, 50% vid <48h, 72h varsel för ombokning, 15 min sen = förlorad deposit: [InkDesk no-show best practices](https://inkdesk.app/blog/avoiding-no-shows-best-practices-for-tattoo-artists) · [White Bird Studio appointments & deposits](https://whitebirdstudio.tattoo/appointments-deposits-touch-up-policies/) · [Tried & True deposit policy](https://www.triedandtruetattoocompany.com/appointment-deposit-policy.html)
