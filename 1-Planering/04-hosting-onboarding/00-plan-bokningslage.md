# 04 — Hosting & onboarding: boknings-läge per salong

**Status:** plan låst 2026-06-14 (Cowork, Zivar + Nörden). Briefs ej skrivna än.
**Ingång:** denna fil. Hör ihop med `01-arkitektur/` (DB-schema) + `02-floden/` (onboarding).

## Bakgrund (varför)
Zivar hostar salongssidor åt kunder. Två kundtyper:
1. Kunden vill använda **Bokadirekt** (extern bokning) — Zivar hostar bara *sidan*, har inget bokningsansvar.
2. Kunden ska ha **full Corevo-bokning** byggd av Zivar.

Betalningar är **PAUSADE** — fokus är att hela boknings-/hostingdelen sitter.

## Låsta beslut
- **B1 — Unified-modell:** *varje* hostad sida = en **Corevo-tenant**, renderad av plattformen med valt tema. Ingen separat statisk-hosting-väg. (Build once, toggle per kund — röd tråd.)
- **B2 — Bygg-ordning:** boknings-läge + admin-kontroll **först** (med de 5 befintliga temana). Template-konvertering = **eget löpande spår** vid sidan av, ej steg 1.
- **B3 — Orthogonalitet:** *tema* (utseende) och *boknings-läge* (vad boka-knappen gör) är **två oberoende fält**. Vilken template som helst kan köra extern länk ELLER full bokning.
- **B4 — Flippbart:** en kund kan börja på extern länk och senare flippas till full Corevo-bokning **utan att byta sida** (samma tenant, ändra ett fält).

## Fält-design (per tenant, i `tenant_settings.settings` jsonb — INGEN migration)
- `settings.theme` — **finns redan** (enum: leander | salvia | zigge | linnea | edit), validerad via `pickTheme()`.
- `settings.booking.engine` — **NY**: `'corevo' | 'external'`. Default `'corevo'` (legacy-säker).
  - ⚠️ Namnkollision: `readBookingMode()` finns redan och betyder wizard/compact → använd nyckeln **`engine`**, inte `mode`.
- `settings.booking.external_url` — **NY**: text (t.ex. Bokadirekt-URL). Krävs + valideras när `engine='external'`.
- `settings.booking.variant` — finns redan (wizard/compact/drawer/inline) = presentation av *interna* flödet. Orört.

## Chokepoints (exakta filer — från kodkartan 2026-06-14)
- **Onboarding-action:** `5-Kod/apps/web/lib/platform/actions.ts` → `createTenant` (rad ~52–255). Trådar redan `fd.get('theme')` + `fd.get('booking_variant')` → lägg till `engine` + `external_url`.
- **Onboarding-UI:** `app/(platform)/salonger/ny/page.tsx` + `components/platform/CreateTenantForm.tsx` (har redan temaväljare).
- **Boka-knapp (strömbrytaren):** `components/brand/BookCta.tsx` — om `engine='external'` → `<a href={external_url}>`, annars nuvarande drawer/`/boka`.
- **Andra ingång:** `components/storefront/Bookable.tsx:34` gör `router.push('/boka')` direkt → behöver samma extern-gren.
- **Reader-mönster att kopiera:** `lib/platform/booking-variant.ts` (read/default/legacy-map-seam).
- **Tema-registry:** `components/storefront/layouts/index.ts` + tokens `packages/ui/tokens.css:189-249`.
- **DB-tabeller:** `5-Kod/supabase/migrations/0001_core_schema.sql` (`tenants`, `tenant_settings`, `tenant_domains`). OBS: `tenant_domains` = salongens EGEN domän (0019-resolve), **inte** Bokadirekt-länken — blanda ej.

## Goal-breakdown (steg 1)
### Goal A — Boknings-läge per salong
DB-fält (jsonb) → reader-modul → onboarding-val (Corevo / Extern + URL) → BookCta + Bookable villkorlig → URL-validering. Migration-fri. Låg risk.

### Goal B — Admin-kontroll
Plattform-admin (salonger lista + detalj): visa per tenant boknings-läge + tema + extern-URL; kunna **ändra** dem efter onboarding (inte bara vid skapande).

## Template-spår (parkerat — eget spår, ej steg 1)
12 råa tredjeparts-HTML-mallar i `4-Dokument-Underlag/03-template-katalog/` (BarberX, alotan, barberz, base, brber, carserv, haircare, hairsal, materio, razor, Free.Bundle, + screenshots). `01-kandidater`/`02-valda` tomma — inget granskat. Att göra en valbar = bygga om till React-tema (layout + token-block + registry). **Licenskoll FÖRST** (KATALOG.md). En i taget.

## Första skarpa fall: Tofi
Tofi vill Bokadirekt, Zivar bygger/hostar allt. → tenant + tema + `engine='external'` + Bokadirekt-URL. Material finns i extern mapp `Tofis hemida/Fris-ren/` (statisk HTML) + projektträd `Tofifi-Cut-and-Trim/`. Hans befintliga HTML byggs/uttrycks som ett Corevo-tema (per B1).

## Öppna frågor
- **Ö1 — "hostas av mig"-markör:** i unified-modellen är ALLA tenants hostade av Zivar. Täcker `engine='external'` redan behovet "lågt underhåll, bara länk"? Eller vill Zivar ha en separat `managed_by_platform`-flagga för att skilja självservice vs Zivar-byggt? (Lutar: booking_engine räcker tills vidare.)
- **Ö2:** ska extern länk öppna i ny flik? (target=_blank + rel) — default ja.
