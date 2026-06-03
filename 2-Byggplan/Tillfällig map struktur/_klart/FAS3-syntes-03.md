# FAS 3 — syntes (VÅG 3: FreshCut-baseline + kunddomän)

Recon-flotta `w2xa5k7bv` (3 agenter). Beslut låsta nedan. **PITR-ankare fångas FÖRE 3a-destruktion.**

## Verklighetskoll — vågen är MINDRE destruktiv än planen antog
- **FreshCut finns redan** (id `11111111-1111-1111-1111-111111111111`, slug `freshcut`, namn 'Frisör Demo'), med alla 4 konton + salvia-tema. Reset = UPDATE-på-plats, INTE ny-seed. `seed.sql` är stale (slug 'demo').
- **5 live tenants:** `freshcut` (BEHÅLL — 8 bokningar, 3 kunder, riktig data) + `frisor3`/`studio`/`arsgw`/`grwg` (PURGE — 0 bokningar var).
- Alla 4 konton finns med rätt nivå {8,6,3,2}; **platform@ = `Demo!1234`** (ej Corevo2026!) → rör EJ lösenord/auth.users.

## 3a — Purge + FreshCut-reconcile (DB, destruktivt, postgres-session)
**Landmin (B):** naiv `delete from tenants` ABORTAR — `audit_log`-CASCADE (7 rader i frisor3/arsgw/grwg) träffar `trg_audit_no_delete` (append-only, INGEN GUC-escape). Fix = `alter table audit_log disable trigger trg_audit_no_delete` i EN tx som postgres, re-arma efter. ALDRIG `session_replication_role=replica` (slår av RI → föräldralösa barn).

**Steg (en tx, postgres, EFTER PITR-ankare):**
1. `disable trigger trg_audit_no_delete` → `delete from tenants where id in (frisor3,studio,arsgw,grwg)` (cascade rensar deras settings/locations/roles/services/audit) → `enable trigger`. corevo.allow_booking_delete behövs EJ (0 bokningar). Verify: `tenants` = 1.
2. **FreshCut "ingen bokningsdata"-baseline** (per plan 3a): de 8 bokningarna + 3 kunderna är E2E-testskräp (E2E Test Kund, gdfhs, zivar mahmod, auth_user_id=NULL). Rensa i samma postgres-tx: `set local corevo.allow_booking_delete='on'` + `disable trigger trg_bsh_no_mutation` → `delete from bookings where tenant_id=freshcut` (cascade payments=0/bsh=0) → `delete from customers where tenant_id=freshcut` → re-arm. **Auktoriserat + planlagt + PITR-skyddat.** Hedrar guardens AVSIKT (skydd mot oavsiktlig/kod-väg-radering; detta = avsiktlig ägar-baseline-reset).

**FreshCut-reconcile (UPDATE-på-plats, build-once-never-delete — data-SQL, ej migration):**
- `tenants`: name → 'FreshCut'.
- `locations` (`77777777-0000-0000-0000-000000000001`): name → 'FreshCut', address → 'Bokhållaregatan 2, 582 24 Linköping'.
- `services`: UPDATE de 3 befintliga id:na (`5555…0001/0002/0003`) till brief #01–03, INSERT #04–07 (totalt 7), `active=false` på ev. överbliven ej i brief. **Riktiga öre** (36900/32900/45900/41900/32900/29900/22900), `duration_min` (kolumnnamn).
- `staff`: title → 'Barberare 1'/'Barberare 2' (behåll `profile_id`-länkar).
- `staff_services`: säkra 2 staff × **alla 7** tjänster = 14 länkar (inkl. #07 Skäggtrim — brief-typo 01-06 ignoreras, annars dör Skäggtrim).
- `working_hours`: ersätt freshcuts rader med brief (Mån–Tor 10–18, Fre 10–19, Lör=6 10–16) PER staff (config, ej skyddad).
- `tenant_settings`: **STRIP hex** `branding = branding - 'color_primary' - 'color_bg' - 'color_fg' - 'color_accent'` → salvia syns. Behåll `theme='salvia'`, `layout`. Lägg `contact.phone`='073-876 71 44', stats/rating + taglines i jsonb (inga nya kolumner).
- **Konton:** rör EJ (finns, rätt nivå; platform@-lösen orört).

## 3b — goal-16 kunddomän (KOD, middleware = FRYST → SOLO, bygger själv)
- **Migration `0019_resolve_tenant_by_domain.sql`** (EJ 0011): `public.resolve_tenant_by_domain(p_host text) returns text` — `language sql stable security definer set search_path=''`; `select t.slug from public.tenant_domains d join public.tenants t on t.id=d.tenant_id where d.domain=lower(btrim(p_host)) and d.verified=true and t.status='active' limit 1`; grant anon+authenticated. (tenants har INGEN domän/verified-kolumn → join `tenant_domains`.)
- **`lib/custom-domain.ts`**: `resolveCustomDomainSlug(host)` via anon `.rpc` + `Map<host,{slug,exp}>` (positiv+negativ TTL ~300s).
- **`lib/tenant.ts`**: ren `isExternalHost(host)` — exkludera root, platform, `*.<root>`, `*.localhost`, **`*.workers.dev` + 127.0.0.1** (annars onödig RPC per staging-request).
- **`middleware.ts:56`** (mellan rad 55 cookie-fallback och rad 57 isPlatformHost): additiv `if (tenant.kind==='unknown' && isExternalHost(host)) { const slug = await resolveCustomDomainSlug(host); if (slug) tenant={kind:'tenant',slug} }`. Flödar in i slug-header (rad 65) + updateSession. **Kan ALDRIG fyra VÅG1-guarden** (isPlatformHost-gated; custom-domän = kind:'tenant'). FRYST-fil → SOLO, rent tillägg.
- **`lib/tenant.test.ts`** (finns ej — skapa): isExternalHost + getTenantFromHost suffix-regression.
- **`wrangler.jsonc` routes: NOLL ändring** (live==config: booking+freshcut, zero-churn). Brief steg 5/6 (kvikta) STALE → ignorera (skulle detacha freshcut).
- **Test-mål:** live-rad `freshcut → demo.corevo.se (verified=true)` finns → `resolve_tenant_by_domain('demo.corevo.se')` → 'freshcut' (verifierar RPC utan ny DNS). Okänd host → null.
- **OPS-Zivar:** riktig kund-DNS/cert (Väg A apex-zon el. Väg B Cloudflare-for-SaaS custom-hostname) — koden gör bara att Workern KÄNNER IGEN en redan-routad host.

## Verifiering (adversariell flotta, live)
DB: `tenants`=1 (bara freshcut/active), freshcut-data == brief, salvia renderar (hex borta), 4 logins funkar, junk-tenants oåtkomliga, `audit_log` trigger re-armad (`tgenabled='O'`). goal-16: RPC demo.corevo.se→freshcut / okänd→null / isExternalHost exkluderar workers.dev / middleware bryter EJ VÅG1-guard+host-split / wrangler no-churn. POS 200/200, freshcut salvia live.

## Rollback
DB → PITR-ankare (fångas i 3a) ELLER per-steg. Kod → `git revert` + `wrangler rollback 39717c0c`. Migration 0019 = drop function.
