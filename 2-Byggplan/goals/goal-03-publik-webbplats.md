## Goal 03 — Publik webbplats (white-label) M2

**Spår:** A · **Beror på:** G02 · **Modul:** M2 (Publik webbplats)

**Mål:** Bygg den publika, white-label salongssajten som besökare ser per tenant — startsida, tjänstelista, om-sida, kontakt — med tenant-tema (logo/färg) hämtat från DB, och CTA som leder in i bokningsmotorn (M3).

**Kontext:** G01 (scaffold) + G02 (DB/RLS, `tenants`, `services`) klara. `lib/tenant.ts` har en `getTenantFromHost`-stub. `database.types.ts` finns.

**Omfattning (bygg detta):**
- Tenant-resolver färdig: `lib/tenant.ts` mappar host (subdomän `salong.corevo.app` eller custom_domain) → tenant-rad. Caching.
- Publika routes (Server Components):
  - `/` startsida: hero, varumärke från tenant (logo, primary_color), kort om salongen.
  - `/tjanster` lista över `services` (namn, varaktighet, pris) för tenant.
  - `/om` och `/kontakt` statiska/CMS-lätta sektioner från tenant-data.
- White-label-lager: tema injiceras via CSS-variabler (`--brand-primary`) från tenant.brand; logo i header; ingen Corevo-branding på tenant-sidor.
- "Boka tid"-CTA → länkar till bokningsmotorns entry (G04 route, t.ex. `/boka`).
- SEO-grund: per-tenant `<title>`/meta från tenant-namn, OpenGraph.
- Responsiv layout + grundläggande a11y.
- 404/okänd-tenant-sida.

**Utanför scope:**
- Själva bokningsflödet (G04).
- Inloggning/portaler.
- Bilduppladdning/CMS-redigering (det sköts i Salon Admin G07).

**Berörda områden/filer:** `5-Kod/app/(public)/`, `5-Kod/lib/tenant.ts`, `5-Kod/components/brand/`, `5-Kod/app/(public)/tjanster/`, `5-Kod/app/(public)/om/`, `5-Kod/app/(public)/kontakt/`.

**Steg:**
1. Implementera `getTenantFromHost` mot `tenants` (subdomän + custom_domain), med cache (`unstable_cache`/revalidate).
2. Skapa public layout som laddar tenant och sätter CSS-variabler + logo i header/footer.
3. Bygg `/`, `/tjanster`, `/om`, `/kontakt` som Server Components som läser tenant-scopad data (anon-klient, RLS skyddar).
4. Lägg "Boka tid"-CTA mot `/boka`.
5. Lägg per-tenant metadata (`generateMetadata`).
6. Okänd-tenant → 404.
7. `pnpm build` + lint.

**Verifieras (DoD):**
- Två olika tenants (demo-seed + en till) visar olika logo/färg/tjänstelista på samma kodbas.
- `/tjanster` listar endast den aktuella tenantens tjänster (RLS-bevis).
- Okänd subdomän ger 404.
- Lighthouse-grund OK (mobil), inga konsolfel.
- `pnpm build` grön.

**Tekniska noter:**
- Använd anon-klienten (RLS-skyddad) för publika queries; sätt tenant-kontext via host-resolver, inte via inloggning.
- För att RLS ska tillåta anonym läsning av publika tabeller (services för en tenant) — antingen public read-policy på `services`/`tenants` ELLER hämta via en server-side query med begränsad scope. Välj public-read-policy scoped på `tenant.status='active'`.
- CSS-variabler i `:root` sätts inline från tenant.brand för att undvika flash.
- White-label hårt krav: ingen "Corevo"-text/logo på tenant-publika sidor.
