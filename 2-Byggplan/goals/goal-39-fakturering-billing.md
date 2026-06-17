# goal-39 — Fakturering: plattforms-billing (v1 semi-manuell Swish)
Thinking: 🔴 (rör pengar + moms + bokföringsunderlag. Fel = felaktigt underlag / bruten fakturasekvens. Rollback för schema obligatorisk.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal.
**Källa:** `1-Planering/08-fakturering/00-modell.md` (Zivars kravbild 2026-06-16).

## Mål
Super-admin skickar en månadsfaktura (**399 kr platt**) till salongens admin, inne i plattformen. Salongen ser tydligt **vad** de betalar för + **användning** (Cloudflare Analytics-räknare), får en **för-ifylld Swish-QR** (fakturanr i meddelandet), klickar **"jag har betalat"** → Zivar matchar mot sin Swish → **"Godkänn"** → grönt hos båda = betalt. **v1 = semi-manuell matchning**; auto-Swish senare.

## Lägeskoppling
Fas E i `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md`. Fristående från kund→salong-betal-rails (de är pausade) — **detta är plattform→salong-billing.**

## Kontext
- **Pris:** 399 kr/mån platt (oavsett bransch/trafik). Marginal stor: bilder ligger i R2 (ej Postgres → DB växer inte), infra ≈ 1 kr/kund (~40 kunder ≈ 48 kr/mån CF). Trafik äter inte avgiften vid denna skala.
- **Swish Företag** (ej privat Swish) krävs för företagsbetalning + bokföring. API kan auto-bekräfta senare; v1 behåller manuell "Godkänn".
- **Fakturan = bokföringsunderlag:** löpande (gapless) fakturanummer + moms + org.nr. Bygg formatet rätt från start.
- **ÖPPET (ej Code:s bedömning — Zivar/bokförare):** exakt momssats (sannolikt 25 % på SaaS — stäm av) + exakta fakturakrav; vad ingår i 399 + ev. framtida nivåer; auto-Swish-API vs manuell (reko: manuell v1).

## Berörda filer
- `5-Kod/supabase/migrations/00XX_billing_invoices.sql` — **NY.** Tabell `invoices` (tenant_id, **gapless fakturanr**, period, belopp, momssats+momsbelopp, org-fält, status, swish-ref). RLS. Idempotent + rollback. Gapless-nr via RPC (mönster: `next_receipt_number`-analogt).
- Super-admin billing-yta — `app/(platform)/.../fakturor/*` (skapa/skicka/godkänn). *(grep fram super-admin-rotens exakta sökväg.)*
- Salong-admin: faktura-vy + Swish-QR + "jag har betalat"-knapp.
- Cloudflare Analytics-räknare på salong-admin (besökare/requests).

## Steg
1. **Migration `invoices`:** gapless löpande fakturanr (global sekvens via RPC, fail-closed — bokföringskrav), momssats + momsbelopp som egna kolumner, status-enum (`skickad`/`betald_vantar`/`godkand`), `swish_ref`. RLS: super-admin full; salong ser egna.
2. **Super-admin — skapa/skicka:** generera månadsfaktura (399 + moms) → status `skickad`. Visar period + användning.
3. **Salong-admin — betala:** se faktura + **för-ifylld Swish-QR** (fakturanr i meddelande, valfri betalkälla) + "jag har betalat" → status `betald_vantar`.
4. **Super-admin — godkänn:** efter Swish-matchning → "Godkänn" → status `godkand` → **grönt hos båda.**
5. **Räknare:** Cloudflare Analytics (besökare/requests/trafik) på salong-admin — kunden ser värdet.
6. **Faktura-format:** export/print som bokföringsunderlag (löpande nr, datum, org.nr, momsrad, vad ingår). Zivars eget format.
7. Tester.

## Verifiering (klar när)
- [ ] Fakturanr är **gapless + löpande** (kör flera fakturor → ingen lucka/dubblett).
- [ ] Momssats + momsbelopp + org.nr + datum syns korrekt på fakturan.
- [ ] Flödet: skicka → "jag har betalat" → Godkänn → grönt hos båda.
- [ ] Swish-QR för-ifylld med fakturanr.
- [ ] Räknaren visar riktig Cloudflare Analytics-data.
- [ ] Gates: vitest, tsc 0, lint 0, opennext build, grep-guard. Worker-version + rollback-id.
- [ ] **Compliance-checkpoint (pengar/moms):** momssats + fakturakrav avstämda med Zivar/bokförare INNAN v1 går mot riktiga pengar (Code gissar aldrig momssiffror).

## Anti-patterns
- Pengar/moms → ALDRIG gissa siffror; flagga compliance, bygg fakturaformatet rätt från start.
- Fakturanr ALDRIG icke-gapless (bryter bokföringslag).
- Auto-Swish EJ i v1 (manuell "Godkänn"-knapp).
- Blanda INTE ihop med kund→salong-betal-rails (pausade, separat).

## Kopplingar
`08-fakturering/00-modell.md`, Cloudflare Analytics, roadmap Fas E. Framtid: auto-Swish (API-callback), nivåer/tak.

## Rollback
Revert migration (`invoices` + sekvens-RPC), `git revert`, `wrangler rollback <förra-version-id>`. Inga destruktiva ändringar på andra tabeller.

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
Skärper acceptans/DoD utan att röra SCOPE (fortsatt **v1 semi-manuell Swish-billing**). Tre områden härdas eftersom fakturaformatet "byggs rätt från start" och fel som bränns in i historiska fakturor inte går att backa enligt bokföringslag.

### 1. Gapless-nr under samtidighet (concurrency-test)
Den klassiska gapless-buggen är att två fakturor som skapas samtidigt antingen får **samma** nummer (dubblett) eller lämnar en **lucka** (en sekvens hoppas över vid rollback). Detta MÅSTE testas, inte bara antas.
- [ ] **Parallelltest:** ett test kör flera **samtidiga** anrop till `next_invoice_number` (t.ex. N parallella transaktioner / N samtidiga `skapa-faktura`) → resultatet ska vara **N unika, konsekutiva nummer utan lucka eller dubblett**. Sortera utfallet och assert:a att det är exakt `[start … start+N-1]`.
- [ ] **Fail-closed under lås:** RPC tar ett rad-/rådgivande lås (t.ex. `SELECT … FOR UPDATE` på sekvensraden eller `pg_advisory_xact_lock`) så att samtidiga anrop **serialiseras**; aldrig en naken `MAX(nr)+1`-läsning (race). Vid fel/avbrott ger RPC fel (fail-closed) — den får ALDRIG returnera ett halvt tilldelat eller gissat nummer.
- [ ] **Ingen gap-källa via Postgres-sequence:** om en `SEQUENCE` används internt får den **inte** ensam vara fakturanr-källan (sequence luckar vid rollback). Numret materialiseras gapless i `invoices` via den låsta RPC:n; sequence får på sin höjd vara intern hjälp.
- [ ] **Bevis:** testet ligger i vitest och är grönt i gates; logga utfallslistan i körningen som evidens.

### 2. Status-felgrenar (utöka enum — byggs in nu)
Nuvarande enum `skickad`/`betald_vantar`/`godkand` täcker bara lyckliga vägen. Eftersom formatet byggs rätt från start ska felgrenarna in i schemat NU (annars kräver de migration mot historiska fakturor senare).
- [ ] **Avvisad betalning:** status `avvisad` (Swish-matchning misslyckas / fel belopp / fel meddelande) → super-admin kan sätta `betald_vantar` → `avvisad` med orsak; salongen ser tydligt "ej godkänd, åtgärd krävs" och kan göra om "jag har betalat".
- [ ] **Utebliven betalning:** status `forfallen` (förfallodatum passerat utan godkänd betalning) — härleds mot `due_date`; syns hos båda. (Påminnelse-/inkassoflöde är utanför v1-scope men statusen finns.)
- [ ] **Kreditfaktura / makulering — ALDRIG radera:** en gapless faktura får **aldrig** raderas (bryter bokföringslag). En felaktig/återkallad faktura hanteras som **kreditfaktura**: en NY rad med eget gapless fakturanr, negativt belopp+moms, `kind = 'kredit'` och `credits_invoice_id` som pekar på originalet; originalet sätts `makulerad` (men raden ligger kvar). Acceptans: försök att `DELETE` en faktura ska vara blockerat (RLS/policy/constraint), och kreditflödet ger två kvarliggande rader med spårbar koppling.
- [ ] Enum/format dokumenteras i migrationen så fakturaformatet inte behöver byggas om för felgrenarna senare.

### 3. Momssats datadriven (kolumn, ej hårdkodad 25 %)
Fel momssats inbränd i en historisk faktura är ett bokföringsfel som inte kan backas. Satsen ska vara data, inte kod.
- [ ] **Egen kolumn:** `vat_rate` (momssats) lagras **per faktura** som kolumn — aldrig hårdkodad `25 %` i logik/UI. Momsbelopp räknas ur `vat_rate` + nettobelopp och lagras (`vat_amount`) så historiska fakturor fryser sin sats vid skapandetillfället.
- [ ] **Default men ändringsbar:** systemet kan ha ett default-värde, men det sätts på ETT ställe (config/tabell), inte spritt i koden; ändrad default påverkar bara **nya** fakturor, aldrig redan utställda.
- [ ] **Explicit compliance-gata:** v1 får **inte** köras mot **riktiga pengar** förrän compliance-checkpointen (momssats + fakturakrav avstämda med **Zivar/bokförare**) är klar. Tills dess körs allt i test-/sandbox-läge. Code gissar aldrig momssiffror; default-värdet i koden är en **platshållare som flaggas** tills bokföraren bekräftat — så fel sats aldrig bränns in i en skarp, historisk faktura.
