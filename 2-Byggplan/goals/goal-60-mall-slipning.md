# goal-60 — Diamantslipning av florist-sviten (13 mallar, en runda per mall)

**Status:** ej påbörjad · **Föregångare:** goal-58 (13 mallar), goal-59 (vektor-regeln, tema-paket)
**Skärmdumpar (Zivars granskning 2026-07-12):** `4-Dokument-Underlag/skarmdumpar-bygg/goal-60-mall-granskning/`

## Problemet

goal-58/59 gav 13 mallar med **äkta egen vektor** — olika layout, olika CSS, olika sektionsordning.
Det höll. Men de är **oslipade**: 13 agenter byggde parallellt, ingen såg helheten, och resultatet är
en svärm småbuggar där färg, text, kontrast och komponent-detaljer inte hänger ihop.

Zivar (ordagrant): *"färgpaletterna och texten är många gånger helt galna… dessa diamanter behöver
slipas med logik. rätt vektor. rätt layout. sånt som får en hemsida att kännas äkta."*
Och: *"webshoppen känns inte äkta — den är bara bilder eller bara torra knappar. jag vill ha snygga knappar."*

## Bug-inventering ur skärmdumparna (mätt, inte gissat)

| # | Bugg | Var (sett) | Sannolik orsak |
|---|---|---|---|
| B1 | **Announcement-baren renderas TVÅ gånger** (mörk rad + tema-färgad rad ovanpå varandra) | calytrix, seraphina/eloria | shared Nav-announcement lever kvar SAMTIDIGT som tema-chromet ritar sin egen |
| B2 | **Nav bryter till två rader** (…PRESENTKORT / OM OSS KONTAKT) | calytrix | 9 länkar + logga + korg + konto + CTA får inte plats; ingen overflow-strategi |
| B3 | **Nav renderas som lodrät lista ovanpå heron** | mina (?) | flex-riktning/position kollapsar; navet läggs som overlay utan höjd |
| B4 | **Nav-länkar OSYNLIGA — tomma rutor** | seraphina/eloria (mörkgrön) | länkfärg == bakgrundsfärg (paletten pekar fel var) |
| B5 | **Nav-text nästan osynlig på mörk bg** | isalara (marinblå) | kontrast långt under 4.5:1 |
| B6 | **Sticky nav täcker innehållet** — produktkort/rubriker klipps under navet | isalara, mina, calytrix | `--nav-h` saknas → ingen scroll-padding/offset (samma klass av bugg som onyx-fixen i v1.9.1) |
| B7 | **Enskilda ord i brödtext får avvikande färg** ("…anmäl dig och *ditt* sällskap…") | isalara | en `<em>`/highlight-regel färgar text den inte ska färga |
| B8 | **Produktkorten radbryter fel** — kort 3:s pris/antal/knapp ligger på fel höjd | calytrix butik | korten är inte grid-radjusterade (ingen `grid-template-rows: subgrid`/flex-stretch) |
| B9 | **"POPULÄR"-pill hänger utanför kortets vänsterkant** | calytrix | absolut position mot fel container |
| B10 | **Bilder svämmar över kortets ram / rätt ratio saknas** | calytrix, mina | ingen `aspect-ratio` + `object-fit` |
| B11 | **Footer-navet som pill-knappar som krockar med rubrik/text** | aurora | footer-grid kollapsar; 9 pillerknappar = fel komponent för navigering |
| B12 | **Loggan = samma lilla generiska stämpel överallt** | alla | ingen tema-egen logotyp-behandling (ordbild/monogram) |
| B13 | **Köpknappen är "torr"** — platt rektangel, ingen hover/press/loading-övergång | alla | AddToCart har ingen tema-styling utöver färg |
| B14 | **Runda hörn utan mening** — piller-knappar, runda ikon-cirklar, rundade kort blandat i samma vy | flera | radie-skalan följer inte binär-regeln i `design-skarpa-zentum.md` |
| B15 | **Copy är IDENTISK över alla 13** | alla | evergreen-copyn kopierades mellan mallarna → mallens röst saknas |

## Metod: en mall i taget, 5 agenter per runda

**Calytrix är först och blir GULDMALLEN.** När den är perfekt destillerar jag mönstret till ett
**slipnings-protokoll** (`4-Dokument-Underlag/slipnings-protokoll.md`) — knapp-anatomi, radie-skala,
kontrast-golv, kort-anatomi, nav-strategi, footer-anatomi, copy-röst — och kör sedan samma 5-agents-runda
per mall med protokollet som lag. **Efter runda 1 återkopplar jag till Zivar innan mall 2 startar.**

### Runda 0 (en gång, före Calytrix): RIKTIGA SIDOR
Research-agent jagar riktiga blomsterhandlare — **Interflora, Euroflorist, Bloom & Wild, Freddie's Flowers,
Sadie's Floral, Tonic Blooms, Haute Floral, Floom, McQueens** — och dokumenterar mätbart:
knapp-anatomi (höjd, padding, radie, hover/press-övergång, ikon), produktkortets anatomi (bild-ratio,
var priset står, badge-placering, vad hover gör), nav-strategin vid 9 länkar (dropdown? färre? mega?),
footer-anatomin, mikro-interaktioner (fade, lyft, bild-zoom, skeleton). → `riktiga-floristsajter-komponenter.md`.

### Runda per mall — 5 agenter parallellt

| Agent | Uppdrag | Levererar |
|---|---|---|
| **A1 · Kod** | Läser mallens 6 filer rad för rad. Hittar layout-buggar, kollapsade grids, overflow, felaktig positionering, saknad `--nav-h`, dubbelrenderad chrome | FAIL-lista med fil:rad |
| **A2 · Logik** | Modul-kontraktet: pausad butik, tomt sortiment, saknad slug, null-bild, modul-gating, limit/moreHref, synkron render | PASS/FAIL mot `modulvyer.test.tsx`-kontraktet |
| **A3 · Färg & kontrast** | Varje färgpar i mallen mäts. Golv: brödtext ≥4.5:1, rubrik ≥7:1 (helst 11:1 per `design-skarpa-zentum.md`), nav-länk ≥4.5:1, knapp-text mot knapp-bg ≥4.5:1. ≤8 hex, EN accent | Kontrast-tabell + rättade hex |
| **A4 · Form & mening** | Jagar meningslös dekor: runda hörn som inte betyder något, ikon-cirklar, pill-knappar, blandad radie i samma vy, blandade bild-ratios. Binär radie-regel: mallen väljer ETT uttryck | Lista på vad som ska bort/enas |
| **A5 · UX & komponent** | Knappar (vila/hover/press/fokus/disabled/loading), kort-hover, bild-zoom, övergångar, fokus-ring, tab-ordning, touch-mål ≥44px, mallens egen röst i copyn | Komponent-spec + copy-omskrivning |

Sedan: **jag syr ihop** (agenterna föreslår, jag skriver), kör `tsc` + `eslint` + `vitest` + `next build`,
och Zivar tittar med ögat. Först då nästa mall.

## Klart-kriterium per mall

- 0 buggar från B1–B15 kvar i den mallen
- kontrast-golvet klarat i varje vy (hem, butik, blogg, om, tjänster, kontakt)
- knappen har alla 6 lägen, med tema-egen övergång
- radie/bild-ratio/hex-antal följer `design-skarpa-zentum.md`
- copyn är mallens egen röst, inte kopia
- tsc 0 · eslint 0 · vitest grönt · `next build` grönt
- **Zivar har sett den och sagt ja**
