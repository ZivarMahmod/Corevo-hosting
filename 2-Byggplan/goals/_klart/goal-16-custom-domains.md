# BRIEF-DB/KI-016: Custom-domän-uppslag (kunddomän → tenant, white-label)
Thinking: 🔴 Think hard

## Mål
Lär Workern att en kunds egen domän (t.ex. `kvikta.se`) ska visa rätt tenants storefront — med kundens domän kvar i adressfältet (white-label). Idag resolvar Workern bara `*.corevo.se`; allt annat blir `unknown` → 404. Detta bygger uppslags-LAGRET (DB-RPC + middleware). DNS/cert-aktivering per domän är ett ops-steg (sektion nedan), inte kod.

## Lägeskoppling
- HANDOFF "Nästa stora steg": custom-domäner/"egen domän".
- Domänstrategi `1-Planering/04-domanstrategi.md` §6 (kunddomän-spärr + `tenant_domains`).
- Foundation: `tenant_domains`-tabellen finns redan (migration 0001), saknar bara uppslags-väg + wiring.

## Kontext
- `tenant_domains` (0001): `id, tenant_id, domain text unique, is_primary bool, verified bool, created_at`. RLS på (0002-loopen). Unik-constraint på `domain` = redan indexerat för uppslag.
- Resolution idag: `apps/web/lib/tenant.ts → getTenantFromHost()` är **ren/synkron**. Den matchar bara `<slug>.corevo.se`-suffix + dev-fallbacks (`?tenant=`, `/t/`, `.localhost`). Bare-domän (`kvikta.se`) → `{ kind: 'unknown' }` → storefront 404.
- `middleware.ts` anropar `getTenantFromHost`, sätter `x-corevo-tenant-slug` på request-headern; storefront-server-components läser den. **`middleware.ts` är en fryst fil** — ändras bara medvetet, minimal yta, här i denna goal.
- Säkerhetsmodell: domänen avgör BARA vilken storefront som visas (publik data). Data-isolering = RLS + `tenant_id` (ADR 01 §2). Ett fel-uppslag läcker alltså INTE privat data — men fel storefront är ändå en bugg. Därför: uppslag bara på `verified = true` + tenant `status='active'`.
- Mönster att återanvända: de publika booking-RPC:erna (`create_public_booking` m.fl.) är `SECURITY DEFINER` + `search_path=''` + tenant-scopade. Samma mönster här (anon-klienten får inte rätt att läsa `tenant_domains` direkt under RLS — en DEFINER-RPC är den rena vägen).

## Berörda filer
- `5-Kod/supabase/migrations/0011_resolve_tenant_by_domain.sql` — NY. `public.resolve_tenant_by_domain(p_host text) returns text` (slug eller null). `SECURITY DEFINER`, `set search_path = ''`, idempotent (`create or replace`). Grant `execute` till `anon, authenticated`.
- `5-Kod/apps/web/lib/tenant.ts` — oförändrad ren logik. Lägg ev. en liten hjälp `isExternalHost(host, root, platform)` (true om host inte är root, inte platform, inte `*.<root>`, inte `*.localhost`) — så middleware vet när den ska göra DB-uppslag. Rör INTE den befintliga suffix-logiken.
- `5-Kod/apps/web/lib/custom-domain.ts` — NY. Async `resolveCustomDomainSlug(host): Promise<string|null>` som anropar RPC:n via anon Supabase-klienten, med en **per-isolat in-memory cache** (Map<host,{slug,exp}>, TTL ~300s, även negativ-cache för null så en okänd host inte slår DB varje request).
- `5-Kod/apps/web/middleware.ts` — minimal ändring: efter `getTenantFromHost(...)`, OM `tenant.kind === 'unknown'` OCH `isExternalHost(host)` → `const slug = await resolveCustomDomainSlug(host)` → om träff: `tenant = { kind: 'tenant', slug }`. Allt nedströms (header-sättning, G12-routing) funkar oförändrat. Cachen håller hot-path billig.
- `5-Kod/apps/web/wrangler.jsonc` — FIXA stale `routes`: idag listar den `demo.corevo.se` (avregistrerad — slug bytt till `kvikta`). Verkligheten på Workern = `kvikta.corevo.se` + `booking.corevo.se`. Sätt `routes` till exakt dessa två. **Lägg INTE kunddomäner (kvikta.se) här** — de kommer via Cloudflare for SaaS / zon, inte wrangler-route. (Stale route = nästa deploy skulle detacha `kvikta.corevo.se` och försöka återskapa `demo.corevo.se`.)
- `5-Kod/apps/web/lib/tenant.test.ts` (eller motsv. testfil) — enhetstester för `isExternalHost` + att suffix-logiken är oförändrad.

## Steg
1. Migration 0011: skapa RPC:n.
   ```sql
   create or replace function public.resolve_tenant_by_domain(p_host text)
   returns text
   language sql
   stable
   security definer
   set search_path = ''
   as $$
     select t.slug
     from public.tenant_domains d
     join public.tenants t on t.id = d.tenant_id
     where d.domain = lower(btrim(p_host))
       and d.verified = true
       and t.status = 'active'
     limit 1
   $$;
   grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;
   ```
2. `custom-domain.ts`: implementera `resolveCustomDomainSlug` (anon-klient `.rpc('resolve_tenant_by_domain', { p_host: host })`) + in-memory cache med positiv OCH negativ TTL.
3. `tenant.ts`: lägg `isExternalHost(host, opts?)` (ren funktion). Ingen ändring i `getTenantFromHost`.
4. `middleware.ts`: koppla in async-uppslaget enligt "Berörda filer". Håll diffen minimal — bara unknown→custom-domain-grenen.
5. `wrangler.jsonc`: rätta `routes` till `kvikta.corevo.se` + `booking.corevo.se`.
6. Seed kvikta-domänen för test (kör mot molnet, ELLER lägg i seed.sql):
   ```sql
   insert into public.tenant_domains (tenant_id, domain, verified, is_primary)
   select id, 'kvikta.se', true, true from public.tenants where slug = 'kvikta'
   on conflict (domain) do update set verified = true;
   ```
7. Tester gröna (vitest): isExternalHost + suffix-regression. typecheck + lint rena.

## Verifiering
- [ ] Migration 0011 applicerad på molnet; `select public.resolve_tenant_by_domain('kvikta.se')` → `kvikta`. Okänd host → null.
- [ ] Enhet: `isExternalHost('kvikta.se')` = true; `isExternalHost('demo.corevo.se')` = false; `isExternalHost('booking.corevo.se')` = false.
- [ ] Regression: alla befintliga `getTenantFromHost`-tester gröna (suffix + dev-fallbacks oförändrade).
- [ ] Edge: tom host, `verified=false`-rad (→ null, ingen storefront), inaktiv tenant (→ null). Negativ-cache slår inte DB varje request.
- [ ] `wrangler.jsonc routes` = exakt `kvikta.corevo.se` + `booking.corevo.se` (en `--dry-run`/diff visar INGEN detach av kvikta.corevo.se).
- [ ] Efter deploy + ops (sektion nedan): `kvikta.se` i webbläsaren visar kvikta-storefronten, **kvikta.se kvar i adressfältet**.
- [ ] POS orört: `corevo.se`, `admin.corevo.se`, `kiosk.corevo.se` svarar 200 som förut (vi rör inte den zonens apex/POS-subdomäner).

## Anti-patterns
- Gör INTE custom-domän-uppslag synkront i `getTenantFromHost` (den är ren + körs i server-components; DB-anrop hör hemma i middleware-lagret).
- Lita ALDRIG på en `tenant_domains`-rad utan `verified = true` — annars kan en ej-bekräftad domän peka en host mot fel tenant.
- Slå INTE DB per request — cache (positiv + negativ) är obligatorisk.
- Lägg INTE kunddomäner som wrangler `routes`/Worker Custom Domain om de inte är en zon i kontot — det är inte mekanismen för tredjepartsdomäner (se ops).
- Rör INTE `corevo.se`-zonens apex eller POS-subdomäner. Ingen `*/*`- eller `*.corevo.se/*`-route läggs.

## Kopplingar
- Bygger på `tenant_domains` (goal-02 / migration 0001) + G12 host-routing (middleware).
- Förbereder en framtida **goal-17: self-serve custom-domän-onboarding** (Cloudflare for SaaS-API från panelen: skriv domän → auto-skapa custom hostname + DCV → sätt `tenant_domains`-rad). Denna goal är resolutions-fundamentet den vilar på.
- `DomainPanel.tsx` (G08, halvbyggd) wires i goal-16, inte här.

## Rollback
- Kod: `git revert` av commiten (middleware/tenant/custom-domain/wrangler).
- DB: `drop function if exists public.resolve_tenant_by_domain(text);` + ta bort kvikta-raden (`delete from public.tenant_domains where domain='kvikta.se';`). Inget destruktivt — bara en ny funktion + en rad.

---

## OPS — aktivering av kvikta.se efter att koden deployats (Zivar, separat från Code)
Koden ovan gör att Workern KÄNNER IGEN kvikta.se. Men trafiken måste först NÅ Workern. För `kvikta.se` (som du äger själv, ligger på one.com) finns två vägar:

**Väg A — flytta kvikta.se till ditt Cloudflare som zon (enklast för EN egen domän, ger bare apex):**
1. CF → Add a site → Connect a domain → `kvikta.se` → byt nameservers hos one.com till CF:s två. Vänta Active.
2. ⚠️ Återskapa one.com-posterna i CF: **MX + ev. mejl/TXT** (annars dör mejl på kvikta.se).
3. Worker → Domains → Add Domain → `kvikta.se` (nu möjligt, zon i kontot). Ger bare `kvikta.se` i adressfältet.
4. Klart: `kvikta.se` → kvikta-storefront, white-label.

**Väg B — Cloudflare for SaaS, kvikta.se kvar på one.com (mönstret för FRÄMLINGS-kunder, subdomän):**
- Kräver fallback-origin + custom hostname på corevo.se-zonen + CNAME (+DCV-TXT) hos one.com. Bare apex funkar INTE via one.com-CNAME → använd subdomän (`boka.kvikta.se`). Detta är goal-16-territoriet (self-serve). Gör INTE detta som engångs för kvikta — väg A är enklare för en domän du äger.

> Rekommendation: för kvikta.se (din egen) → **väg A**. För riktiga frisör-kunder (Bangladesh-killen) → väg B, byggs som goal-16 med panel-flöde.
