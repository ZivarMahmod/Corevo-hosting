# Custom domains (egen domän)

Self-serve egen domän använder **Cloudflare for SaaS Custom Hostnames**. Dessa
hostnames är inte Worker-routes och ska inte läggas i `wrangler.jsonc`.
Resolutionsläsvägen använder `resolve_tenant_by_domain` och middleware-fallback;
det här dokumentet gäller skriv- och provisioneringsvägen.

Produktionskonfigurationen i Git deklarerar
`DOMAIN_PROVISIONING_ENABLED=true`; staging deklarerar `false`. Det bevisar inte
vilket värde, vilka secrets eller vilken Cloudflare-konfiguration som faktiskt är
live. Kontrollera live-state read-only i releaseinventeringen före aktivering eller
release.

> ⚠️ Inget av nedan körs autonomt. Det kräver en Cloudflare API-token + zon-config som
> bara Zivar/drift kan skapa. `CF_API_TOKEN` committas ALDRIG.

## Vad koden gör (när påslaget)

- DomänPanel (platform tenant-detalj `/kunder/[id]` → Domän) blir ett aktivt formulär.
- `addCustomDomain`: validerar domän → skapar custom hostname (CF for SaaS, DV/txt-SSL) →
  skriver `tenant_domains`-rad `verified:false` → visar DCV-poster (CNAME/TXT) kunden ska sätta.
- `verifyCustomDomain`: pollar CF-status → när `active` sätts `tenant_domains.verified = true`
  (först då resolvar `0019` domänen → white-label storefront).
- `removeCustomDomain`: raderar custom hostname i CF + tar bort raden.
- Utan secrets: allt **fail-closar** med tydligt fel (ingen krasch, ingen rad).

## Steg för att aktivera (drift)

1. **Cloudflare for SaaS på `corevo.se`-zonen**
   - Aktivera Cloudflare for SaaS (Custom Hostnames) på zonen.
   - Avsedd fallback origin är **`booking.corevo.se`**. Det är värdet kunderna
     CNAME:ar sin hostname till. Verifiera det aktuella live-värdet i SSL/TLS →
     Custom Hostnames → Fallback Origin.
2. **API-token** (Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom)
   - Permissions: **Zone → SSL and Certificates → Edit** — det räcker; någon separat
     "Custom Hostnames"-permission finns inte (alla custom hostname-endpoints kräver
     `SSL and Certificates Write` enligt CF-docs).
   - Zone Resources: **Include → Specific zone → corevo.se** (aldrig All zones).
3. **Worker-secrets** (kör i `5-Kod/apps/web`):
   ```
   wrangler secret put CF_API_TOKEN
   wrangler secret put CF_ZONE_ID            # corevo.se-zonens id
   wrangler secret put CF_FALLBACK_ORIGIN    # booking.corevo.se (= dashboardens fallback origin)
   ```
   Lokalt test: lägg samma i `apps/web/.env.local` (committas ALDRIG).
4. **Verifiera flaggan** — produktionens `wrangler.jsonc` deklarerar
   `DOMAIN_PROVISIONING_ENABLED=true`, men live-värdet måste kontrolleras separat.
   För att stänga skrivvägen: sätt `false` och redeploya; panelen återgår då till
   spärrat läge.

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
