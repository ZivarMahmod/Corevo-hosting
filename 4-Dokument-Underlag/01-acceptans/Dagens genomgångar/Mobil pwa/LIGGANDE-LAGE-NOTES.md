# Chrome-system (banner + nav + åtgärder) — gäller ALLA adminsidor — handoff till Codex

## 🚨 LÄS FÖRST — detta är ETT SKAL, inte ny funktionalitet
Detta dokument + prototypfilen beskriver **hur chrome (topbanner, navigering, åtgärdsknappar) och dialoger ska SE UT och vara placerade** — ingenting annat.

- **Ta INTE bort eller ändra befintlig funktionalitet** i dialogerna (bokning, ny bokning, blockera, sök, hjälp). Alla fält, val, valideringar, steg och beteenden som finns i nuvarande bygge ska vara kvar precis som de är.
- Prototypens dialoger visar **stil, storlek och placering** (stor sheet som fyller skärmen, primär åtgärd i botten) — INTE en komplett eller reducerad fältlista. Där prototypen visar färre fält än produktionen: behåll produktionens fält, lägg dem bara i det nya skalet.
- Det som ÄR nytt och ska implementeras: (1) enhetliga ikon+etikett-knappar överallt, (2) identisk banner per sida, (3) två-nivå-dock i stående, (4) rail-läge i liggande, (5) dialoger som stora sheets i stället för små bottenrutor. Logiken bakom knapparna = oförändrad.
- Kort sagt: **byt skalet, rör inte innehållet.**

Fil: `Kundadmin Liggande läge.dc.html` — interaktiv referens med 3 ramar:
1. **Stående** (iPhone porträtt) — kanoniskt banner + bottendock, alla knappar working.
2. **Liggande kalender** — samma knappar omflödade till rail vänster/höger.
3. **Liggande kunder** — visar att railen bär oförändrad, bara innehållet byts.

Detta är INTE nya sidor — det är hur chrome (topbanner, nav, åtgärder) ska se ut och bete sig likadant på Översikt / Kalender / Kunder / Mer, i båda orienteringar.

## ⚠ Kärnregeln — en knapp = en ikon + en etikett
Problemet idag: chrome skiftar mellan sidor — ibland textlänk, ibland ikon, ibland inget; unicode-glyfer (⌕ ◔ ?) som renderas olika per enhet.

Fixen:
- **Varje interaktiv sak = en linjeikon + en mono-etikett i VERSALER under.** Aldrig text-utan-ikon, aldrig ikon-utan-etikett.
- **En enda ikonuppsättning** (SVG, stroke 1.7px, `currentColor`, viewBox 0 0 24 24): oversikt (2×2-rutnät), kalender, kunder (två personer), mer (tre linjer), sok (lupp), plus, blockera (klocka), hjalp (frågetecken i cirkel), chevL/chevR. Byt ut alla unicode-glyfer mot dessa.
- **Färg = state, inte form.** Aktiv nav = grön ikon+etikett. Inaktiv = grå (#8B8B80). Ikonen ärver `color` från sin container.
- **Inga runda knappar.** Ikonen står naken (ingen cirkel/pill runt om) — det ÄR ikonen som är knappen. Distinktion görs med FÄRG, inte form: primär = grön, blockera = varm gul (#A8761F), aktiv nav = grön, övrigt = ink. Etikett mono 7–8px `.05em`. Alla tryckytor ≥ 44px (via padding, inte cirkel).

## Bannern — identisk på alla sidor
`logga (F) · sidtitel (+ meta-underrad) · Hjälp (ikon+etikett)`. Inget annat bor i bannern.
- Sidtitel/meta byts per sida: Kalender = "Lördag 18 juli ▾" + "v.29 · N bokningar"; Översikt/Kunder/Mer = sitt namn + kort meta.
- Sidans egna verktyg (datum-nav, Dag/Vecka/Månad) ligger i en **egen rad UNDER bannern**, bara på Kalender — aldrig inbakat i bannern. Det är det som gör att bannern känns lika överallt.

## Stående — bottendock i TVÅ nivåer (tumnära)
1. **Kontextrad (överst) — anpassas efter aktiv flik.** Platta icon+label-åtgärder, horisontellt, med hårfina avdelare:
   - Kalender → **Sök · + Ny bokning · Blockera**
   - Kunder → **Sök · + Ny kund**
   - Översikt → **Sök**
   - Mer → (raden döljs helt)
   Primär (+) = grön, Blockera = varm gul. Öppnar **stora sheets som fyller skärmen** (från strax under notchen till botten, rundade topphörn, drag-handle + ✕; primär åtgärd fäst i botten). Inte små bottenrutor.
2. **Navigeringsrad (nederst) — ALLTID samma 4 flikar:** `Översikt · Kalender · Kunder · Mer`, platta icon+label, aktiv = grön. Detta är den enkla, alltid tillgängliga vägen tillbaka — man trycker bara på fliken man vill till. Ingen separat bakåtknapp behövs.
- Safe-area + hemindikator i botten.
- Detta löser två saker: Blockera (m.fl. sidspecifika åtgärder) göms aldrig, och bottenbaren "känns rätt" per flik utan avancerat lägesbyte.

## Liggande — docken viks upp till rail (höjd < 520px, se nedan)
- **Vänsterrail (64–66px):** logga · Hjälp · nav (samma 4 destinationer, icon+label, aktiv grön) · **‹ föregående dag** (44px, etikett = måldag, t.ex. "FRE 17").
- **Högerrail (64–66px):** Sök · + Boka · Blockera (icon+label, 44px) · **› nästa dag**.
- **Dagsteg = tummarna.** Vänstertumme ‹ bakåt, högertumme › framåt. Samma sak med **fingersvep vänster/höger** över schemat (48px tröskel). Exakt datum: tryck på datumet → minimånad. Steg-paret är dimmat i månadsvyn.
- Sheets öppnas som **sidopaneler från höger** (railen kvar synlig) i stället för underifrån — samma innehåll, samma fält, samma 2-stegsbekräftelser. (I koden delar stående/liggande exakt samma sheet-kroppar; bara förankringen skiljer.)

## Varför så här (kort motivering)
- **Varför ikon+etikett överallt:** ägaren klickar samma sak på olika sidor idag men den ser olika ut (text/ikon/inget). En enda knappform = inget att lära om per sida; ikonen ger snabb igenkänning, etiketten tar bort all tvekan.
- **Varför inga runda knappar:** cirklar/pillar runt ikoner läste som "något extra pålagt". Naken linjeikon + etikett är lugnare och känns som en del av systemet; primärt/varning markeras med FÄRG i stället.
- **Varför två-nivå-dock i stående:** åtgärder som Blockera låg gömda. Kontextraden lyfter fram just den sidans åtgärder, och den fasta 4-tabs-navraden under är en enkel, alltid tillgänglig väg tillbaka — ingen avancerad navigering.
- **Varför rail i liggande (inte desktop):** en telefon i liggande är bred men LÅG; desktoplayouten staplar chrome och kväver kalenderytan. Railen flyttar ut chrome i sidled så schemat får hela höjden, och lägger nav/åtgärder vid tummarna.
- **Varför stora sheets:** små bottenrutor kändes hopklämda och nådde inte tummen bra. En sheet som fyller skärmen ger plats åt alla (bevarade) fält och lägger primär åtgärd i botten.

## Media-regeln (oförändrad — höjden avgör)
```css
@media (orientation: landscape) and (max-height: 520px) { /* rail-läget */ }
```
iPhone liggande (~393px hög) → rail. iPad liggande (≥768px hög) → desktop orörd. Stående mobil → dock. Ingen UA-sniffning.

## Acceptanskriterier
1. På alla fyra sidor ser bannern likadan ut (logga · titel · Hjälp), och varje knapp har ikon + etikett — ingen ren text, ingen naken ikon.
2. Samma ikonuppsättning och samma mått i dock (stående) och rail (liggande).
3. Stående: två-nivå-dock — kontextrad (byts per flik, Blockera syns på Kalender) + fast 4-tabs-nav (väg tillbaka). Inga runda knappar.
4. Liggande: nav i vänsterrail, åtgärder + dagsteg i högerrail; ‹ › och fingersvep byter dag; sheets = högerpaneler.
5. Aktiv flik = grön ikon+etikett; inga unicode-glyfer och inga cirkelknappar kvar — nakna linjeikoner + etikett överallt.
6. iPad liggande oförändrad; rotation behåller sida/dag/vy.
