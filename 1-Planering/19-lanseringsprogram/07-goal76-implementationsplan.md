# Goal 76 — implementationsplan

> Körs i worktree `pin-booking-sim-fallback` på
> `codex/launch-inventory-customer-design`. Databassteg körs endast på Supabase
> Pro-previewbranchen `localhost-acceptance`.

## 1. Kanonisk storefront-origin

- [ ] Lägg RED-test i `5-Kod/apps/web/lib/storefront-url.test.ts`:
      standardhost är `<slug>.boka.corevo.se`, custom domain vinner och lokal
      backoffice-URL använder `?tenant=`.
- [ ] Ändra `5-Kod/apps/web/lib/storefront-url.ts` till en builder med separat
      kanonisk host och lokal app-URL.
- [ ] Flytta plattformslistan, kundkortet, onboardingkopian, domänpanelen och
      adminens sidlänkar till buildern.
- [ ] Ändra `5-Kod/apps/web/scripts/check_domains.mjs` till
      `<slug>.boka.corevo.se/boka` och endast 2xx/3xx som grönt.
- [ ] Ändra deployvalidatorn så aktiva tenants inte kräver nya
      `<slug>.corevo.se`-routes; skyddet för redan committade legacyalias ligger kvar.
- [ ] Kör det riktade URL-/domäntestet.

## 2. Provisionering utan falsk publicering

- [ ] Ändra befintligt test i `5-Kod/apps/web/lib/platform/actions.test.ts` så
      lyckat create kräver `status='provisioning'` och ingen active-update eller
      Cloudflare-attach.
- [ ] Kör testet och observera RED.
- [ ] Ta bort create-flödets aktivering och per-tenant attach i
      `5-Kod/apps/web/lib/platform/actions/tenants.ts`.
- [ ] Returnera ärlig successcopy: skapad, under konfiguration.
- [ ] Kör testet till GREEN.

## 3. Readiness och atomisk publicering i databasen

- [ ] Skapa migrationen från `5-Kod/` med
      `pnpm dlx supabase@2.109.1 migration new tenant_launch_readiness`.
- [ ] Lägg först ett kontraktstest i
      `5-Kod/apps/web/lib/platform/tenant-launch-readiness.contract.test.ts` för
      funktionssäkerhet, modulvillkor, readinessnycklar, radlås,
      idempotens och aktiveringstrigger; kör RED.
- [ ] Implementera privat missing-funktion, scopead readiness-RPC,
      `publish_tenant` och status-trigger i migrationen.
- [ ] Kör kontraktstestet till GREEN.

## 4. Samma sanning i admin

- [ ] Lägg RED-test för readiness-parser/etiketter i
      `5-Kod/apps/web/lib/platform/tenant-readiness.test.ts`.
- [ ] Implementera `5-Kod/apps/web/lib/platform/tenant-readiness.ts` som läser
      RPC-resultatet fail-closed och mappar stabila nycklar till svensk copy.
- [ ] Koppla readiness till `getTenantDetail`.
- [ ] Lägg RED-renderingstest för **Under konfiguration**, saknade punkter och
      spärrad/publicerbar knapp.
- [ ] Utöka `StatusControl` och kundkortets översikt med publiceringsläget.
- [ ] Låt `setTenantStatus(...active)` använda `publish_tenant`; övriga
      statusbyten behåller dagens väg.
- [ ] Uppdatera liststatus så `provisioning` är **Under konfiguration** och
      storefrontlänk inte påstår live.
- [ ] Kör de riktade testerna till GREEN.

## 5. Previewbranch och localhost

- [ ] Applicera migrationen på `localhost-acceptance`.
- [ ] Runtimekontroll 1: ofullständig syntetisk tenant nekas publicering och
      `missing` är korrekt.
- [ ] Konfigurera syntetisk tenant genom befintliga/RPC-vägar och kontrollera att
      readiness blir grön.
- [ ] Runtimekontroll 2: publicera, upprepa publicering och verifiera exakt en
      verklig statusövergång.
- [ ] Starta localhost mot previewbranchen och prova
      skapa → kundkort → readiness → publicera → storefront/bokningssida.

## 6. Låsning

- [ ] Kör riktade tester.
- [ ] Kör full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [ ] Kör `git diff --check`.
- [ ] Uppdatera Goal 76, `HANDOFF.md`, `2-Byggplan/ROADMAP.md` och en kort
      användartestlista i `6-Testing/`.
- [ ] Commit/push bara Goal 76-filer; bevara Goal 74:s ocommittade arbete.
