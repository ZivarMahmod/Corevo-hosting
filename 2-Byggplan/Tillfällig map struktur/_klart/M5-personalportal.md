# M5 — Personalportal (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** den gamla `1-Planering/moduler/M5-personalportal.md` (för-bygge-spec).
**Läs först:** `HANDOFF.md` + `CLAUDE.md`. `staff`/`staff_id`, self-scope (frisör rör aldrig kollegas/annan tenants rader).

> **Röd tråd:** M5 är **frisörens arbetsyta**. Speglar M3-bokningar. `completed` → fyrar Google-nudge (M4) + lojalitetspoäng (M4). `no_show` → frigör tiden (M3). Schema-baseline ägs av M6.

---

## 0. Vad modulen ÄR

Frisörens dagliga yta: sitt schema, dagens bokningar, markera klar/no-show, klientkort. Varje anställd ser bara sitt eget.

---

## 1. Frisörens dag — vad som händer i koden (byggt)

1. **`/personal`** = dagens schema (Calendar + DateNav). ✅
2. **"Klar"** → `completed`: tiden förblir blockad + **Google-nudge fyrar** + **lojalitetspoäng (M4)**. ✅ (kedjan inkopplad)
3. **"No-show"** → tiden **frigörs** tillbaka till storefront (EXCLUDE exkluderar no_show). ✅
4. **Arbetstider/frånvaro** (`/personal/arbetstider`, `/personal/franvaro`) — self-edit idag. ⚠️ se §2.1

---

## 2. Spikade beslut (M5)

### 2.1 Schema — ägaren äger baselinen, frisören är operativ
- **Vilka tider som är bokningsbara (baseline) = ägaren** (M6). Frisören sätter **inte** rastret.
- Frisören är **inte utelåst operativt** — får på sina egna bokningar:
  - markera **klar / no-show** (byggt)
  - **boka om** / **avboka** (om kund skriver eller ingen kommer)
  - lägga in **drop-in / walk-in-kund** för att logga sitt kundflöde (nytt)
- **Flytta arbetstids-baselinen till ägar-auktoritet (M6).** Frisörens self-edit av *baselinen* tas bort.
- **Frånvaro:** frisören får flagga **egen frånvaro** (sjuk idag = operativ verklighet), **ägaren ser den**. *(bekräfta vid bygge)*

### 2.2 Klientkort — JA (under PII-regler)
Frisören ser vem kunden är vid bokning: återkommande, historik, antal besök. Telefon/mejl syns bara i drift-fönstret kring bokningen, namn kan vara dolt enligt kundens val (M6 §4).

### 2.3 Kundnoteringar — internt + innehållsskyddat
- Per kund, **följer med till nästa besök**.
- ⚠️ **Strikt internt** — visas **aldrig** på kundens sida.
- ⚠️ **Innehållsskyddat:** hellre **strukturerade preferensfält** (t.ex. "kort sidor", "4 på toppen", "allergi: X") än fri text, så ingen skriver olämpligt som blir pinsamt/skadligt vid en dataläcka. Exakt form (strukturerat vs vaktad fri text) finputsas vid bygge — principen *internt + vaktat* är låst.

---

## 3. Röd tråd — kopplingar

| Koppling | Vad M5 gör | Var det andra bor |
|---|---|---|
| **M6 → M5** | schema-baseline (ägar-satt); staff-poster; kund-identitet för klientkort | M6 äger uppsättning + kundmodell |
| **M5 → M3** | klar/no-show flippar status (no-show frigör tid); drop-in skapar bokning; omboka | M3 äger bokningslogik |
| **M5 → M4** | `completed` → poäng + "sett Erik X ggr"; klientkort läser historik/lojalitet | M4 äger lojalitet |
| **M5 → M8** | completion-gate mot betalning (ej falskt klar+betald på no-show) | M8 äger pengar |

---

## 4. Bygg-items (vad Code faktiskt gör i M5)

**Rör INTE** (byggt): `setBookingStatus` (completed/no_show + nudge-kedjan), Calendar/DateNav, self-scope. Bygg ovanpå.

1. **Schema-auktoritet (§2.1):** flytta arbetstids-baseline till ägaren (M6); ta bort frisörens self-edit av baselinen. Behåll frisörens operativa actions.
2. **Drop-in/walk-in (§2.1):** frisören kan lägga in en walk-in-bokning.
3. **Klientkort (§2.2):** frisör-vy av kunden (återkommande/historik/antal besök) under PII-regler. Kräver kund-tabellen (M6 §4).
4. **Kundnoteringar (§2.3):** internt, följer med, strukturerat/vaktat, aldrig kund-facing.

---

## 5. Parkerat (planerat, byggs inte först)

- Intäkter/provision (earnings), prestandaanalys, dricks, skiftbyte, målsättning, klientmeddelanden — v2.

---

## 6. Öppet kvar

Inget blockerande. §2.1 (frånvaro: frisör-flaggad vs ägar-godkänd) + §2.3 (exakt note-form) finputsas vid bygge.
