# 0 — LÄS MIG FÖRST

Projektmapp för **Corevo Booking Platform** (arbetsnamn: corevoboking). Börja här.

## Vad det är

Multi-tenant, white-label boknings- & kundplattform för salonger. Freshcut = första kund. Byggs som plattform från dag 1, inte som en sajt åt en kund. Plus: ombyggd Corevo **marketing-sajt** planeras parallellt (egen plan).

Stack: Next.js · Supabase (Postgres + Auth) · Cloudflare · Stripe Connect.

## Var saker bor

| Mapp | Innehåll |
|---|---|
| `1-Planering/` | VAD byggs — modulkarta, DB-schema, ADR, modulplaner, marketing-plan |
| `2-Byggplan/` | HUR — roadmap + numrerade goal-briefs för Claude Code (parallella spår) |
| `3-Bakgrund-Research/` | Verifierad teknik-research |
| `4-Dokument-Underlag/` | Råunderlag |
| `5-Kod/` | Koden — eget revir, egen git. Tom tills första goal körs. |
| `Nörden/` | Källan: 14 PDF:er + `00-FILKARTA.md` (vilken PDF är vad) |

## Ingångar (läs i ordning)

1. `1-Planering/00-modulkarta.md` — hela plattformen på en sida
2. `1-Planering/ADR/01-tenant-och-tema-arkitektur.md` — hur multi-tenant + tema funkar
3. `1-Planering/02-onboarding-flode.md` — hur ny kund kommer in
4. `1-Planering/03-pengaflode-stripe.md` — pengarna
5. `2-Byggplan/00-roadmap.md` — byggsekvensen för Code

## Beslut (spikade)

- En kodbas, multi-tenant. Ny kund = ny tenant + config, ALDRIG ny template.
- Funktioner identiska för alla. Bara utseende varierar (3-nivå tema: config → layout-variant → custom CSS).
- Auth: Supabase Auth + egna tabeller, tenant_id som JWT-claim.
- Pengar: Stripe Connect Express, direct charges. Kund betalar service-avgift, splittas auto. Avgift konfig per tenant (fast kr el. %).
- Onboarding i Platform Admin (M7): skapa tenant → branding → Stripe → domän → lansera.

## Status

🟢 Planering spikad. 6 modulplaner, DB-schema, 3 besluts-dok, 11 goal-briefs (härdade mot besluten), marketing-plan. DB tom + kopplad. Redo att köra G01 (scaffold) när du säger till.
