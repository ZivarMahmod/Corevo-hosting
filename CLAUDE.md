# CLAUDE.md — Corevo Booking

Projekt-instruktioner för Claude (Code + Cowork). Nuläge + status bor i **`HANDOFF.md`** (läs den först för var bygget står). Den här filen styr HUR vi jobbar i repot — särskilt var filer ska ligga.

## ⛔ FILPLACERING — ingen dumpning i roten
**Nya filer skrivs i rätt mapp enligt strukturen nedan. ALDRIG i repo-roten.**
Roten får BARA innehålla: `HANDOFF.md` (ingång/status), `CLAUDE.md` (denna), samt config som måste ligga där (`.gitignore`, `.mcp.json` osv).
Allt annat — planering, doc, ops-referens, research, kod — går i sin mapp. Är du osäker → fråga, lägg inte i roten.

## ⛔ DESIGN-TROHET — exakt kopia, aldrig improvisera (lärt dyrt: 18h brände)
När uppgiften rör design/UI och underlaget är ett **Claude Design-paket** (bor i `4-Dokument-Underlag/01-acceptans/`, flyttat från 2-Byggplan 2026-06-07): **paketet = LAG. Live ska bli en EXAKT kopia av filerna — inget annat.** Aldrig "inspirerad av", aldrig egna idéer, aldrig improvisera, aldrig re-härleda värden (lyft exakta px/hex/font ur kanon).
- **LÄS HELA paketet noga FÖRST** (varje `.jsx`/`.css`/`.html`/spec/mock). 18h förlorades för att Code inte orkade läsa design-mappen och hittade på — underlaget var ALDRIG felet.
- **"Klar" = mekaniskt 0 FAIL** via `acceptans/<sida>/*.accept.spec.ts` + `probe.js`. Aldrig ögonmått — "känns nära" ÄR buggen (→ 62%).
- **Oberoende verify** — byggaren rättar inte sin egen läxa.
- **IGNORERA OLD-mappar** (`corevo-booking-design-system v3/`, `Tillfällig map struktur/`). Root-paketet vinner alla konflikter.

## Mappstruktur — var saker hör hemma
| Innehåll | Plats |
|---|---|
| Planering, arkitektur, DB-schema, ADR, modulkartor, nuläge (infra/cloudflare) | `1-Planering/` |
| Roadmap, exekveringsplan | `2-Byggplan/` |
| Goals (mål) — ej klara | `2-Byggplan/goals/goal-NN-*.md` |
| Goals — verifierade klara | `2-Byggplan/klart/<kategori>/` — kategorier i `klart/0-LÄS-MIG-FÖRST.md` |
| Bakgrund / research | `3-Bakgrund-Research/` |
| Underlagsdokument | `4-Dokument-Underlag/` |
| All kod | `5-Kod/` |
| Teknisk dokumentation (kod) | `5-Kod/docs/` |
| Drift / ops / runbooks / inloggnings-referens | `5-Kod/docs/ops/` |
| Källunderlag (PDF:er m.m.) | `Nörden/` |

## Placeringsregler i klartext
- En **goal/brief** → `2-Byggplan/goals/`. När den verifierats KLAR → flytta till rätt kategori i `2-Byggplan/klart/` (fixar → `08-fixar/`; se `klart/0-LÄS-MIG-FÖRST.md`).
- En **ops/deploy/drift-referens** (runbook, inloggningar, secrets-inventering) → `5-Kod/docs/ops/`.
- **Planeringsbeslut, arkitektur, scheman** → `1-Planering/`.
- **Kod-doc** (API, moduler) → `5-Kod/docs/`.
- Skapar du en fil och tvekar om mappen → välj närmaste enligt tabellen, lägg den ALDRIG i roten.

## Övrigt
- Projektets hårda regler (POS-guardrail på corevo.se, `private.tenant_id()`, `staff`/`staff_id`, build-once-never-delete, en goal i taget → verifiera → `_klart/`) ligger i `HANDOFF.md`. Följ dem.
