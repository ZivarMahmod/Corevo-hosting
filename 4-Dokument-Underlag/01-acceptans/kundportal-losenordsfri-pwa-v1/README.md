# Kundportal lösenordsfri PWA v1 — designpaket

## Överordnad lag

Designspecifikationen `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md` är **överordnad lag** för detta paket. Vid varje konflikt mellan paketets filer och specifikationen vinner specifikationen. Paketet ska vara en exakt leverans mot dess avsnitt 28–30 — inga egna tolkningar, inga improvisationer.

## Paketets tio kanoniska filer (i ordning)

1. `README.md` — denna fil: hur paketet öppnas och vilka filer som är kanon.
2. `SPEC.md` — skärm- och komponentindex som spårar varje krav i briefen.
3. `Kundportal Passwordless Mobil.dc.html` — interaktiv mobilprototyp.
4. `Kundportal Passwordless Desktop.dc.html` — interaktiv desktopprototyp.
5. `Kundportal Passwordless States.dc.html` — obligatoriskt tillståndsgalleri.
6. `TOKENS.md` — exakta färger, typsnitt, spacing, radier, shadows, breakpoints och fokusvärden.
7. `COMPONENTS.md` — exakt komponentanatomi, variants och interaktioner.
8. `COPY.md` — all svensk UI-text och feltext.
9. `FEATURE-MATRIX.md` — varje funktion markerad `NU`, `FÖRBEREDD/DOLD` eller `LEGACY/BEVARAD`, spårad till briefavsnitt.
10. `ACCEPTANCE-MATRIX.md` — unika krav-ID:n, berörd prototyp/state, exakt kontrollmetod och resultatkolumn för oberoende granskning.

Inga andra filer är kanon. OLD-mappar och utkast utanför paketet ignoreras.

## Öppna prototyperna

HTML-filerna öppnas **lokalt direkt i webbläsaren** (dubbelklick eller `Ctrl+O`) — ingen server och inga nätverksanrop behövs för att ladda eller använda prototypens interna states. De är självbärande med inline CSS/JS och lokal font-stack; inga externa imports, CDN:er eller automatiska nätverksanrop förekommer. Avsiktliga produktlänkar (`tel:`, karta, tenantens bokningssida och no-JS-länkar) får navigera först efter ett verkligt användarklick; de är produktbeteende, inte resursberoenden.

## Rekommenderad granskningsordning

1. `README.md` (denna fil)
2. `SPEC.md` — helhetsbilden och kravspårningen
3. `TOKENS.md` → `COMPONENTS.md` → `COPY.md` — de exakta värdena
4. `Kundportal Passwordless Mobil.dc.html` — mobilflödet först (SMS-bootstrap → bokningsdetalj m.m.)
5. `Kundportal Passwordless Desktop.dc.html`
6. `Kundportal Passwordless States.dc.html` — alla obligatoriska tillstånd
7. `FEATURE-MATRIX.md` → `ACCEPTANCE-MATRIX.md` — mekanisk avprickning mot specavsnitt 29

## Fixtures: FreshCut och Nordverk

Tenantfixtures **FreshCut** (frisör) och **Nordverk Bilservice** (bilverkstad) är helt **syntetiska** och helt **separata** — de får aldrig visas som två företag i samma v1-session. Fixtureväxlingen är endast en tydligt märkt prototypkontroll, inte en produktfunktion eller säkerhetsmekanism.

## ⛔ Implementation

Implementation är **förbjuden** tills en oberoende granskning enligt specavsnitt 29 gett **0 blockerare i `ACCEPTANCE-MATRIX.md`**. Först därefter förs krav-ID:n och exakta visuella värden över till `5-Kod/e2e/acceptans/kundportal-losenordsfri-pwa-v1/` (`*.accept.spec.ts` + `probe.js`), och implementationen får inte märkas klar förrän båda ger mekaniskt `0 FAIL`.

## Data

Paketet innehåller **inga credentials, inga produktionshemligheter och ingen riktig kunddata** — alla namn, telefonnummer, bokningar och tenants är påhittade.
