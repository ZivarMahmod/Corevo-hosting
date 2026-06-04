# BRIEF-DB/IN-023: DomänPanel self-serve — egen domän hela vägen (tenant_domains + Cloudflare for SaaS)
Thinking: ⚫ Ultrathink (extern provider + DNS + secret — gatas, ops-beroende)

## Mål
Bygg skriv-vägen för egen domän: super-admin/salong skriver in sin domän i DomänPanel → en custom hostname provisioneras via Cloudflare for SaaS → en `tenant_domains`-rad skapas → DCV/verifierings-status visas. Resolutionsläsvägen finns redan (migration 0019) — detta är den saknade andra halvan.

## Lägeskoppling
- Audit nod #9: "DomänPanel — `<fieldset disabled>`, ingen submit, inget Cloudflare-anrop, skriver ingen `tenant_domains`-rad. Bakom `DOMAIN_PROVISIONING_ENABLED`."
- Plan → GOAL-23 (störst extern risk, sist).
- HANDOFF: goal-16 förberedde "self-serve custom-domän-onboarding (Cloudflare for SaaS-API från panelen)". Detta ÄR den goalen. Resolutionsfundamentet (`0019 resolve_tenant_by_domain` + `lib/custom-domain.ts` + middleware-fallback) är redan live (WORKFLOW-03 VÅG 3).

## ⚠️ OPS-BEROENDE (Zivar, blockerar prod-aktivering — INTE bygget)
- Kräver en **Cloudflare API-token** (Custom Hostnames-rättighet på corevo.se-zonen) som Worker/server-secret. **Ingen Cloudflare-API-klient finns i repot idag** — den byggs här.
- Kräver **fallback-origin + custom hostname-setup** på corevo.se-zonen (Cloudflare for SaaS). Se goal-16 OPS väg B.
- Därför: **koden byggs + testas bakom `DOMAIN_PROVISIONING_ENABLED=false`**. Autonom körning kan INTE prod-verifiera live domän utan token → den delen är ärligt gatad och lämnas som ops-steg. Bygget + enhetstester + dry-run är vad auto-läget levererar.

## Kontext (verifierade ankare)
- `DomainPanel.tsx:14-55` (`components/platform/`) — `<fieldset disabled>`, `DOMAIN_PROVISIONING_ENABLED` (default false), ⛔-banner. Inget anrop.
- `tenant_domains` (`0001`): `{id, tenant_id, domain unique, is_primary, verified, created_at}`. RLS på.
- `0019_resolve_tenant_by_domain.sql` — `resolve_tenant_by_domain(p_host)` (SECURITY DEFINER, join `verified=true AND status='active'`). Läsvägen.
- `lib/custom-domain.ts` — anon RPC + in-proc cache.
- Ingen CF-klient: grep `cloudflare`/`custom hostname` i `apps/web/` → bara wrangler-config, ingen API-klient.

## Berörda filer
- `5-Kod/apps/web/lib/cloudflare/custom-hostnames.ts` — NY. Tunn klient mot Cloudflare for SaaS API (`POST/GET/DELETE /zones/{zone}/custom_hostnames`), läser `CF_API_TOKEN` + `CF_ZONE_ID` ur env. Fail-closed om secrets saknas (returnerar tydligt fel, kraschar inte).
- `5-Kod/apps/web/lib/platform/actions.ts` — NY `addCustomDomain(_p, fd)` (platform_admin/salon_admin-gated): validera domän → anropa CF-klient skapa custom hostname → insert `tenant_domains {tenant_id, domain, verified:false, is_primary}` → returnera DCV-instruktion (CNAME/TXT). NY `verifyCustomDomain` (poll CF status → uppdatera `tenant_domains.verified`). NY `removeCustomDomain` (DELETE CF + soft/hard-delete rad — respektera build-once där rimligt).
- `5-Kod/apps/web/components/platform/DomainPanel.tsx` — aktivera formuläret (bakom flaggan): domän-input + submit → `addCustomDomain` → visa DCV-poster + verifiera-knapp + status-badge (Väntar/Verifierad). När `DOMAIN_PROVISIONING_ENABLED=false` → behåll ärlig ⛔-banner.
- `5-Kod/apps/web/lib/platform/audit.ts` — `domain.add`/`domain.verify`/`domain.remove`.
- `.dev.vars`/wrangler-secrets-dok i `5-Kod/docs/ops/` — dokumentera `CF_API_TOKEN`/`CF_ZONE_ID` (sätts av Zivar, committas ALDRIG).
- Test: `lib/cloudflare/custom-hostnames.test.ts` (mocka fetch) + `addCustomDomain` happy/fel-path.

## Steg
1. **CF-klient** (`custom-hostnames.ts`): `createCustomHostname(domain)`, `getCustomHostname(id)`, `deleteCustomHostname(id)`. Mocka-bar (injicerbar fetch). Fail-closed utan token.
2. **Actions** i `actions.ts`: `addCustomDomain` (validera domän-format + ej redan tagen i `tenant_domains` + roll-gate → CF create → insert rad `verified:false` → returnera DCV-data), `verifyCustomDomain` (GET CF status → om aktiv: `update tenant_domains set verified=true`), `removeCustomDomain`. Alla loggar via `logPlatformAction`.
3. **DomainPanel UI:** bakom `DOMAIN_PROVISIONING_ENABLED`: aktivt formulär + DCV-visning + verifiera-knapp + status-badge + ta-bort. Flaggan false → oförändrad ärlig spärr-banner.
4. **Secrets-dok** i `5-Kod/docs/ops/custom-domains-ops.md`: token-scope, zon-id, fallback-origin-steg (väg B från goal-16), hur flaggan slås på.
5. Enhetstester (mockad CF) + typecheck + lint gröna. **Prod-deploy + live-domän-verifiering = GATAD på Zivars token/ops** (dokumentera, kör inte autonomt).

## Verifiering
- [ ] Enhet: `addCustomDomain` med mockad CF → `tenant_domains`-rad `verified:false` + DCV-data returnerad. Dubblett-domän → fel, ingen rad. Utan token → fail-closed-fel, ingen krasch.
- [ ] `verifyCustomDomain` mockad aktiv → rad `verified:true`.
- [ ] Med `DOMAIN_PROVISIONING_ENABLED=false`: panelen visar ärlig spärr, inget CF-anrop, ingen rad (oförändrat nuläge).
- [ ] Resolutionsvägen orörd: `resolve_tenant_by_domain` + middleware-fallback fungerar som förr (regression).
- [ ] typecheck + lint + vitest gröna. POS `corevo.se`+`admin.corevo.se` → 200.
- [ ] **GATAD ops-verify (Zivar, efter token):** sätt secrets + flagga → lägg riktig domän → DCV → verifierad → storefront resolvar white-label. (Ej autonomt.)

## Anti-patterns
- Committa ALDRIG `CF_API_TOKEN` — endast secret/env.
- Lita ALDRIG på en `tenant_domains`-rad utan `verified=true` i resolution (säkerhet — fel storefront).
- Krascha INTE när secrets saknas — fail-closed med tydligt fel (auto-läget måste kunna bygga utan token).
- Slå INTE på `DOMAIN_PROVISIONING_ENABLED` i kod/commit — det är Zivars ops-toggle.
- Rör INTE corevo.se-zonens apex/POS-subdomäner eller wrangler `routes` för kunddomäner (de går via CF for SaaS, inte wrangler-route — se goal-16 anti-patterns).

## Kopplingar
- Andra halvan av goal-16 (resolution) → detta = provisionering.
- Integration-badge (#13, GOAL-19) för "Domän" räknar `tenant_domains.verified` — fler verifierade domäner → badge/antal följer äkta.

## Rollback
- Kod: `git revert` + redeploy. Resolutionsvägen (0019) orörd → storefronts opåverkade.
- DB: ev. testrader `delete from tenant_domains where domain=...`. CF: `deleteCustomHostname` för ev. skapade test-hostnames. Inget destruktivt på befintlig data.
- Flagga av: `DOMAIN_PROVISIONING_ENABLED=false` → tillbaka till spärrat läge direkt.
