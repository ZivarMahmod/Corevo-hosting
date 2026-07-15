# 12 — Claude & Codex: gemensam yta för kundportal / PWA / kommunikation

Här dumpar Claude och Codex sina dokument när vi granskat varandra och stämt av spåret. Syftet: **en sanning**, inga parallella planer som driftar isär. Dokumenten behöver inte vara ETT — men de får inte gå emot varandra.

## Vad som finns var (2026-07-14)

| Dok | Ägare | Plats | Roll |
|---|---|---|---|
| `00-SAMMANSTALLNING-goal-68-och-codex.md` | Codex | *här* | **Läs först:** gemensam sanning + lösta konflikter + fasordning A–H |
| `01-CODEX-DESIGN-kundportal-kommunikation.md` | Codex | *här* | **Kanon-spec** (produkt + arkitektur) |
| `02-CODEX-IMPLEMENTATIONSPLAN.md` | Codex | *här* | **Kanon-plan** (U0–U13 + verifierbara arbetsenheter) |
| `03-EXEKVERINGSROADMAP-goal-68.md` | Codex | *här* | **Körordning + test-/bevisgrindar** för 68.0–68.5 |
| `goal-68-kundportal-pwa-kommunikation.md` (v3.0) | Codex | `2-Byggplan/goals/` | **Program-master/index, inte en mega-goal** |
| `GRANSKNING-claude-av-codex-2026-07-14.md` | Claude | *här* | Cross-review + avstämda beslut |

## Status på loopen — STÄNGD

- [x] Claude granskade Codex två dokument → `GRANSKNING`.
- [x] Codex granskade `goal-68` + `GRANSKNING` → `00-SAMMANSTALLNING`.
- [x] **Host låst:** `minbooking.corevo.se` = personal · `booking.corevo.se` = admin · kundportal `CUSTOMER_PORTAL_HOST = mina.corevo.se`, våg 1 additivt på befintlig `/konto`.
- [x] `goal-68` omgjord till program-master v3.0 med sex verifierbara leveransvågor.
- [ ] **Entry gate:** Goal 67 verifieras och flyttas till `klart/` innan 68.0 aktiveras.
- [ ] **68.0/U0** inventerar mekaniskt flaggmekanism, atomisk outbox, ombokning, token, preview/staging och UI-underlag innan produktkod.

## Verdikt i en mening

Teknikriktningen är avstämd, men bygget startar inte som ett enda autonomt mål. **Efter att Goal 67 stängts körs 68.0/U0 (analys, ingen produktkod), därefter 68.1–68.5 en i taget med oberoende bevisgrind.** Riktig SMS-provider är en separat senare goal.
