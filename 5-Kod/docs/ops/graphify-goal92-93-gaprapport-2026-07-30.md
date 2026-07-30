# Graphify — effekt- och gaprapport för Goal 92–93

Datum: 2026-07-30
Projekt: `corevo`
Worktree: `pin-booking-sim-fallback`
Branchref i grafregistret: `ref-0da155d7`

## Faktiskt nuläge

- Kodgraf: 10 786 noder, 26 068 länkar, 706 communities och 8 hyperedges.
- `graph.json` är byggd mot commit
  `0da155d776f7083ef62c7392bfc3a781651dc331`.
- Grafens senaste topologiska skrivning var 2026-07-30 05:15 UTC.
- Filmanifest/Studio-HTML uppdaterades 2026-07-30 05:33 UTC efter senare
  arbetsfilsändringar.
- `list_projects.updated_at` visar fortfarande 2026-07-29 14:15 UTC och är
  därför inte en tillförlitlig freshness-signal.

## Mätning

Kontrollerad samma-uppgift-baseline utan Graphify saknas. Rapporten anger därför
inte påhittad procentuell tids- eller tokenbesparing.

- 71 Graphify MCP-anrop journalfördes under Goal 92–93.
- De sista 10 anropen lyckades tekniskt 10/10 och tog sammanlagt 11,8288
  sekunder server-wall-time.
- För de sista 10 var medelvärdet 1,1829 sekunder och medianen 0,8816 sekunder.
- Tre tydliga uppslag med hög nytta hittade tio tokenkonsumenter på 0,035 sekunder,
  fyra CTA-importörer på 0,049 sekunder och tolv temakonsumenter på 0,188
  sekunder.
- De sista fyra breda strukturfrågorna hittade rätt centrala Goal 92/93-noder
  4/4.
- För användarauditens tre verkliga rotorsaker som frågades i grafen
  — CSS-kaskad, dubblerad footer och append-only teardown — gav grafen rätt
  källområde 3/3 men hela rotorsaken 0/3. Källkod, browser och SQL krävdes.

Exakt faktisk tokenförbrukning går inte att mäta: Graphify MCP returnerar inte
usage-data. De angivna `token_budget`-värdena är endast tak och räknas inte som
förbrukade tokens.

## Vad grafen konkret förbättrade

- Säker projektstyrning: varje fråga gick mot exakt aktiv worktree i stället för
  en gammal standardgraf.
- Snabb blast-radius: gemensamma konsumenter för branding, CTA och
  medlemsformulär hittades på under 0,2 sekunder i de bästa mätningarna.
- Tvärdomänorientering: media, offert, settlement, refund-outbox,
  temakatalog, preview och onboarding kunde lokaliseras innan riktad källäsning.
- Databasorientering: tabeller, constraints, policies, triggers och
  migrationer kunde hittas, även när semantiken fortfarande behövde läsas i SQL.

## Vad som behöver läggas till

1. **CSS-kaskad som grafdata.** Selektorer, CSS Modules-mappning,
   media queries, specificitet, källordning, variabler och beräknad stil måste
   kunna följas till renderat element.
2. **Renderad DOM-proveniens.** Grafen behöver visa att en länk kommer både från
   en array/map och från hårdkodad JSX, inklusive duplicerat `href` och text.
3. **Test till runtime till bevis.** Playwrightfall, route, komponent,
   screenshotbaseline, Axe-fynd och regression ska vara en sammanhängande väg.
4. **TS till RPC till SQL.** Server action, PostgREST-anrop, vinnande
   funktionsversion, lästa/skrivna tabeller, lås, constraints och provider-
   callback ska kunna följas end-to-end.
5. **Triggersemantik.** `BEFORE/AFTER`, händelse, villkor, blockerad operation,
   append-only-regel och säkra teardownundantag behöver vara läsbara kanter.
6. **Migreringsordning.** Senaste vinnande funktionsdefinition och aktuell
   previewprojektion ska visas; äldre definition får inte väljas utan varning.
7. **Katalogvärden.** Inbäddade JSON-manifest, template-rader, JSONB-fält,
   route/module-referenser och selectable/deprecated/replacement ska bli
   jämförbara noder.
8. **Dirty-worktree freshness.** Visa senaste indexerade filhash, dirty-state,
   branch, commit, indexeringstid och skillnaden mellan manifest- och
   topologiuppdatering.
9. **Namnkollisioner.** Exakta uppslag ska prioritera sökväg och visa alla
   symboler med samma namn i stället för att tyst välja fel.
10. **Mättelemetri.** Varje MCP-svar bör ge latency, resultatantal,
    trunkering, faktisk output-tokenmängd, cache-hit och indexversion.
11. **Frågetäckning.** Verktyget bör förklara vilka relevanta filer eller kanter
    som saknas och varför, i stället för att bara returnera breda startnoder.
12. **Provider- och livscykelrelationer.** Redirect/unmount, webhook,
    idempotens, CAS, lease, outboxkvittens och domänfinalisering behöver egna
    semantiska kanter.

## Slutsats

Graphify gjorde fil- och blast-radiusorientering snabbare och säkrare. Den
ersatte inte källäsning eller runtimeverifiering. Störst nästa kvalitetslyft är
CSS/DOM-proveniens, tvärspråkig TS→SQL-spårning och verifierbar freshness med
faktisk usage-telemetri.
