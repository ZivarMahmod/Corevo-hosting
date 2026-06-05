# Custom domains (egen domän) — ops-aktivering (goal-23)

Self-serve egen-domän via **Cloudflare for SaaS** (Custom Hostnames). Koden är byggd och
testad men **avstängd bakom `DOMAIN_PROVISIONING_ENABLED`** tills drift sätter secrets +
zon-setup nedan. Resolutionsläsvägen (`0019 resolve_tenant_by_domain` + middleware-fallback)
är redan live — detta dokument aktiverar bara skriv-/provisioneringsvägen.

> ⚠️ Inget av nedan körs autonomt. Det kräver en Cloudflare API-token + zon-config som
> bara Zivar/drift kan skapa. `CF_API_TOKEN` committas ALDRIG.

## Vad koden gör (när påslaget)
- DomänPanel (platform tenant-detalj `/salonger/[id]` → Domän) blir ett aktivt formulär.
- `addCustomDomain`: validerar domän → skapar custom hostname (CF for SaaS, DV/txt-SSL) →
  skriver `tenant_domains`-rad `verified:false` → visar DCV-poster (CNAME/TXT) kunden ska sätta.
- `verifyCustomDomain`: pollar CF-status → när `active` sätts `tenant_domains.verified = true`
  (först då resolvar `0019` domänen → white-label storefront).
- `removeCustomDomain`: raderar custom hostname i CF + tar bort raden.
- Utan secrets: allt **fail-closar** med tydligt fel (ingen krasch, ingen rad).

## Steg för att aktivera (drift)
1. **Cloudflare for SaaS på `corevo.se`-zonen**
   - Aktivera Cloudflare for SaaS (Custom Hostnames) på zonen.
   - Skapa en **fallback origin** (t.ex. `ssl.corevo.se`) som pekar mot Workern. Det är
     värdet kunderna CNAME:ar sin hostname till. (Se goal-16 OPS väg B.)
2. **API-token** (Cloudflare dashboard → My Profile → API Tokens)
   - Permissions: **Zone → SSL and Certificates → Edit** + **Zone → Custom Hostnames → Edit**
     (på `corevo.se`-zonen). Minsta möjliga scope.
3. **Worker-secrets** (kör i `5-Kod/apps/web`):
   ```
   wrangler secret put CF_API_TOKEN
   wrangler secret put CF_ZONE_ID            # corevo.se-zonens id
   wrangler secret put CF_FALLBACK_ORIGIN    # t.ex. ssl.corevo.se (valfritt men rekommenderat)
   ```
   Lokalt test: lägg samma i `apps/web/.env.local` (committas ALDRIG).
4. **Slå på flaggan** — sätt `DOMAIN_PROVISIONING_ENABLED=true` som Worker-var i
   `wrangler.jsonc` (`vars`) och redeploya. Av igen = sätt `false`/ta bort + redeploy →
   panelen återgår direkt till spärrat läge.

## Verifiering (efter aktivering)
- Lägg en riktig testdomän i panelen → få DCV-poster → sätt dem hos DNS-leverantören →
  klicka Verifiera → status `Verifierad` → storefront resolvar white-label på domänen.
- Ta bort testdomänen → custom hostname borta i CF + rad borta.

## Säkerhet / anti-patterns
- `CF_API_TOKEN` är server-only secret — aldrig i klient, aldrig committad.
- Resolution litar BARA på `tenant_domains.verified = true` (fel storefront annars).
- `corevo.se` + alla `*.corevo.se` är reserverade (plattformszonen) — kan inte läggas till.
- Rör inte apex/POS-subdomäner eller wrangler `routes` för kunddomäner (de går via CF for
  SaaS, inte wrangler-route).

## Rollback
- Flagga av (`DOMAIN_PROVISIONING_ENABLED=false`) → spärrat läge direkt, koden orörd.
- Kod: `git revert` + redeploy. Resolutionsvägen (0019) opåverkad.
- Testrader: `delete from tenant_domains where domain = '<test>'`; CF: ta bort hostname i
  dashboard eller via panelens Ta bort.
