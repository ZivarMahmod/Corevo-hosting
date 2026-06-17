# goal-45 — Admin v2: omdesign av plattforms-admin (superbooking)

**Datum:** 2026-06-17
**Typ:** Design-först → bygg. Plattforms-admin (`superbooking.corevo.se`) ser ut som v1, ska bli v2.

## Mål
Super-admin (där Zivar skapar/styr kunder) får en sammanhållen **v2-design** — varje flik unik och genomtänkt, inga halv-äkta knappar, RBAC som lyder överallt, audit-UI, ren microcopy. Admin styr ALLA branscher (inget hårdkodat per bransch).

## Lägeskoppling
Admin-**splitten** är KLAR (goal-27 SHIPPED 2026-06-14: 3-dörrars, host-låsta cookies, `superbooking` vs `booking`). Det som saknas = **design + finslip**. Ingen v2-design finns än → därför finns inget datum på "ny admin" förrän den skrivs.

## Ordning (design-trohet — bygg ALDRIG utan design-paket, 18h-fällan)
1. **DESIGN-PASS FÖRST** (design-handoff-loop): v2-design för varje admin-yta. Inget byggs förrän paketet finns.
2. **Bygg per design** + fold in admin-finslipen:
   - FINSLIP #63 — flik-för-flik (varje flik unik/perfekt, sammanhållen)
   - #31 — RBAC enforce (lyder bara Branding-save idag → överallt)
   - #44 — audit-logg-UI (Zivars tvärs-vy + salongens egen)
   - #8 / #9 — export-knapp + notis-bell/⌘K (äkta, ej skal)
   - #62 — flytta plattform-login off `booking.corevo.se` → egen subdomän
   - #64 — microcopy-svep (tooltips, tomma states)
3. **Verify:** varje yta mot design-kanon (mekaniskt, 0 ögonmått), RBAC live-testad.

## Beslut som behövs (Zivar)
- **Design-källa:** ska Claude Design ta fram v2-paketet, eller finns en riktning/referens du vill ge?

## Anti-patterns
- Bygg INTE admin-v2 utan design-paket (design-trohet).
- Hårdkoda inget per bransch — admin är universell (NASA → liten butik).

## Rollback
Bygget sker bakom flagga/egen branch; admin-split (goal-27) rörs ej. Design-pass = inga kod-ändringar.
