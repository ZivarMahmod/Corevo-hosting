# Ägar-admin Mobil/PWA — byggplan (helheten)

Mock: `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/ägareadmin-mobil-pwa/` (`index-Kundadmin Mobil PWA.html` + `KUNDADMIN-MOBIL-PWA-NOTES.md` = LAG). Sätter standarden för de andra admin-rollerna (kommer senare).

## Bärande princip (från NOTES, ett KRAV)
**SAMMA admin som desktop (booking.corevo.se) — ingen separat app/kodbas.** EN sida som anpassar layouten ENBART efter CSS-viewportens bredd. Aldrig UA-sniff, aldrig "är detta en telefon". Då funkar "visa datorversion", browser-zoom och split-screen gratis.
- Brytpunkter: **≥1200 Desktop** · **768–1199 iPad** · **<768 Mobil**.
- Meta `viewport: width=device-width, initial-scale=1`. INGEN `user-scalable=no`, inga `touch-action`-hack — pinch får aldrig byta läge (tillgänglighet).
- Kalenderkolumner ALLTID `repeat(4/N, 1fr)`. Det som ändras per bredd = blockens innehållsnivå + chrome (flikar ↔ bottennav).

## Skärmar (mobil <768)
Chrome: **topprad 52px** (logo · [flex] · sök-ikon · avatar) + **bottennav 5 slots** (Översikt · Kalender · grön **Ny bokning-FAB** mitten upphöjd · Kunder · Mer). Safe-area-inset, touch ≥44px. Inga synliga scrollbars.
1. **Kalender (tjänan):** datum+monorad · ‹ Idag ›-stegare · ◔ Blockera · **dagsnabbval-chips** · **alla 4 frisörer som kolumner, fit-to-width (ingen vågrät scroll)** · nu-linje (autoscroll in) · block trimmar innehåll per bredd.
2. **Översikt:** Härnäst-kort (countdown, 2-stegs Checka in, Visa→kalendern) · Idag i siffror (progressbars) · Kräver uppmärksamhet · Avbokningar (segment Idag/Vecka/Månad).
3. **Kunder:** sök + radlista → kundkort (befintligt, Kunder v2).
4. **Mer:** Redigera sidan · Inställningar · Öppna min sida ↗ · Mörkt läge (Auto/Ljus/Mörk) · profil · Logga ut.

Overlays (mobil = bottom sheets): **bubbla** (Ring/Öppna) → **boknings-sheet** (tid/tjänst/kund/Ring/anteckning · 2-stegs Checka in · **Omboka** · Avboka) · **Ny bokning-sheet** (FAB) · **Blockera tid-sheet** (◔).

## Block-innehåll per bredd (Zivars info-densitet: visa namn/typ/telefon max)
- Desktop: starttid + kund + tjänst · min · kr.
- iPad: som desktop, tjänstraden faller på korta block.
- Mobil (smal kolumn): **starttid (mono) + kundnamn**, tjänst bara på block ≥45 min. Färg = frisör (tint 16% + 3px vänsterkant). Klar=nedtonad+genomstruken · Paus=diagonalrandig · Avbokad=streckad röd ram + AVBOKAD.

## Nuläge vs mål (gap)
- Chrome: idag `PortalShell`-sidomeny. Mock <768 = bottennav + FAB + Mer-sheet. → responsivt chrome-lager.
- Kalender: idag `--col-min:148px` + `max-content` → vågrät scroll på mobil. Mock <768 = `repeat(N,1fr)` fit-to-width, ingen scroll. → container/media-query på kolumnerna + block-trim per bredd.
- Dialoger → bottom sheets <768.
- Flytt: desktop drag kvar; **mobil = Omboka i sheet** (drag krockar med scroll — redan borttaget svep 2026-07-15 v1.34.1).

## Faser (en i taget → verifiera → klart)
- **✅ Fas 0 (KLAR, v1.34.1):** ta bort krockande svep → dagsnabbval-chips.
- **Fas 1 — Kalender mobil (tjänan):** fit-to-width 4-kolumner <768 (ingen vågrät scroll) + block-innehåll trimmat per bredd (namn/typ/telefon-prioritet) + nu-linje. Ingen ny data.
- **Fas 2 — Chrome responsivt:** bottennav + FAB + topprad-komprimering + Mer-sheet <768; behåll sidomeny ≥768. UA-fritt, bara media/container queries.
- **Fas 3 — Sheets:** boknings-bubbla→sheet (Omboka-flytt), Ny bokning-sheet (FAB), Blockera-sheet <768; dialoger centrerade ≥768.
- **Fas 4 — Översikt + Kunder + Mer mobil-layout** enligt mock.
- **Fas 5 — PWA-polish:** nu-linje-autoscroll, safe-area, verifiera datorversion/zoom/pinch-matrisen (1440/1024/390/150%/pinch).

## Regler
Design = exakt kopia (lyft px/hex ur mock, tokens finns i `--c-*`). Döda ingen funktion. Verifiera per fas (tsc/eslint/vitest + rutter + Codex-diff) → commit → deploy → prod-rök → flytta klart designpaket till `Dagens genomgångar/klar/`.
