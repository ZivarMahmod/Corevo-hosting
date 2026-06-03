# M3 — Bokningsmotor (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** den gamla `1-Planering/moduler/M3-bokningsmotor.md` (för-bygge-spec).
**Läs först:** `HANDOFF.md` + `CLAUDE.md`. `private.tenant_id()`, `staff`/`staff_id`, `start_ts`/`end_ts`.

> **Röd tråd:** M3 är **hjärtat**. Läser M6 (schema/tjänster/personal), föder M4/M5 (bokningar), kopplar M8 (betalning), visar status i M6-admin. Det "live"-beteende M6 *visar* (avbokning → tid tillbaka, auto-klar) *bor här*.

---

## 0. Vad modulen ÄR

Plattformens konverteringstratt: besökare → bokad kund via en guidad flerstegswizard med realtidstillgänglighet, dubbelbokningsskydd och (om påslaget) Stripe-betalning.

---

## 1. Ytor — byggt / stale / saknas

| Yta | ✅ Byggt | ⚠️ Mismatch | ❌ Saknas |
|---|---|---|---|
| **Wizard** (`BookingWizard.tsx`, `/boka` + drawer) | 5 steg: Tjänst→Personal→Tid→Uppgifter→Bekräftelse | en-tjänst | combo/multi-tjänst |
| **Slot-motor** (`lib/booking/availability.ts`) | computed: fönster+upptaget+längd+buffert+steg, past-drop, rygg-mot-rygg | fast steg (default 15), ej per-frisör | steg/buffert per frisör |
| **Busy/skapa-RPC** (`0005`) | `get_busy_intervals` (ingen PII) + `create_public_booking` (validerar, `pending`) | — | hold/expiry |
| **Dubbelbokning** | Postgres **EXCLUDE** (23P01, DB-tvingad) + graceful "togs av annan"-vy (`boka/actions.ts:201-204` mappar 23P01 → "Tyvärr, tiden togs precis. Välj en annan tid.") | — | — *(FAS 0-korrigering 2026-06-02: krock-/race-vyn var felmarkerad som saknad — den är byggd, bygg inte om)* |
| **Slot-lås** | — | — | **5-min hold + release (helt nytt)** |
| **Betalning** | gate (online vs i-salong), refund vid avbokning | — | (Stripe-runtime overifierad → M8) |
| **Avboka** | gäst-HMAC-länk + `/avboka/[id]` | — | avboknings­fönster per salong |
| **Plats** | `location_id` överallt (data-redo) | — | plats-val i bokning (multi-store) |
| **Övrigt byggt** | tidszon (`tz.ts`), notiser (bekräftelse/avbokning/påminnelse) | — | — |

---

## 2. Spikade beslut (M3)

### 2.1 Slot-modell — computed, tunad per frisör
Behåll den byggda computed-motorn (fönster + service-längd + steg + buffert → auto-genererade tider). **Gör `slotStepMin` + `bufferMin` ställbart per frisör** (ev. per tjänst). Lågt manuellt arbete — frisören placerar inte tider för hand.
- Det "oregelbundna" i en **"Alla"-vy = unionen** av flera frisörers slots (olika steg/längd), inte handplock. Computed + per-frisör-tuning ger den looken automatiskt.

### 2.2 Slot-lås — 5-min hold
- När kunden öppnar en tid hålls den i **5 minuter**. Trycker de **inte** "slutför bokning" inom 5 min → tiden **släpps** tillbaka till storefront.
- ⚠️ **Stale-skydd:** sitter kunden kvar på en gammal sida (utan refresh) och försöker boka en tid som hunnit tas/släppas → tydligt **"Den tiden är inte längre ledig — välj en ny."** Aldrig ett kryptiskt fel.
- Samma graceful-vy fångar DB:ns `23P01` (EXCLUDE) — om två kunder racar samma tid: en lyckas, den andra får "togs av någon annan, välj ny".
- Detta löser HANDOFF-skulden: idag squattar en övergiven `pending` tiden tills någon avbokar. Hold + release ersätter det.

### 2.3 Combo / multi-tjänst — JA i v1
Boka **flera tjänster i en bokning** (t.ex. klippning + skägg). Total tid + total pris. `booking_services` fylls. `end_ts` = summan av längderna. EXCLUDE täcker hela spannet. Wizard-steg 1 blir multi-select.

### 2.4 "Alla / vem som helst" — union + tilldela vid bokning *(rek, bekräfta vid bygge)*
Väljer kunden "Alla" visas **unionen** av tillgängliga frisörers tider. Vid bokning **tilldelas en konkret ledig frisör** (krävs för `staff_id` + EXCLUDE + schema). Kunden ser "vem som helst", systemet sätter en riktig frisör under huven (först ledig / minst belastad).

### 2.5 Auto-klar + betalnings-medveten completion *(princip låst, beteende delvis M8)*
- Bokning auto-markeras **klar** när tiden passerat *om* frisören inte själv gjort det. Bokningen **försvinner inte**.
- ⚠️ Aldrig falskt **"klar + betald"** på sen kund / no-show. När betalning-vid-bokning är på får completion inte auto-slutföra betalning för en no-show. (Betalbeteende bor i M8.)

### 2.6 Avbokningsfönster *(rek, bekräfta)*
Avboknings­fönster läses **per salong** ur `tenant_settings` (inte hårdkodat). Deposit = parkerat till M8.

---

## 3. Röd tråd — kopplingar (ingen dubbel-spec)

| Koppling | Vad M3 gör | Var det andra bor |
|---|---|---|
| **M6 → M3** | läser schema (per-frisör steg/buffert), tjänster (längd/pris), `staff_services` | M6 äger uppsättningen |
| **M3 → M2** | avbokning/utgången hold → tid **tillbaka** till storefront; CTA "boka" | M2 renderar |
| **M3 → M4** | bokningar matar kundens omboka/avboka/historik | M4 äger portalen |
| **M3 → M5** | bokningar matar frisörens dag; frisör markerar klar/no-show | M5 äger frisör-vyn |
| **M3 → M6-admin** | avbokning → status + tid-tillbaka visas; auto-klar | M6 visar |
| **M3 → M8** | betalnings-gate, online vs i-salong, refund vid avbokning | M8 äger pengar |

---

## 4. Bygg-items (vad Code faktiskt gör i M3)

**Rör INTE** (byggt & testat): `computeSlots`-kärnlogiken (utöka, riv ej), EXCLUDE-constraint, `create_public_booking`/`get_busy_intervals` (utöka), tz-lagret. Frysta filer endast i solo-fas.

1. **5-min slot-hold + release (nytt):** håll vald tid 5 min; auto-släpp om ej slutförd; ersätter pending-squat. *(FAS 0-korrigering 2026-06-02: den graceful 23P01-"togs av annan"-vyn är REDAN byggd (`boka/actions.ts:201-204`) — bygg INTE om den. Det som FAKTISKT saknas här:)*
   - **Hold-mekanism:** 5-min hold + auto-release.
   - **Stale-sida / passerad tid:** sitter kunden på en gammal sida och bokar en tid som hunnit tas/passera → tydligt "Den tiden är inte längre ledig — välj en ny." Idag är `P0001 start_in_past` (migr `0009`) **omappad** i `actions.ts` → faller till generiskt "Något gick fel" (kryptiskt). Mappa den till samma graceful familj som 23P01.
2. **Per-frisör steg/buffert:** gör `slotStepMin`/`bufferMin` konfigurerbart per frisör (ev. tjänst); läs från M6-schemat.
3. **Combo/multi-tjänst i wizarden:** multi-select steg 1, total tid+pris, `booking_services`, `end_ts` = summa, EXCLUDE över hela spannet.
4. **"Alla" union + tilldela frisör vid bokning** (§2.4).
5. **Avbokningsfönster ur `tenant_settings`** (§2.6).
6. **Auto-klar-koppling** (§2.5) — completion utan att bokning försvinner, gate mot betalning.

---

## 5. Parkerat (planerat, byggs inte först)

- **Plats-val i bokning** (multi-location): välja salong + visa "Erik är v24 i salong 2". Hänger på M6:s staff↔location↔period-allokering. `location_id` finns. Planeras, byggs inte först.
- **Chatt mot bokning** → notering på frisörens/admins rad (inte mejltråd). Krok planeras, byggs senare.
- **SMS-bekräftelse:** krok + per-salong-toggle finns, ingen leverantör än.
- **Väntelista (waitlist):** senare.
- **Deposit:** M8.

---

## 6. Öppet kvar

Inget blockerande. §2.4 ("Alla"-tilldelning: först-ledig vs minst-belastad) och §2.6 (exakt avboknings­fönster i timmar) finputsas vid bygge mot demo-data.
