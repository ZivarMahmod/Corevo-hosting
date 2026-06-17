# goal-28 — Salong-storefronts via wildcard `*.boka.corevo.se`

> **⚠️ STATUS-KORRIGERING 2026-06-17:** DELVIS-SHIPPED 2026-06-14 (worker live) MEN `*.boka`-cert BLOCKAD (CF Free plan, kräver ~$10/mo ACM) + modellen förbigången av `<slug>.corevo.se` (goal-32/fix-35). Flytta INTE rakt av till klart/ — markera delvis-shipped. DoD-raden "cert Active" är ej uppfylld.

Thinking: 🔴 (routing/prod, delad zon med POS — rollback + Zivar-OK före deploy)

## Mål
Salonger nås på **`<slug>.boka.corevo.se`** via EN wildcard-route i `wrangler.jsonc` (durabel — överlever alla deploys). POS (`corevo.se` + dess subdomäner) **orörd**. Inget CF-jobb per kund: ny salong = bara en DB-rad (onboarding), subdomänen funkar direkt.

## Kontext (verifierat 2026-06-14)
- **`corevo.se` är en DELAD zon.** POS-systemet (Cloudflare Pages `corevo-pos-system`) äger: apex `corevo.se`, `admin`, `kiosk`, `superadmin`, `www`, `dev` (+ .dev). `odoo.corevo.se` = Tunnel. Mejl (MX/SPF) på apex. Booking-workern äger bara `booking`/`superbooking`/`minbooking`. **RÖR ALDRIG POS-poster.**
- **Varför wildcard (inte per-salong i dashboard):** CF-docs bekräftar att `wrangler deploy` skriver över dashboard-routes med configen (`wrangler.jsonc` = source of truth). Dashboard-tillagda custom domains/routes försvinner vid nästa deploy (det var så `salongzorbar` rök). → routen MÅSTE ligga i `wrangler.jsonc`.
- **Varför `*.boka.corevo.se` och INTE `*.corevo.se`:** en blunt `*.corevo.se`-route skulle kapa POS-subdomänerna (admin/kiosk/superadmin) → POS-haveri. `boka` är en egen gren som aldrig rör POS.
- **DNS:** `*.boka` A `192.0.2.0` Proxied — redan tillagd av Zivar.
- **Cert:** andranivå-wildcard. De andra dörrarnas `*.X.corevo.se`-cert auto-skapades (managed) utan manuell ACM. Verifiera att `*.boka.corevo.se`-cert blir Active efter setup; manuell ACM (~$10/mån) endast som fallback om det INTE auto-utfärdas.
- Tenant-resolution `<slug>` → tenant finns redan (kind 'tenant' för icke-reserverade `*.corevo.se`); återanvänds för boka-suffixet.

## Berörda filer
- `5-Kod/apps/web/wrangler.jsonc` — lägg wildcard-route.
- `5-Kod/apps/web/lib/tenant.ts` (+ `tenant.test.ts`) — host-tolkning för `<slug>.boka.corevo.se`.

## Steg
1. `wrangler.jsonc`: lägg route `{ "pattern": "*.boka.corevo.se/*", "zone_name": "corevo.se" }`. Behåll de 3 dörr-routerna (booking/superbooking/minbooking). Lägg ev. `NEXT_PUBLIC_TENANT_HOST_SUFFIX=boka.corevo.se` i `vars`.
2. `lib/tenant.ts`: klassa `<slug>.boka.corevo.se` → `kind:'tenant'`, `slug=<slug>` (härled suffixet `boka.corevo.se` ur env, hårdkoda inte). `boka.corevo.se` (apex på grenen) → reserved/ej tenant. **Bare `<x>.corevo.se` får ALDRIG bli tenant via en route** (POS-skydd kvar).
3. Bekräfta att tenant-resolution (slug → tenant i DB) träffar för boka-värdar.

## Verifiering
Bygg via `C:\tmp\kod` (ö-sökväg kraschar opennext).
- [ ] typecheck 0 · lint 0 · vitest grönt (+ nya host-tester: `demo.boka.corevo.se`→tenant(demo); `boka.corevo.se`→ej tenant; `admin.corevo.se`/`corevo.se`→oförändrat POS-säkert).
- [ ] opennext build PASS, grep-guard ren.
- [ ] (efter gatad deploy + Zivar-OK) Live:
  - [ ] testsalong (slug `demo`) i DB → `demo.boka.corevo.se` renderar dess storefront.
  - [ ] **`*.boka.corevo.se`-cert = Active** (auto; annars ACM-fallback).
  - [ ] **POS ORÖRD:** `corevo.se`, `admin/kiosk/superadmin.corevo.se`, `odoo.corevo.se` svarar precis som förut.
  - [ ] `booking/superbooking/minbooking.corevo.se` orörda.

## Anti-patterns
- Lägg ALDRIG `*.corevo.se` som route (kapar POS).
- Rör ej POS-poster, Pages-projektet eller `odoo`-tunneln.
- Dashboard-route räcker ej (skrivs över vid deploy) — MÅSTE i `wrangler.jsonc`.
- Hårdkoda inte host-suffix — env.
- Ingen autonom prod-deploy (gatad).

## Rollback
Ta bort wildcard-routen ur `wrangler.jsonc` + `git revert` + `wrangler rollback <prev-worker-id>`. DNS-posten + ev. cert kan ligga kvar ofarligt. Ingen DB-ändring.

## Kopplingar
Bygger på goal-27 (3 dörrar). `1-Planering/04-hosting-onboarding/`. Möjliggör onboarding end-to-end (task #8). Zivar-OK före deploy (delad POS-zon).
