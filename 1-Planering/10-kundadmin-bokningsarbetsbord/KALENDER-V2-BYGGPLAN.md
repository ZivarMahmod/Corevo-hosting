# Kalender v2 — byggplan (goal-68 fortsättning)

Källa design: `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/Kundadmin Kalender v2.dc.html` + `KALENDER-V2-NOTES.md`.
Källa funktion: `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/02-kalender-och-bokningsfloden.md`.
Metod: samma som Översikt v2 — design = LAG för utseendet, men **inga fungerande/fastställda funktioner dör** för att mockupen bantat bort dem (Zivars order).

## Utgångsläge (redan byggt, goal-67)
`CalendarBoard.tsx` + `calendar.module.css` + `BookingDrawer.tsx` + `NewBookingDrawer.tsx` + `BlockDrawer` + `CancelledLog` + `CalendarSearch` + `CalendarHelp` + `staff-colors.ts` + `calendar-actions.ts`. Dag/vecka/månad, drag&drop m. konsekvens-bekräftelse, klick-att-boka (mus+touch+tangentbord), överlapps-banor, offHours-skuggning, nu-linje, statusflagga (ikon+text, aldrig färg ensam), personens initialer i vecko/månad.
Tokens: `--c-*` → **admin dark-tema är default** (Topnav.module.css `:root:not([data-bo-theme='light'])`). Dark-hex = designens tokens 1:1.

## VAD SOM FAKTISKT ÄNDRAS (delta mot live)

### A. Verktygsrad
- **A1 mono-statusrad** under periodrubriken: `v.29 · 12 bokningar · 62% · 1 avbokad`. Kräver serverberäkning (veckonr, antal, beläggning, avbokade) i `bokningar/page.tsx` → ny prop. Beläggning = samma matte som Översikt (`sumMergedMinutes`).
- **A2 personalfilter som färgprick-chips** (Alla + en per person) i stället för native `<select>`. ⚠ Native select är MEDVETET valt för mobil. Lösning: chips på desktop/iPad, behåll kompakt fallback på smal mobil (chips-rad scrollar, eller "Alla N ▾"). Får inte tappa tangentbord/att-filtret-följer-med-vyerna.
- **A3 Dag/Vecka/Lista?** Mockupen skriver "Lista" som tredje vy. Live har **Månad** (fungerar, fastställt, byggt i goal-67). → **BEHÅLL Månad.** "Lista" var mockup-förenkling; Wavy säger listvy = sekundärt. Ingen rivning.

### B. Kolumnhuvuden
- **B1** avatar (cirkel: 2px ring i personens färg + tonad bg), namn, passtider (mono), "N idag", och **2px färglinje under huvudet** (`box-shadow: inset 0 -2px 0 färg`). Live har bara namn+timmar. Ren förbättring, additiv.

### C. Bokningsblock
- Live: 5px vänsterkant + gradient 26→9 %. Design: 3px + 16 % ton. → mindre justering, MEN Zivar bad tidigare om TYDLIGARE färg. Behåll ~live-styrkan, ev. dra ner ton nån aning. Låg prio.
- Avbokad (streckad röd + AVBOKAD), klar (nedtonad+genomstruken), paus (diagonalrand): **finns redan**. OK.

### D. Klick-bubbla (ENDA genuint nya interaktionen)
- Design: klick på block → liten chattbubbla vid pekaren med `✆ Ring` (bara om nummer) + `Öppna`. Öppna → drawern. Paus = ingen bubbla.
- Live: klick → öppnar drawern direkt.
- Bygg bubblan som mellansteg. Snabb-ring utan att öppna = värdet ("hen är sen — ring"). Måste vara tangentbords-nåbar (Enter på block → öppna drawer direkt ELLER bubbla med fokusfälla). Ring = `tel:`-href (finns `telHref`).

### E. Bokningsdialog (RESTYLE, inte strip)
- Design-hero: personprick + "hos X · idag", stor tid + tjänst, `min · kr`, kundrad (initialer, NY KUND-chip, nummer/"Inget nummer angivet", Ring), ev. anteckning kursiv, åtgärder.
- ⚠ NOTES säger EXPLICIT: behåll all viktig kundinfo (historik, e-post, bokningskälla, betalstatus) — viktigast först, resten under men försvinner INTE.
- → Omstylea `BookingDrawer` så hero:t leder; behåll betalning/källa/bokad-den/noteringar under. Ingen rivning av sektioner.
- **Checka in (grön):** designens verb. Det finns INGEN check-in-status i DB (statusspektrat = pending/confirmed/completed/cancelled/no_show). → Behåll "Markera klar" (verklig completion). Lägg INTE till en check-in-knapp som inte gör något (Zivar: döda inget, men hitta inte på tomma kopplingar heller). Flagga för beslut.
- **Omboka:** live har drag+bekräfta (inte in-drawer-omboka). Wavy vill ha explicit Flytta utöver drag. Egen framtida funktion — inte v2-restylens kärna. Flagga.

### F. Ny bokning / Blockera-dialoger
- Restyla till v2-stil (chips, mono-etiketter). ⚠ NOTES: behåll ALLA befintliga fält (tjänsteval m. pris/längd, kundsök/befintlig, e-post, anteckning, betalsätt, sms-bekräftelse; blockera: heldag/återkommande/anledning). Bara stilen byter.

### G. Översikt-följdändringar (KALENDER-V2-NOTES §32)
Merparten gjordes redan i Översikt v2 (Avbokningspanel, godkänn/avböj borttaget, auto-bekräfta). KVAR att verifiera/göra:
- **G1 källa-chips ONLINE/SALONG** i "Kommande idag" (ersätter OBEKRÄFTAD/BEKRÄFTAD). ✗ BEKRÄFTAT: **ingen `source`-kolumn finns** på `bookings` (0001-schema; endast `booking_status_history.source='app'` = revisionsetikett). Admin-bokning sätter `status='confirmed'` direkt, publik kan ligga `pending` — enda indirekta skillnaden. → Att införa ONLINE/SALONG kräver NY kolumn satt på BÅDA skapa-vägarna (`create_public_booking` = online, `createAdminBooking` = salong) = rör bokningsmotorn (must-never-break). **UTANFÖR visuella v2 — flaggas som eget litet DB-jobb.**
- **G2 personfärger** #8FB4E3 osv "överallt". ⚠ Krock med Okabe–Ito colorblind-säker palett (fastställd accessibility, goal-67) + färg är per-person valbar i DB. Designens 4 hex = FreshCut-exempel, inte en systempalett. → Behåll den tillgängliga paletten; hårdkoda inte 4 namngivna. FLAGGA för Zivar.

## Öppna beslut (flagga, hitta inte på)
1. **Färgpalett:** behålla Okabe–Ito (colorblind-säker, fastställd) vs byta till designens pastellhex. Default: behåll.
2. **Checka in:** ingen check-in-status finns. Default: behåll "Markera klar", ingen tom knapp.
3. **Omboka-knapp i drawern:** framtida (explicit Flytta). Ej v2-kärna.

## STATUS (2026-07-15)
- ✅ **A1** mono-statusrad — KLIENT-sida (följer resurs/plats-filter), `isoWeekNumber`+test, `workedMinutes` på CalendarStaff.
- ✅ **A2** personal-chips (≤6, färgprick) + select-fallback (>6).
- ✅ **B1** kolumnhuvud: avatar + "N idag" + 2px färglinje (`.headCellDay`, veckohuvud orört).
- ✅ **D** klick-bubbla (`CalendarBubble`): pekare/touch→bubbla (Ring om nummer + Öppna), tangentbord→drawer direkt, Escape/scrim/fokus/viewport-klamp, paus aldrig bubbla.
- Verifierat: tsc rent · eslint rent · vitest 1112 grön · rutter kompilerar (login 200, /admin/bokningar 307). Codex-diffgranskning pågår.
- ⏭️ KVAR: **E** drawer-restyle (hero-lett, behåll all info), **F** Ny bokning/Blockera-restyle, px/h-beslut (84 vs designens 54), färgpalett-beslut (behåll Okabe–Ito), G1 källa-chips (eget DB-jobb).

## Ordning
1. Kartläggning klar (data/actions/drawer-fält/källa-fält). 2. Codex granskar planen. 3. Bygg A→F i `calendar.module.css`+`CalendarBoard.tsx`+`BookingDrawer.tsx` (+page.tsx för A1-stats). 4. G1 om fält finns. 5. Bygg + typecheck + lint + tester + lokal rök (login/storefront/bokning/admin/personal/plattform, mobil+desktop). 6. Codex diff-granskning. 7. Commit avgränsat, deploy, prod-rök.

## Får ALDRIG gå sönder
Bokningar, ombokningar, avbokningar, kunddata, lojalitet, behörigheter, tenant-isolering. Tillgänglighet (tangentbord/fokus/reduced-motion/status-ej-bara-färg). Mobil (native-mönster där de vinner). Deploy endast via v*-tagg.
