# Inställningar v2 — implementationsplan

> **För agentkörning:** kör inline, proof-first, en uppgift i taget. Repo-regeln om en ensam aktiv branch vinner över parallella worktrees.

**Mål:** Leverera 04-paketets exakta inställningsyta ovanpå befintliga routes och lägga till minsta tenantbundna behörighetsmodell som krävs av designen.

**Arkitektur:** `/admin/installningar` blir ett responsivt servermatat nav med en liten klientdel för sök och kategoribyte. Varje kategori länkar vidare till befintlig ägande route; data dupliceras inte. Individuella personalrättigheter lagras per `staff_id` och kontrolleras centralt i både DAL/actions och RLS-helper.

**Teknik:** Next.js 15 App Router, React 19, Supabase/Postgres RLS, Vitest, Playwright.

## Globala begränsningar

- Exakta tokens och mått hämtas ur `Kundadmin Inställningar v2.dc.html`.
- Corevo förblir multi-bransch; terminologi kommer från tenantens vertical.
- `staff`/`staff_id` är enda personaldomänen.
- `corevo.se` får aldrig tenant-resolvas.
- Ingen ny dependency.
- Befintliga routes och funktioner tas inte bort.

---

### Uppgift 1: Kontrakt och datamodell

**Filer:**

- Skapa `5-Kod/e2e/acceptans/04-installningar-v2/04-installningar-v2.accept.spec.ts`
- Skapa `5-Kod/e2e/acceptans/04-installningar-v2/probe.js`
- Skapa `5-Kod/apps/web/lib/admin/settings-v2.contract.test.ts`
- Skapa `5-Kod/supabase/migrations/0081_tenant_member_permissions.sql`
- Ändra `5-Kod/packages/db/types.ts`

- [x] Skriv kontraktstest som kräver 308 px nav, 760 px panel, sökindex, varnings-only-status och mobil tillbaka-vy.
- [x] Kör testet och verifiera förväntat rött resultat mot nuvarande kortgrid.
- [x] Skriv SQL för `tenant_member_permissions(tenant_id, staff_id, operational_role, can_view_all_calendars, can_manage_customers, can_edit_site, can_view_daily_metrics)` med unik staff-koppling, sammansatt FK, RLS och explicita grants.
- [x] Lägg `private.has_admin_area_permission(text)` med `security definer set search_path=''`; owner passerar, aktiv länkad staff kontrolleras fail-closed.
- [x] Lägg kontraktstest för `private.tenant_id()`, `auth.uid()`, owner-write, own-read, inga anon-grants och area-mappningen.
- [x] Kör fokuserade test och uppdatera DB-typer manuellt enligt repo-mönster.

### Uppgift 2: Central behörighets-DAL och actions

**Filer:**

- Skapa `5-Kod/apps/web/lib/admin/member-permissions.ts`
- Skapa `5-Kod/apps/web/lib/admin/member-permissions.test.ts`
- Ändra `5-Kod/apps/web/lib/auth/session.ts`
- Ändra `5-Kod/apps/web/lib/auth/admin-areas.ts`
- Ändra relevanta actions under `5-Kod/apps/web/lib/admin/`

- [x] Skriv röda tester för owner, platschef, frisör och individuella tillägg.
- [x] Implementera en central läsning och `requireAdminArea`-koppling; ingen route får egen speciallogik.
- [x] Säkerställ att muterande actions återanvänder samma kontroll och att all-calendar endast påverkar lässcope, aldrig tenantgräns.
- [x] Koppla platschef platsbundet till tjänster/schema i RLS/RPC och behåll staff-administration owner-only under SECURITY DEFINER.
- [x] Kör auth-, admin-area- och behörighetstester grönt.

### Uppgift 3: Exakt Inställningar v2-skal

**Filer:**

- Skapa `5-Kod/apps/web/components/admin/SettingsV2.tsx`
- Skapa `5-Kod/apps/web/components/admin/settings-v2.module.css`
- Ändra `5-Kod/apps/web/app/(admin)/admin/installningar/page.tsx`
- Ändra `5-Kod/apps/web/lib/admin/settings-map.ts`
- Ändra `5-Kod/apps/web/lib/admin/settings-map.test.ts`

- [x] Skriv röda komponent-/kontraktstester för grupper, söksynonymer, ärliga chips och länkar.
- [x] Implementera 308/760-layouten och paketets färg-, typografi-, radie- och radtokens.
- [x] Rendera verklig serverdata i statusar och pane-rader; okända integrationer visas neutralt, aldrig falskt KOPPLAD.
- [x] Behåll befintliga routes som ägare av formulär; pane-rader länkar dit i ett klick.
- [x] Implementera mobil kategorilista och egen kategori-vy med tillbaka-kontroll.
- [x] Kör fokuserade Vitest- och Playwright-acceptanstester till 0 FAIL.

### Uppgift 4: Roller och aktivitetslogg

**Filer:**

- Skapa `5-Kod/apps/web/lib/admin/member-permission-actions.ts`
- Skapa `5-Kod/apps/web/components/admin/MemberPermissions.tsx`
- Ändra `5-Kod/apps/web/app/(admin)/admin/installningar/page.tsx`
- Ändra `5-Kod/apps/web/lib/platform/audit.ts` endast om befintlig audit-helper kan återanvändas tenantbundet utan bredare läsrätt.

- [x] Skriv röda tester för owner-only ändring, tenant/staff-validering och audit utan PII i meta.
- [x] Implementera rollval och fyra individuella tillägg med server action och dubbel tenantkontroll.
- [x] Visa senaste tenantens relevanta auditposter med namn hämtade separat; audit-meta förblir PII-fri.
- [x] Kör fokuserade tester grönt.

### Uppgift 5: Slutverifiering och dokumentation

**Filer:**

- Skapa `5-Kod/docs/installningar-v2-och-personalbehorighet.md`
- Uppdatera `HANDOFF.md` först efter verifierad leverans.

- [x] Kör `pnpm test`, `pnpm typecheck`, `pnpm lint` och `pnpm build` från `5-Kod/`.
- [x] Kör `04-installningar-v2.accept.spec.ts` och `probe.js` med 0 FAIL.
- [x] Kör CodeRabbit mot branchens diff och åtgärda giltiga issues efter separat granskning.
- [ ] Låt Zivar köra och godkänna testlistan; goal 71 får inte stängas före detta.
- [x] Dokumentera tabeller, RLS, dataflöde, routekopplingar och rollback utan secrets.
- [ ] Committera goal 71 som ett komplett, testat logiskt bygge.
