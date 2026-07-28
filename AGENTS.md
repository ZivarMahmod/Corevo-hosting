# AGENTS.md — Corevo (multi-bransch-plattform)

Corevo är en GENERELL multi-bransch-plattform — EN motor/DB/kodbas som bygger sidor + verkliga moduler (bokning, webshop, offert, fordon, lojalitet, blogg, presentkort …) åt **vilken bransch som helst**, med mallar och moduler som slås på/av per kund. Frisör är bara EN bransch bland flera, aldrig projektets definition. Kanon för produkten = `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.

Projekt-instruktioner för Codex (Code + Cowork). Nuläge + status bor i **`HANDOFF.md`** (läs den först för var bygget står). Den här filen styr HUR vi jobbar i repot — särskilt var filer ska ligga.

## ⛔ FILPLACERING — ingen dumpning i roten
**Nya filer skrivs i rätt mapp enligt strukturen nedan. ALDRIG i repo-roten.**
Roten får BARA innehålla: `HANDOFF.md` (ingång/status), `AGENTS.md` (denna), `MAPPSTRUKTUR.md` (full mappguide + beslutsträd), samt config som måste ligga där (`.gitignore`, `.mcp.json` osv).
Allt annat — planering, doc, ops-referens, research, kod — går i sin mapp. Är du osäker → fråga, lägg inte i roten.

## ⛔ DESIGN-TROHET — exakt kopia, aldrig improvisera (lärt dyrt: 18h brände)
När uppgiften rör design/UI och underlaget är ett **Codex Design-paket** (bor i `4-Dokument-Underlag/01-acceptans/`, flyttat från 2-Byggplan 2026-06-07): **paketet = LAG. Live ska bli en EXAKT kopia av filerna — inget annat.** Aldrig "inspirerad av", aldrig egna idéer, aldrig improvisera, aldrig re-härleda värden (lyft exakta px/hex/font ur kanon).
- **LÄS HELA paketet noga FÖRST** (varje `.jsx`/`.css`/`.html`/spec/mock). 18h förlorades för att Code inte orkade läsa design-mappen och hittade på — underlaget var ALDRIG felet.
- **"Klar" = mekaniskt 0 FAIL** via `acceptans/<sida>/*.accept.spec.ts` + `probe.js`. Aldrig ögonmått — "känns nära" ÄR buggen (→ 62%).
- **Oberoende verify** — byggaren rättar inte sin egen läxa.
- **IGNORERA OLD-mappar** (`corevo-booking-design-system v3/`, `Tillfällig map struktur/`). Root-paketet vinner alla konflikter.

## RYTMEN — flödet ett bygge följer (lag)
**Research (`3`) → beslut/plan för delen (`1`, egen mapp per del) → underlag som matar bygget (`4`) → mål/goal (`2-Byggplan/goals/`) → kod (`5`) → Zivars test (`6`) → verifierat klart (`2-Byggplan/klart/`)**
Ny del planeras → ny mapp `1-Planering/0N-<delen>/`. Planering för en specifik del bor IHOP i sin mapp — aldrig löst i 1-roten.

## Mappstruktur — var saker hör hemma
| Innehåll | Plats |
|---|---|
| Planering/beslut. Roten = bara `00-modulkarta.md` (ingången). Tvärgående arkitektur (DB-schema, ADR, domänstrategi, infra-nuläge) → `01-arkitektur/` · flöden (onboarding, pengaflöde) → `02-floden/` · per del → `0N-<delen>/` (t.ex. `03-avbokning/`) | `1-Planering/` |
| Roadmap, exekveringsplan | `2-Byggplan/` |
| Goals (mål) — ej klara | `2-Byggplan/goals/goal-NN-*.md` |
| Goals — verifierade klara | `2-Byggplan/klart/<kategori>/` — kategorier i `klart/0-LÄS-MIG-FÖRST.md` |
| Bakgrund / research | `3-Bakgrund-Research/` |
| Underlagsdokument | `4-Dokument-Underlag/` |
| All kod | `5-Kod/` |
| Testlistor, manuella tester, sånt ZIVAR ska köra/utföra | `6-Testing/` |
| Teknisk dokumentation (kod) | `5-Kod/docs/` |
| Drift / ops / runbooks / inloggnings-referens | `5-Kod/docs/ops/` |
| Källunderlag (PDF:er m.m.) | `Nörden/` |

## Placeringsregler i klartext
- En **goal/brief** → `2-Byggplan/goals/`. När den verifierats KLAR → flytta till rätt kategori i `2-Byggplan/klart/` (fixar → `08-fixar/`; se `klart/0-LÄS-MIG-FÖRST.md`).
- En **ops/deploy/drift-referens** (runbook, inloggningar, secrets-inventering) → `5-Kod/docs/ops/`.
- **Planeringsbeslut, arkitektur, scheman** → `1-Planering/`.
- **Kod-doc** (API, moduler) → `5-Kod/docs/`.
- **Testlista / manuellt test som Zivar ska utföra** → `6-Testing/`. Körda workflow-/plandokument = historik → `2-Byggplan/klart/07-workflows-faser/`.
- Skapar du en fil och tvekar om mappen → välj närmaste enligt tabellen, lägg den ALDRIG i roten.

## Övrigt
- Projektets hårda regler (POS-guardrail på corevo.se, `private.tenant_id()`, `staff`/`staff_id`, build-once-never-delete, en goal i taget → verifiera → `_klart/`) ligger i `HANDOFF.md`. Följ dem.
- Lokal Open Design finns på `http://localhost:7456/` och får användas vid framtida designarbete. När ett Codex Design-acceptanspaket finns är paketet fortfarande kanon och Open Design är ett arbetsverktyg, inte en ersättande specifikation.

## Graphify
- Den lokala kodgrafen för denna worktree finns i `5-Kod/graphify-out/graph.json`. Skapa aldrig en extra `graphify-out/` i repo-roten.
- Open Design-klonen i `4-Dokument-Underlag/08-externa-verktyg/open-design/` är en Git-ignorerad och skrivskyddad referens i arbetssättet. Ändra aldrig dess filer från Corevo-arbetet.
- Dess separata, genererade referensgraf finns i `5-Kod/graphify-references/open-design/` och uppdateras med `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-open-design.ps1` från `5-Kod/`.
- Vid arbetsstart: kör `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-live.ps1` från `5-Kod/`. Kommandot är idempotent och startar watchern, grafvyerna samt de två lokala MCP-servrarna. Zivar Graph Studio finns på `http://127.0.0.1:8768/`.
- Vid frågor om kodbasen: använd MCP-servern `graphify-corevo` med explicit `project="corevo"` när den finns. Annars kör `graphify query`, `graphify path` eller `graphify explain` från `5-Kod/` innan bred filsökning. Översätt svenska frågor till termer som faktiskt finns i grafen.
- För Open Design-frågor används samma MCP-server med `project="open-design"`; starta aldrig en andra MCP-server. Använd `query_projects` med båda ID:na endast när uppgiften faktiskt är en jämförelse.
- Före grafarbete: kör `graphify reflect --if-stale` från `5-Kod/` och använd `graphify-out/reflections/LESSONS.md` om den finns.
- Watchern samlar verkliga kodändringar i vågor och uppdaterar `graph.json`, `graph.html` och MCP-underlaget utan LLM/API-kostnad. Om watchern varit avstängd: kör `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-update-changed.ps1` från `5-Kod/`.
- Kör `graphify update .` efter branchbyte eller om ändringarna redan har committats; använd `--force` bara efter avsiktliga större borttagningar/refaktoreringar när grafens shrink-guard stoppar uppdateringen.
- Grafen hjälper till att hitta rätt flöde och beroenden; verifiera alltid ändringen mot de verkliga källfilerna och testerna.
- `zivar-graph-studio` på `http://127.0.0.1:8767/mcp` styr desktop- och localhostvyn samt registrerar strukturell agentaktivitet. Använd `studio_focus` när en relevant nod eller fil öppnas, `studio_set_view` för en riktad vy och `studio_record_change` eller `studio_record_error` efter utfört arbete. Skicka aldrig prompts, dolda resonemang, hemligheter eller kunddata till aktivitetslagret.
