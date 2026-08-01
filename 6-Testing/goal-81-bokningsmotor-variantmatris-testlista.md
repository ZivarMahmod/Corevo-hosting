# Goal 81 — lokal testlista

Status: **GRÖN lokalt 2026-07-24**

Miljö: branch `codex/launch-inventory-customer-design`, localhost mot
Supabase-preview `localhost-acceptance` (`cwnhpesrgolflkmyjbrm`).

- [x] `personal`/`staff` och `tjanst`/`service` följer kanonisk precedence.
- [x] Äldre slotresponse kan inte skriva över nyare val.
- [x] Platsens tidszon och `max_advance_days` äger datumfönstret.
- [x] Legacy-ombokning behåller originalplatsen.
- [x] Compact/inline validerar kontakt före PIN och använder fyra siffror.
- [x] Wizard och compact renderar mot preview på desktop.
- [x] Compact renderar utan overflow på `390 × 844`.
- [x] Full websvit, typecheck, lint, build och diff-check är gröna.

Previewkunden återställdes efter provet. Produktion lästes inte för
browseracceptansen och muterades inte.
