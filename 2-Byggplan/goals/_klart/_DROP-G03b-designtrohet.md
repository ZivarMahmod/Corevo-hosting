# G03b — Designtrohet + temamallar (efter G03 v1)

Status: PLANERAD. Körs EFTER att G03 v1 är klar och live-preview funkar. Hör ihop med ADR 01 temalager (nivå 2 layout-varianter + nivå 3 custom).

## Varför
Zivar gillar känslan i två befintliga sidor. Publik-sajten ska byggas nära den vibe-en, sen erbjudas som val-bara mallar till framtida kunder. Detta ÄR temalagret i ADR 01 (nivå 2) — inte en avstickare.

Referenser:
- FreshCut (deras nuvarande sida): http://freshcut.se/
- Tofifi Cut and Trim (mål-exempel): https://zivarmahmod.github.io/Fris-ren/

## Del 1 — Designextraktion (Playwright + dev tools)
Code använder Playwright-MCP + dev tools för att läsa av båda referenssidorna och dra ut så mycket designdata som möjligt:
- Färgpalett (hex), typsnitt + storlekar/vikter, spacing-rytm.
- Layout-struktur (hero, sektioner, "varför oss", footer), copy-ton, bildbehandling (former, vågor/clip-path).
- Komponentmönster (nav, CTA-knappar "BOKA TID", kort-rader).
Spara som designspec → `3-Bakgrund-Research/designspec-frisor.md` (+ ev. assets-lista). Ingen kopiering av skyddat material — fånga mönster/struktur, bygg eget.

## Del 2 — Höj publik v1 till den nivån
Polera G03:s publika sidor så de matchar känslan (hero med bild + vågform, sektioner, footer), allt drivet av tenant-branding (CSS-variabler) så det funkar för alla tenants.

## Del 3 — Temamallar för design att välja mellan (nivå 2)
Bygg 2–3 layout-varianter som färdiga val (nav_variant / hero_variant i `tenant_settings.settings.layout`), så en ny kund kan välja modell utan kod. Senare kan design lägga till fler varianter + ev. nivå-3 custom-CSS per kund.

## Röd tråd
v1 (G03) → designtrohet (G03b del 1–2) → val-bara mallar (G03b del 3 = ADR nivå 2). Samma goal-driven flöde, ingen sidospår.
