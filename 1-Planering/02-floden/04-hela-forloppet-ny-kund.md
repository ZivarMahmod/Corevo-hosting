# HELA FÖRLOPPET — ny kund A→Ö (nuläge 2026-07-01)

> Zivars mål: gå till vem som helst och med stolthet sätta upp deras sida på 10–15 min,
> lägga den i CF, uppe med egen domän, fakturerad och allt — utan att röra kod.
> Detta dokument är SANNINGEN om var varje steg står: ✅ funkar · 🟡 funkar med manuellt steg · 🔴 saknas.

## Steg för steg

| # | Steg | Var | Status |
|---|---|---|---|
| 1 | Logga in som super-admin | `superbooking.corevo.se` | ✅ |
| 2 | Starta ny kund → 12-stegs onboarding-studio: bransch → tema (5 st) → moduler av/på → bokningsvariant → tjänster+priser → hero-text/bilder med **live-helsides-preview** | `/salonger/ny` | ✅ |
| 3 | Skapa → salong + settings + location + roller + moduler + tjänster skrivs i DB, status `active` = **publicerbar direkt**, inget separat publiceringssteg | `createTenant` | ✅ |
| 4 | Ägar-invite: mejl "Aktivera ditt konto" via egen relay → länk till `/auth/confirm` → välj lösenord → landar i sin admin | app-ägd kedja | ✅ *(byggd 2026-07-01, live-verify kvar — checklista i `5-Kod/docs/ops/auth-invite-kedjan.md`)* |
| 5 | Domän `<slug>.corevo.se` live | CF Workers Domains | 🟡 **Enda manuella steget:** `node scripts/add-domain.mjs <slug>` (attachar live + committar routen). Blir helautomatiskt när 4 CF-variabler sätts (`CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID`, `DOMAIN_AUTOATTACH_ENABLED=true`) |
| 6 | Kundens admin: dashboard, bokningar, personal, tjänster, modul-ytor (shop/blogg/offert/lojalitet/presentkort), sajtbyggare-självservice | `booking.corevo.se/admin` | ✅ |
| 7 | Efter-onboarding-redigering: sajtbyggaren (texter/bilder/färger/font/logga, live utan deploy) | `/admin/sajtbyggare` + super-admin-väg | ✅ **alla 5 teman** *(salvia-låset borttaget 2026-07-01)* |
| 8 | Kundens storefront live: tema + owner-copy + modul-sektioner per status + boka-flöde | `<slug>.corevo.se` | ✅ |
| 9 | Fakturering: 399 kr/mån, Swish-QR manuell v1 | — | 🔴 **ej byggd** (goal-39) — sista biten av "faktureras och allt" |

## Tema/mall-modellen — "inget ska vara låst"

- **Idag:** 5 native teman (salvia/leander/zigge/linnea/edit). Väljs fritt i onboarding + kan bytas. Editorn styrs av ett **manifest per tema** (`lib/sajtbyggare/manifest/`) = listan över exakt vilka fält som är redigerbara, med svenska etiketter. Tema utan manifest → fält kan inte redigeras (det var därför "bara salvia" förr — nu har alla 5 manifest).
- **Lägga till en ny mall idag** = kod-uppgift (medveten): layout-komponent + `THEME_CONTENT`-defaults + tokens-block + manifest → registrera. Plattformen är byggd så det är EN mall = EN uppsättning filer, ingen påverkan på andra.
- **Framtiden (goal-52, native mall-kit):** mallar som config ovanpå ett sektions-kit → bygga en ny mall utan att skriva en hel layout. Vendor-import-spåret (94 mallar, goal-36/50) är SKROTAT — det skapade kaos och är borta ur repot (goal-51).

## Vad som INTE får hända (spelregler)

- POS `corevo.se` + booking/superbooking/minbooking går ALDRIG ner vid deploy (domäner committade i `wrangler.jsonc`).
- Deploy = `v*`-tag → CI (`scripts/deploy-prod.mjs`). Aldrig bare `wrangler deploy` (detachar domäner).
- En bransch = 1 rad i `verticals` — ALDRIG en fork av koden.

## Kvar till "10-minuters-kunden" är HELT sann

1. **Zivars live-verify av invite-kedjan** (steg 4) — sen är loopen bevisad hel.
2. **CF-variablerna** (steg 5) → domän-steget försvinner ur listan.
3. **Fakturering** (steg 9, goal-39) — sista modulen i löftet.
4. **Editor-polish + noll döda knappar** (goal-53) — allt klickbart ska vara riktigt.
