## Goal 03 — Publik webbplats (white-label) M2

> ⛔ **DOMÄN-SPÄRR:** Tenants kör LIVE på `*.corevo.se` (frisor1.corevo.se, frisor2.corevo.se …), admin/plattform på `booking.corevo.se`. Wildcard `*.corevo.se` → plattform-Workern (Cloudflare). corevo.se = goto under bygget. INGEN riktig kunddomän, INGEN CNAME på kundnamn förrän Zivar godkänner. localhost (frisor1.localhost:3000 / `?tenant=`) OK för dev.

**Spår:** A · **Beror på:** G02 · **Modul:** M2 (Publik webbplats)

> **Synkad mot ADR 01 (tema-lager 3 nivåer).** Funktionaliteten är ALLTID identisk för alla tenants — bara utseende/layout varierar. Tema är config-drivet via CSS-variabler (design tokens), läst server-side. Inga kund-specifika komponenter för ~90 %.

**Mål:** Bygg den publika, white-label salongssajten som besökare ser per tenant — startsida, tjänstelista, om-sida, kontakt — med tenant-tema (logo/färg/typsnitt + layout-variant + ev. custom-override) hämtat från `tenant_settings`, och CTA som leder in i bokningsmotorn (M3).

**Kontext:** G01 (scaffold) + G02 (DB/RLS, `tenants`, `services`) klara. `lib/tenant.ts` har en `getTenantFromHost`-stub. `database.types.ts` finns.

**Omfattning (bygg detta):**
- Tenant-resolver färdig: `lib/tenant.ts` parsar host-subdomän → tenant-rad (slug). Caching. **Tenants nås via `frisorN.corevo.se`** (`frisor1.corevo.se` → slug `frisor1` → tenant). Reserverade subdomäner (`booking`/`admin`/`app`/`www`/`api`) matchar ALDRIG en tenant. Lokalt via subdomän-på-localhost (`frisor1.localhost:3000`) ELLER fallback `?tenant=frisor1`/`/t/frisor1`. `custom_domain`-kolumnen får LÄSAS/matchas i koden men ingen riktig kunddomän pekas/aktiveras (DOMÄN-SPÄRR — det är G08, spärrat).
- Publika routes (Server Components):
  - `/` startsida: hero, varumärke från tenant (logo, primary_color), kort om salongen.
  - `/tjanster` lista över `services` (namn, varaktighet, pris) för tenant.
  - `/om` och `/kontakt` statiska/CMS-lätta sektioner från tenant-data.
- **Tema-lager (ADR 01, 3 nivåer) — bygg alla tre:**
  - **Nivå 1 (config):** läs `tenant_settings.branding` server-side (RSC) → injicera som CSS-variabler på layout-wrapper (`--color-primary`, `--font-body`, `logo_url` i header). Komponenter refererar bara variablerna. Täcker ~90 %.
  - **Nivå 2 (layout-variant):** läs `tenant_settings.settings.layout` (t.ex. `nav_variant`, `hero_variant`) → ett val-ställe per slot mappar variant → komponent (`A → <NavA/>`, `B → <NavB/>`). Alla varianter finns i kodbasen; tenant väljer bara. Inga utspridda if-satser.
  - **Nivå 3 (custom-override):** om `settings.custom_override` är satt → ladda villkorligt (server-side) en tenant-isolerad CSS/komponent-override. **All custom-CSS scopas under `[data-tenant="<id>"]`** (sätt `data-tenant` på wrapper) så den fysiskt inte kan läcka till andra tenants. Andra tenants får aldrig ens filen. Additivt ovanpå nivå 1+2, aldrig en gren.
- White-label hårt krav: ingen Corevo-branding på tenant-sidor.
- "Boka tid"-CTA → länkar till bokningsmotorns entry (G04 route, t.ex. `/boka`).
- SEO-grund: per-tenant `<title>`/meta från tenant-namn, OpenGraph.
- Responsiv layout + grundläggande a11y.
- 404/okänd-tenant-sida.

**Utanför scope:**
- Själva bokningsflödet (G04).
- Inloggning/portaler.
- Bilduppladdning/CMS-redigering (det sköts i Salon Admin G07).
- **Att peka/aktivera en riktig kunddomän eller skapa CNAME/custom hostname på kundnamn** — spärrat, hör till G08 och körs INTE förrän Zivar godkänner. Tenants körs här på `*.corevo.se`-subdomäner + localhost för dev.

**Berörda områden/filer:** `5-Kod/app/(public)/`, `5-Kod/lib/tenant.ts`, `5-Kod/components/brand/`, `5-Kod/app/(public)/tjanster/`, `5-Kod/app/(public)/om/`, `5-Kod/app/(public)/kontakt/`.

**Steg:**
1. Implementera `getTenantFromHost` mot `tenants` (subdomän-parse: strippa `ROOT_DOMAIN`=corevo.se → slug; reserverade subdomäner exkluderas; `frisorN.corevo.se` live + `frisorN.localhost:3000` dev + fallback `?tenant=`/`/t/`; `custom_domain` matchas i kod men aktiveras ej), med cache (`unstable_cache`/revalidate).
2. Skapa public layout som laddar tenant + `tenant_settings` och: (a) sätter CSS-variabler från `branding` (nivå 1) + logo, (b) väljer layout-komponenter från `settings.layout` (nivå 2), (c) villkorligt injicerar scopad custom-override `[data-tenant]` om `settings.custom_override` satt (nivå 3).
3. Bygg `/`, `/tjanster`, `/om`, `/kontakt` som Server Components som läser tenant-scopad data (anon-klient, RLS skyddar).
4. Lägg "Boka tid"-CTA mot `/boka`.
5. Lägg per-tenant metadata (`generateMetadata`).
6. Okänd-tenant → 404.
7. `pnpm build` + lint.

**Verifieras (DoD):**
- **Nivå 1:** Två olika tenants visar olika logo/färg/typsnitt på samma kodbas (CSS-variabler från `branding`).
- **Nivå 2:** En tenant med annan `settings.layout` (t.ex. `nav_variant=B`) renderar annan layout-variant — utan kodändring, bara data.
- **Nivå 3:** En tenant med `custom_override` får sin scopade CSS (`[data-tenant]`) applicerad; en annan tenant på samma kodbas påverkas INTE (override läcker ej).
- **Funktionalitet identisk:** alla tenants har samma sidor/CTA/flöde — bara utseende skiljer.
- `/tjanster` listar endast den aktuella tenantens tjänster (RLS-bevis).
- Okänd subdomän ger 404; reserverad subdomän (`booking`/`admin`/…) löser INTE till tenant.
- **Resolver bevisad med två olika subdomäner:** `frisor1.corevo.se` vs `frisor2.corevo.se` ger två olika tenants på samma kodbas (lokalt `frisor1.localhost:3000` vs `frisor2.localhost:3000` eller `?tenant=`/`/t/`) — ingen CNAME på kundnamn inblandad.
- Lighthouse-grund OK (mobil), inga konsolfel.
- `pnpm build` grön.

**Tekniska noter:**
- Använd anon-klienten (RLS-skyddad) för publika queries; sätt tenant-kontext via host-resolver, inte via inloggning.
- **Host-resolution via subdomän-parse:** `request.headers.get('host')` ger `frisor1.corevo.se` live (och `frisor1.localhost:3000` på dev — subdomän-på-localhost funkar i Chrome/Edge utan hosts-fil-pyssel). Strippa `NEXT_PUBLIC_ROOT_DOMAIN` (corevo.se) → slug; kolla slug mot reserverade subdomäner (`booking`/`admin`/`app`/`www`/`api`) → ej tenant; om ingen subdomän, läs fallback `?tenant=`/`/t/<slug>` (dev). NB: Next.js 16 = `proxy.ts`/`proxy()` istället för `middleware.ts` — följ scaffold-versionen.
- **DOMÄN-SPÄRR (hård regel):** ingen CNAME på kundnamn, ingen Cloudflare custom hostname, ingen riktig kunddomän aktiveras i G03. Tenants körs på `*.corevo.se`-subdomäner. `custom_domain` får matchas men pekas/provisioneras INTE förrän Zivar godkänner.
- För att RLS ska tillåta anonym läsning av publika tabeller (services för en tenant) — antingen public read-policy på `services`/`tenants` ELLER hämta via en server-side query med begränsad scope. Välj public-read-policy scoped på `tenant.status='active'`.
- CSS-variabler sätts inline på wrapper (server-side, RSC) från `tenant_settings.branding` för att undvika flash. Sätt även `data-tenant="<id>"` på wrappern (krävs för nivå 3-scoping).
- Nivå 2: ett enda val-ställe per komponent-slot (feature-flag-stil), aldrig utspridda if-satser. Ny variant = ny komponent + nytt giltigt värde, för alla.
- Nivå 3: custom laddas BARA när `settings.custom_override` satt; all custom-CSS måste scopas `[data-tenant="<id>"]` — annars läcker den till andra tenants (hård regel).
- White-label hårt krav: ingen "Corevo"-text/logo på tenant-publika sidor.
