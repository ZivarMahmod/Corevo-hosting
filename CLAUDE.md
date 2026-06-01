# CLAUDE.md — Corevo Booking

Projekt-instruktioner för Claude (Code + Cowork). Nuläge + status bor i **`HANDOFF.md`** (läs den först för var bygget står). Den här filen styr HUR vi jobbar i repot — särskilt var filer ska ligga.

## ⛔ FILPLACERING — ingen dumpning i roten
**Nya filer skrivs i rätt mapp enligt strukturen nedan. ALDRIG i repo-roten.**
Roten får BARA innehålla: `HANDOFF.md` (ingång/status), `CLAUDE.md` (denna), samt config som måste ligga där (`.gitignore`, `.mcp.json` osv).
Allt annat — planering, doc, ops-referens, research, kod — går i sin mapp. Är du osäker → fråga, lägg inte i roten.

## Mappstruktur — var saker hör hemma
| Innehåll | Plats |
|---|---|
| Planering, arkitektur, DB-schema, ADR, modulkartor, nuläge (infra/cloudflare) | `1-Planering/` |
| Roadmap, exekveringsplan | `2-Byggplan/` |
| Goals (mål) — ej klara | `2-Byggplan/goals/goal-NN-*.md` |
| Goals — verifierade klara | `2-Byggplan/goals/_klart/` |
| Bakgrund / research | `3-Bakgrund-Research/` |
| Underlagsdokument | `4-Dokument-Underlag/` |
| All kod | `5-Kod/` |
| Teknisk dokumentation (kod) | `5-Kod/docs/` |
| Drift / ops / runbooks / inloggnings-referens | `5-Kod/docs/ops/` |
| Källunderlag (PDF:er m.m.) | `Nörden/` |

## Placeringsregler i klartext
- En **goal/brief** → `2-Byggplan/goals/`. När den verifierats KLAR → flytta till `2-Byggplan/goals/_klart/`.
- En **ops/deploy/drift-referens** (runbook, inloggningar, secrets-inventering) → `5-Kod/docs/ops/`.
- **Planeringsbeslut, arkitektur, scheman** → `1-Planering/`.
- **Kod-doc** (API, moduler) → `5-Kod/docs/`.
- Skapar du en fil och tvekar om mappen → välj närmaste enligt tabellen, lägg den ALDRIG i roten.

## Övrigt
- Projektets hårda regler (POS-guardrail på corevo.se, `private.tenant_id()`, `staff`/`staff_id`, build-once-never-delete, en goal i taget → verifiera → `_klart/`) ligger i `HANDOFF.md`. Följ dem.
