# FreshCut — seed-data för goal-15 (baseline)

> Underlag som Nörden tar fram (goal-15 §Beroende). Code seedar FreshCut-tenanten från detta + salvia-temat. **Källäge:** freshcut.se ligger nere/JS-app med utgånget cert (2026-06-02) → exakt prislista + team gick INTE att skrapa live. Det som är **RIKTIGT** (verifierat) vs **PLATSHÅLLARE (bekräfta med Zivar)** är märkt nedan. Zivar: "inte mycket men så likt som möjligt — en lätt baseline att gå på."

## Tenant (RIKTIGT)
- **Namn:** FreshCut (skrivs ihop; listat som "Fresh Cut" på Frisörlistan)
- **Slug:** `freshcut`
- **Typ:** herrfrisör / barbershop (herrklippning + skäggvård, hög kvalitet, avslappnad miljö)
- **Status:** `active`
- **Tema:** `salvia` (sage #5E7361 + varmt papper #F6F4EE + oliv) — inga inline-hex (temat ska driva)

## Plats & kontakt (RIKTIGT)
- **Adress:** Bokhållaregatan 2, 582 24 Linköping
- **Telefon:** 073-876 71 44 (+46 73 876 71 44)
- **Timezone:** `Europe/Stockholm`
- **Betyg (social proof, från Google/Frisörlistan):** 4.9 / 5, 137 omdömen → kan användas i stat-trion ("4.9★", "137 omdömen")

## Copy / texter
- **Taglines (RIKTIGT — från deras egen sida):** "Trevlig miljö" · "Grymma barberare" · "Gör dig alltid nöjd"
- **Hero-rubrik (PLATSHÅLLARE, i FreshCut-anda):** "Grymma barberare. Skönt mottagen."
- **Tagline/under-hero (PLATSHÅLLARE):** "En barbershop i centrala Linköping. Herrklippning och skägg av barberare som gör dig nöjd varje gång."
- **Om-text (PLATSHÅLLARE, byggd på riktig profil):** "FreshCut är en barbershop i hjärtat av Linköping. Våra barberare har många år bakom stolen och kan herrhår — från ren snagg till klippning med skägg. Vi håller en trevlig, avslappnad miljö och slutar inte förrän du är nöjd."
- **Stat-trio (PLATSHÅLLARE/RIKTIGT-mix):** "4.9★ betyg" · "137 omdömen" · "100% barberare"

## Tjänster (RIKTIGT — från FreshCuts prislista "Hår och skägg", via Zivar)
Kategori: **Hår och skägg**. Pris i öre i DB. Durations = uppskattade (justeras lätt i admin).

| # | Namn | Beskrivning | Pris (kr) | Pris (öre) | Tid (min) |
|---|---|---|---|---|---|
| 01 | Herrklippning | Tvätt & styling ingår | 369 | 36900 | 30 |
| 02 | Herrklippning Student | Gäller vid uppvisande av giltig studenthandling | 329 | 32900 | 30 |
| 03 | Herrklippning + skägg + varm handduk | Långt skägg | 459 | 45900 | 45 |
| 04 | Herrklippning + skägg + varm handduk | Kort skägg | 419 | 41900 | 45 |
| 05 | Pensionärklippning | — | 329 | 32900 | 30 |
| 06 | Barnklippning | Upp till 8 år | 299 | 29900 | 25 |
| 07 | Skäggtrim | — | 229 | 22900 | 15 |

> ✅ Priser verifierade mot FreshCuts riktiga prislista. Durations är uppskattade. Namn #03/#04 har samma titel, skiljs på beskrivning (långt/kort skägg) — Code kan suffixa titeln om unik-krav finns.

## Personal (PLATSHÅLLARE — inga riktiga namn skrapbara)
goal-15 tillåter "Anställd 1" eller riktiga namn. Föreslår 2 barberare som platshållare tills Zivar ger riktiga:
- **Barberare 1** — kopplad till alla tjänster (01–06)
- **Barberare 2** — kopplad till alla tjänster (01–06)

## Öppettider (RIKTIGT — från FreshCut/Frisörlistan)
| Dag | Tider |
|---|---|
| Måndag | 10:00–18:00 |
| Tisdag | 10:00–18:00 |
| Onsdag | 10:00–18:00 |
| Torsdag | 10:00–18:00 |
| Fredag | 10:00–19:00 |
| Lördag | 10:00–16:00 |
| Söndag | Stängt |

## Bilder
Inga riktiga FreshCut-bilder skrapbara → **salvia-temats default-bilder** (hero/galleri/team) tills Zivar laddar upp egna via branding-editorn (R2).

## Sammanfattning för Code
**Riktigt & säkert (seeda rakt av):** namn, slug, typ (barbershop), adress (Bokhållaregatan 2, Linköping), telefon (073-876 71 44), betyg 4.9/137, taglines, **7 tjänster m. riktiga priser**, **riktiga öppettider**.
**Platshållare (seedas men flagga, Zivar finjusterar i admin):** team-namn (2 barberare), hero/om-copy, bilder (salvia-default). → det är just det baseline ska bevisa att man kan ändra själv.

## Källor
- [Fresh Cut – frisör i Linköping (Frisörlistan)](https://www.frisorlistan.se/linkoping/fresh-cut-fjJYAQ/)
- [FreshCut prissida (taglines)](http://freshcut.se/priser)
