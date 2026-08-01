# Goal 77 — Säkert mallbyte

## Mål

När Corevo byter en kunds webbplatsmall ska operatören välja ett av två tydliga lägen:

1. **Behåll nuvarande innehåll** — den text som syns på kundens nuvarande webbplats följer med.
2. **Använd mallens innehåll** — kundens textöverstyrningar ersätts av den valda mallens standardtext.

Förhandsvisningen ska visa samma läge som sedan publiceras.

## Hårda krav

- Kund-, kontakt-, boknings-, modul-, domän- och mediainställningar får inte påverkas.
- Bara plattformsadmin får byta mall.
- Ogiltig mall eller ogiltigt innehållsläge nekas server-side.
- Ett opublicerat kundutkast får inte kunna skriva tillbaka gammal malltext efter bytet.
- Ingen ny tabell eller generell mallversionering byggs.
- Ingen produktionsdeploy ingår.

## Acceptans

- Mallbyte med **Behåll nuvarande innehåll** materialiserar nuvarande effektiva text och visar samma text i den nya mallen.
- Mallbyte med **Använd mallens innehåll** rensar kundens copy och visar den nya mallens standardtext.
- Förhandsvisning och publicerat resultat använder samma val.
- Befintliga mall-, behörighets- och sidrevisionskontrakt fortsätter vara gröna.
- Lokal manuell kontroll görs på minst två mallar innan goalen flyttas till `klart/`.

## Verifiering 2026-07-23

- `83/83` angränsande mall-, revisions- och SidaStudio-tester gröna.
- Efter oberoende Fable-review: explicit val krävs, gammal mallrevision kan inte
  publiceras över en ny mall och preview-paritetsinvarianten är testad.
- TypeScript typecheck grön.
- Lokal browseracceptans mot Supabase-previewbranchen `localhost-acceptance`:
  kundens unika rubrik följde Leander → Källa med **Behåll nuvarande innehåll**;
  Snitts egen rubrik visades och publicerades med **Använd mallens innehåll**.
- Kontaktuppgifter och modulstatus var oförändrade efter båda mallbytena.
- Produktion användes eller deployades inte.
