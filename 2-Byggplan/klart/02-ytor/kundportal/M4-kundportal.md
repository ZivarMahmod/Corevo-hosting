# M4 — Kundportal (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** den gamla `1-Planering/moduler/M4-kundportal.md` (för-bygge-spec).
**Läs först:** `HANDOFF.md` + `CLAUDE.md`.

> **Röd tråd:** M4 är där **relationen kund↔salong lever**. Bygger på kundmodellen från **M6 §4** (identitet vs PII). Bokningar från M3. Lojalitetsbandet = kärnan i återköp.

---

## 0. Vad modulen ÄR

Kundens självbetjäningshubb: boka, omboka, avboka, historik — och **lojalitet** som skapar bandet till salongen/frisören.

---

## 1. Ytor — byggt / stale / saknas

| Yta | ✅ Byggt | ⚠️ Stale | ❌ Saknas |
|---|---|---|---|
| **Auth** | `/login` (lösenord) + `/registrera` + `/ingen-atkomst` | spec ville magic-link | — (login-modell låst, §2.1) |
| **Konto** | `/konto` dashboard, `/konto/bokningar/[id]` detalj, `/konto/profil` | rutter `/konto/*` (spec sa `/portal/*`, kosmetiskt) | — |
| **Bokningshantering** | BookingList, **CancelButton, RebookPanel** (omboka/avboka mot M3) | — | — |
| **GDPR** | export + radera (GdprControls) | — | — |
| **Lojalitet** | — | — | **poäng + tier (helt nytt, §2.2)** |
| **Favoriter** | — | — | **spara tjänst/frisör (§2.3)** |
| **Recensioner** | Google-nudge (extern, efter besök) | — | (in-app-betyg medvetet bort, §2.3) |

---

## 2. Spikade beslut (M4)

### 2.1 Login — lösenord (magic-link slopas)
Behåll den byggda lösenords-loginen för kunder. Magic-link byggs inte. (`/registrera` kräver `SERVICE_ROLE_KEY` som Worker-secret → Zivar, out-of-band.)

### 2.2 Lojalitet — bandet kund↔salong (nytt)
- **Poäng + tier per salong** (varje tenant egen lojalitet). Tier brons/silver/guld.
- **Intjänas per genomförd bokning** — poäng ges på `status = completed`.
- ⚠️ **Endast riktigt genomförda** bokningar ger poäng — aldrig en no-show som auto-flippats (jfr M3 §2.5 "ej falskt klar+betald").
- Kunden ser sin **status per salong** + **frisör-bandet: "du har sett Erik X ggr"** (antal completade bokningar med den frisören).
- **Tier-trösklar = config per salong** (sätts i M6-settings; plattformen ger förnuftig default).
- Byggs på den **stabila kund-identiteten** (M6 §4), aldrig på exponerad PII.

### 2.3 Favoriter ja, recensioner = Google-nudge
- **Favoriter:** spara favorit-tjänst + favorit-frisör → snabb-omboka därifrån. (Ny tabell `customer_favorites`.)
- **Recensioner:** Google-recensions-nudge (publik trovärdighet). **Inga in-app-betyg i v1** (slipper moderering).
  - **Mekanik — ZIVARS BESLUT (FAS 0-korrigering 2026-06-02):** nudgen är en **POPUP på bokningens bekräftelse-steg** (efter att bokningen är klar, t.ex. `/boka/bekraftelse/[id]`), **frikopplad från betalning** — visas OAVSETT om betalning finns eller inte. Ignorerbar men alltid där: ett tryck öppnar salongens länkade Google-recensionssida. URL:en sätts i M6-admin (Google-recensions-URL-fält finns). *Detta ersätter den tidigare prosan "direkt efter betalning" (Payflow) — popupen hänger INTE på betalflödet.*
  - ⚠️ **Två separata ytor — blanda inte ihop:** popupen ovan är ett **NYTT bygg-item** (storefront/bekräftelse, Våg 2). Den **befintliga e-post-nudgen** på `status = completed` (`lib/notifications/google-review.ts`) är en ANNAN kanal och **lämnas orörd** — bygg inte om den, ersätt den inte.

---

## 3. Röd tråd — kopplingar

| Koppling | Vad M4 gör | Var det andra bor |
|---|---|---|
| **M6 → M4** | kund-identitet + PII-regler; tier-trösklar (config) | M6 §4 äger kundmodell |
| **M3 → M4** | bokningar; completed → poäng; omboka/avboka | M3 äger bokning + completion |
| **M5 → M4** | "du har sett Erik X ggr" = frisör-bandet | M5/M6 äger personal |
| **M8 → M4** | (senare) sparade betalmetoder = v2 | M8 |

---

## 4. Bygg-items (vad Code faktiskt gör i M4)

**Rör INTE** (byggt): auth, BookingList/Cancel/Rebook, GdprControls, portal-shell. Bygg ovanpå.

1. **Lojalitet (§2.2):** tabell (poäng/lifetime/tier per kund per tenant); poäng på `completed` (gate mot no-show); tier-trösklar config per salong; vy i `/konto` med status + "sett Erik X ggr". Kräver kund-tabellen (M6 §4).
2. **Favoriter (§2.3):** `customer_favorites` (typ + id); spara/ta bort; snabb-omboka från favorit.
3. **Google-recensions-nudge — TVÅ ytor (FAS 0-korrigering 2026-06-02):**
   - **Behåll e-post-nudgen orörd** (`lib/notifications/google-review.ts`, fyrar på `status = completed`) — bygg inte om.
   - **NYTT (Våg 2):** recensions-**popup på bekräftelse-steget** (`/boka/bekraftelse/[id]`), frikopplad från betalning, visas oavsett betalning, ignorerbar men alltid där → öppnar salongens Google-recensions-URL (M6-admin-fält). Se §2.3.

---

## 5. Parkerat (planerat, byggs inte först)

- Sparade betalmetoder (Stripe) — v2 (M8).
- Push-notiser, referral, presentkort, prenumerationspaket, multi-salongsprofil, in-app-meddelanden — v2.
- In-app-recensioner — medvetet bort (Google-nudge täcker).
- Magic-link — slopad, ej parkerad.

---

## 6. Öppet kvar

Inget blockerande. Exakta tier-trösklar + poäng-per-bokning-värde = config, finputsas per salong vid bygge.
