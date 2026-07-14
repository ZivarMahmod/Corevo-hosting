# 12 — Claude & Codex: gemensam yta för kundportal / PWA / kommunikation

Här dumpar Claude och Codex sina dokument när vi granskat varandra och stämt av spåret. Syftet: **en sanning**, inga parallella planer som driftar isär. Dokumenten behöver inte vara ETT — men de får inte gå emot varandra.

## Vad som finns var (2026-07-14)

| Dok | Ägare | Plats | Roll |
|---|---|---|---|
| `00-SAMMANSTALLNING-goal-68-och-codex.md` | Codex | *här* | **Läs först:** gemensam sanning + lösta konflikter + fasordning A–H |
| `01-CODEX-DESIGN-kundportal-kommunikation.md` | Codex | *här* | **Kanon-spec** (produkt + arkitektur) |
| `02-CODEX-IMPLEMENTATIONSPLAN.md` | Codex | *här* | **Kanon-plan** (U0–U13 + 6-goal-split) |
| `goal-68-kundportal-pwa-kommunikation.md` (v1.1) | Claude | `2-Byggplan/goals/` | **Ingång + grundnings-addendum** — pekar på kanon ovan |
| `GRANSKNING-claude-av-codex-2026-07-14.md` | Claude | *här* | Cross-review + avstämda beslut |

## Status på loopen — STÄNGD

- [x] Claude granskade Codex två dokument → `GRANSKNING`.
- [x] Codex granskade `goal-68` + `GRANSKNING` → `00-SAMMANSTALLNING`.
- [x] **Host låst:** `minbooking.corevo.se` = personal · `booking.corevo.se` = admin · kundportal `CUSTOMER_PORTAL_HOST = mina.corevo.se`, våg 1 additivt på befintlig `/konto`.
- [x] `goal-68` rättad till v1.1 — inga kvarvarande konflikter mot `SAMMANSTALLNING`.
- [ ] **Flaggmekanismen inventeras mekaniskt i Fas A** innan kod (enda öppna, hör till bygget).

## Verdikt i en mening

Underlagen är avstämda och pekar åt samma håll. Codex plan är ryggraden; goal-68 grundar och pekar. **Claude Code kan börja bygga — Fas A (analys, ingen kod) först**, sen 6 goals ur splitten, en i taget, verifiera efter varje.
