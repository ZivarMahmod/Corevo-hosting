# Modul: Lojalitet / Stammis (lojalitet)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md` (EN universal motor, anpassning = config). DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.4 + §8 + migrationer `5-Kod/supabase/migrations/0016_loyalty_earn.sql` (tabell + trigger) + `0035_lojalitet_module.sql` (register-only). Status: ✅ **LIVE** (rad i `modules`, tabell `loyalty_ledger`, **EARN-trigger redan byggd i DB**). **Automationen finns redan — du bygger inte intjäningen.**

## 1. Kärna (universell)
Kunden blir "stammis": varje slutförd bokning (och, för café, köp) tjänar in i `loyalty_ledger` (en ledger-rad per intjäning, `points_delta`). EN modul, EN tabell, alla branscher som kör det (frisör/nagel/hund = stämpelkort, café/restaurang = poäng). **Intjäningen är redan automatiserad i DB:** triggern `earn_loyalty_on_completed()` (0016) skriver en rad när en bokning går till `status='completed'`. **Rör INGA pengar** — ingen betal-hook, inget belopp, ingen provider; publika ytan är ren promo (headline + förmånstext + variant-visning). `loyalty_ledger` är **SELECT-only via PostgREST** (raderna skapas bara av booking-flödet/triggern, aldrig direkt av klient). REDEEM (inlösen) är medvetet **uppskjutet** — 0016 är earn-only.

## 2. Universal vs variant — beslut + axlar
**Variant, aldrig fork.** Stämpelkort och poäng är **samma ledger** — bara olika *presentation* av samma `points_delta`-summa. Ingen annan tabell → ren variant.
- **`variant_schema.variant`** (enum):
  - `points` — poäng-program (default; tjäna X poäng per besök/köp, visas som saldo).
  - `stamp_card` — stämpelkort (samla stämplar mot ett mål, visas som ifyllda cirklar).
  - Params: `points_per_visit` (int, def 50), `stamp_goal` (int, def 10).
- **`tenant_modules.config`** = per-kund: vald variant, headline ("Bli stammis"), perk_text, mål/takt.
- **`verticals.terminology`** runt promon (stammis/medlem).
- **Samma data, två vyer:** ett stämpelkort = `floor(summa points_delta / points_per_visit)` stämplar mot `stamp_goal`; poäng = `summa points_delta`. **Inget separat schema** — variant är bara hur summan renderas. Det är hela principen i ett nötskal.
- **Varför aldrig forkad:** ny lojalitets-bransch = en `verticals`-rad + vald variant. En förbättring i intjäningen (triggern) gäller alla. Aldrig en "café-lojalitet" och en "frisör-lojalitet" som skild kod.

## 3. Per bransch
| Bransch | variant-val | UI-skillnad (storefront) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| **Frisör** ✅ | `stamp_card` | 10 stämpel-cirklar (ifyllda = besök); "10:e besöket bjuder vi på" | Bokning → completed → trigger +1 intjäning → stämpel fylls | Klassiskt klipp-stämpelkort; tydligt mål, hög återbesöksfrekvens |
| **Nagel** ✅ | `stamp_card` | Stämpelkort per besök | Som frisör | Återkommande behandling; stämpel passar |
| **Hund** 🌱 | `stamp_card` | Stämpelkort per besök (trim/bad) | Som frisör | Regelbunden grooming; stämpel mot belöning |
| **Café / Konditori** 🌱 | `points` | Poäng-saldo + "≈ X kr rabatt"; **poäng KOPPLAD till webshop-köp** | Köp i shop / besök → poäng intjänas → lös in mot förmån | Snabba, billiga köp → poäng bättre än stämpel; café-poäng ska kopplas till shop-köpet, inte bara bokning |
| **Restaurang** ✅ | `points` | Poäng per besök/belopp | Besök/bokning → completed → poäng | Måltidsvärde varierar; poäng skalar bättre än stämpel |
| Frisör retail / övriga 🌱 (opt) | varierar | Som vald variant | Default off; slås på per kund | Branschen väljer stämpel vs poäng efter köpmönster |

> **OBS café-kopplingen:** cfg-data säger café-poäng är *"KOPPLAD till webshop (köp ger poäng)"*. DB-triggern (0016) tjänar idag bara på **bokning→completed**, inte på shop-order. Att tjäna poäng på café-shop-köp är därför en **bygg-punkt** (ny trigger på `shop_orders`), inte något som finns. Se §6.

## 4. DB-form (LIVE — tabell + trigger i 0016, register i 0035)
**`public.loyalty_ledger`** (skapad i 0016, ägs av modulen via `owns_tables`; **rörs INTE av 0035**): `id` · `tenant_id` · `customer_id` (NOT NULL FK — intjäning kräver känd kund) · `booking_id` · `points_delta` int · `reason` text (idag `earn_completed`) · `note` · `created_at`. **SELECT-only** via PostgREST (inga insert/update-grants till klient — bara triggern/booking-flödet skriver). Partiellt unikt index `loyalty_ledger_earn_once` på `booking_id where reason='earn_completed'` → **idempotent** (en bokning kan bara tjäna en gång).

**Trigger `earn_loyalty_on_completed()`** (0016, SECURITY DEFINER): körs `after update on bookings when (new.status='completed' and old.status is distinct from 'completed')`. Logik: resolva `customer_id` (eller via `customer_profile_id`→customers; SKIP om okänd, bryter aldrig FK) → läs takt från **`tenant_settings.settings.loyalty.points_per_visit`** (plattforms-default 50; ≤0 = ingen intjäning) → INSERT i ledger med `on conflict (booking_id) do nothing`. **Failure-isolerad:** `exception when others then return new` — en lojalitets-miss får ALDRIG avbryta status-bytet som nyss markerade bokningen completed. Funktionen är revoke:ad från anon/authenticated (aldrig PostgREST-anropbar).

**RLS:** SELECT-only-mönster (egna rader för kund, allt i tenant för personal ≥3, allt för platform_admin). Saldo = summa `points_delta` per kund.

> **NY:** (a) **REDEEM** (inlösen mot rabatt/belöning) — ej byggt, medvetet uppskjutet; kräver ny `reason='redeem'` + saldo-grind + ev. RPC. (b) **Café shop-intjäning** — ny trigger på `shop_orders→completed/paid` som skriver ledger med `reason='earn_purchase'` (finns ej). Inga nya tabeller behövs för någondera — additivt på `loyalty_ledger`.

## 5. Två ytor — Storefront + Admin
- **Storefront / Mitt konto** (`5-Kod/apps/web/components/storefront/LojalitetSection.tsx`): promo-sektion gatad på `tenant_modules.state='live'`. **Beter sig per `config.variant`** (header bekräftar): `points` → poäng-program; `stamp_card` → ritar `stamp_goal` tomma stämpel-cirklar. Titel = `config.headline`. Inloggad kund ser sitt saldo (summa `points_delta`). MODULE_FACE sf: *"Besökaren ser sina poäng/stämplar och blir stammis."*
- **Admin** (`5-Kod/apps/web/components/admin/LojalitetAdmin.tsx`, design `kund-admin/surfaces-more.jsx` → `Stammis`): ägaren ställer regler (variant, takt/mål) + ser medlemmars saldon (kolumner Kund / Stämplar / Senast). LojalitetAdmin.tsx är presentationell — `loyalty_ledger` appendas bara av booking-flödet. MODULE_FACE adm: *"Ägaren ställer in reglerna och ser alla medlemmar."* Banner: *"Stämplar/poäng räknas automatiskt när en bokning blir klar (DB-trigger), du behöver inte göra något manuellt."*

## 6. Verklighets-koll
- **Takt-källan är `tenant_settings`, INTE modul-config (löst, DB vinner):** triggern (0016) läser `tenant_settings.settings.loyalty.points_per_visit`, men `variant_schema`/`default_config` har också `points_per_visit`. **De måste hållas i synk** — annars visar storefront en takt och ledgern tjänar en annan. Bygg: skriv `tenant_modules.config.points_per_visit` → spegla till `tenant_settings.settings.loyalty` (eller låt triggern läsa modul-config). Idag är `tenant_settings` sanningen för intjäningen.
- **Café shop-koppling saknas:** cfg-data lovar "köp ger poäng" men triggern tjänar bara på bokning. För café (som ofta INTE har bokning, utan shop) ger nuvarande setup **noll poäng**. Måste byggas: trigger på `shop_orders`. Annars är café-lojalitet tom.
- **REDEEM är uppskjutet:** kunden kan tjäna men inte lösa in. Stämpelkortets "10:e bjuder vi på" är idag bara visuellt — den faktiska belöningen/inlösen finns inte i DB. Tydliggör i UI eller bygg redeem.
- **Stämpel = härledd, inte lagrad:** antal stämplar räknas ur summa `points_delta` / `points_per_visit`. Ändrar tenant `points_per_visit` retroaktivt ändras stämpel-antalet för gamla rader — beslut om det ska "frysas" eller ej.
- **Anonym kund tjänar inte:** triggern SKIPpar om `customer_id` saknas. Walk-in utan konto → ingen intjäning. För frisör med många icke-inloggade kunder är detta en lucka (kräver att bokningen knyts till en customer).
- **Svenska moms/kvitto:** lojalitetspoäng i sig rör inga pengar → ingen moms vid intjäning. **När poäng löses in mot rabatt** påverkas beskattningsunderlaget för det köpet (rabatten minskar momspliktigt belopp) — relevant först vid redeem + rails-på. Rena lojalitetsförmåner utlöser inget kassaregisterkrav.
- **Lätt missat:** ledger är **append-only i anda** (SELECT-only, idempotent) — bygg aldrig klient-skriv mot den; saldo beräknas alltid som SUM, cacha inte fel; `reason` är nyckeln till att skilja earn/redeem/purchase när fler källor adderas.

## 7. Status idag vs bygg
- **Finns:** modules-rad (0035 register-only), `loyalty_ledger` + **earn-trigger + idempotent index** (0016), `LojalitetSection.tsx` (variant-medveten: poäng vs stämpel-cirklar), `LojalitetAdmin.tsx` (regler + saldon).
- **Bygg/justera:** (a) **synka takt-källa** (`tenant_modules.config` ↔ `tenant_settings.settings.loyalty`); (b) **café shop-intjäning** (trigger på `shop_orders`, `reason='earn_purchase'`); (c) **REDEEM** (inlösen-flöde + `reason='redeem'` + saldo-grind) — fas senare; (d) walk-in/anonym intjäning (knyt bokning till customer); (e) belöning vid stämpel-mål (idag bara visuellt).

## 8. Öppna beslut för Zivar
1. **Takt-sanning:** ska triggern läsa `tenant_modules.config.points_per_visit` (en källa) i stället för `tenant_settings`? (Rekommendation: en källa, annars drift.)
2. **Café-intjäning:** poäng på shop-köp — på `shop_orders` vid `completed`, vid `paid` (rails-på), eller båda? Hur många poäng per krona?
3. **REDEEM nu eller fas D:** ska inlösen byggas i denna omgång (saldo-drag, ingen pengar) eller skjutas tills betal-rails? 
4. **Retroaktiv takt:** frysa intjänad poäng/stämpel vid takt-ändring, eller alltid räkna live? (Påverkar stämpel-antal-stabilitet.)
5. **Walk-in:** ska personal kunna knyta en walk-in till en customer i admin så den tjänar, eller är lojalitet bara för inloggade?
6. **Belöning:** hur representeras "10:e besöket gratis" — automatisk rabattkupong, manuell i admin, eller presentkort-koppling?

## 9. Källor
- DB-sanning §1.4 + §8 (trigger) + §4.3: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md`
- Migrationer (kanon): `5-Kod/supabase/migrations/0016_loyalty_earn.sql` (loyalty_ledger, earn-trigger, idempotent index, failure-isolerad, earn-only) + `0035_lojalitet_module.sql` (register-only, variant_schema.variant points/stamp_card)
- Variants/faces/branscher: `super-admin/cfg-data.js` (MODULES.lojalitet variants frisor/nagel/hund/cafe/restaurang, café "KOPPLAD till webshop", MODULE_FACES.lojalitet, BRANCHES), `super-admin/preview.jsx` (ModLojalitet — points vs stämpel-cirklar)
- Admin-UI: `kund-admin/surfaces-more.jsx` (Stammis: Kund/Stämplar/Senast) · kod `apps/web/components/{storefront/LojalitetSection,admin/LojalitetAdmin}.tsx`
- Princip: `10-arkitekturprincip-universal-vs-variant.md` · Backlog: `09-modul-bransch-spec-backlog.md`
- Verklighet (SE): stämpelkort vs poäng/digital lojalitet — [Stamkorten (digitala stämpelkort café/restaurang)](https://stamkorten.se/), [Cardcam: klippkort vs kundkort](https://cardcam.io/digitalt-klippkort-och-kundkort-vad-ar-skillnaden/); moms vid rabatt/inlösen — [Skatteverket momssatser](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momssatserochundantagfranmoms.4.58d555751259e4d66168000409.html)
