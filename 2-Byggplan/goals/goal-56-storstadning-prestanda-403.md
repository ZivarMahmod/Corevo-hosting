# goal-56 — Storstädning: DB-last, 403-rotorsak, skräp (ponytail-audit 2026-07-11)

Full audit + bygges-kontroll efter goal-54/55 (v1.7.21–v1.7.30). Tre oberoende granskningar
(DB-last/prestanda, skräp/död kod, 403/deploy-pipeline). Detta är den samlade planen:
vad som RENSAS, vad som SVETSAS, i prioritetsordning. Inget byggt än — väntar på "kör".

---

## A. DB-överbelastning — SVETSA (prioritet 1)

Publika storefronten är frisk: allt cachat (`unstable_cache`, 300s, tagg `tenant:<slug>`),
varm sidvisning = **0 DB-queries**, inga N+1. Problemen sitter i admin/plattform-ytorna:

| # | Problem | Var | Allvar | Fix |
|---|---|---|---|---|
| A1 | HELA `bookings` över ALLA tenants läses per /salonger-listvisning (force-dynamic, `select('tenant_id')` utan tak) — skalar med plattformens totala bokningsvolym | `lib/platform/tenants.ts:74,189` | **HÖG** | count-aggregat per tenant (head-count eller group by) i stället för radläsning |
| A2 | Obegränsade per-tenant `bookings`-selects på kundkortet | `lib/platform/tenants.ts:492`, `lib/platform/tenant-customers.ts:103` | **HÖG** | `.limit()` + count-head där bara antal behövs |
| A3 | Cache-tagg för grov: EN admin-write bustar HELA tenantens storefront-cache → aktivt redigerande kund håller cachen permanent kall (~17 queries per kall visning) | `lib/admin/tenant.ts:94` (`revalidateTenant`, ~30 call-sites) | MEDEL | acceptera tills trafik motiverar finkorning (låg trafik/salong dämpar) — dokumentera, ingen kodändring nu |
| A4 | `tenant_settings` läses 3× och `verticals` 2× per kall storefront under olika cache-nycklar | `tenant-copy.ts:30`, `wizard-services.ts:128`, `staff-noun.ts`/`primary-cta.ts` | MEDEL | låt vara (kall sida är sällsynt; se A3) — RENSA först om A3 åtgärdas |
| A5 | Otakade modul-listor i kundkortet: `event_registrations`, `media_assets` (även `getStorageUsage` läser alla rader i stället för SUM), `blog_posts` (full body) | `lib/admin/events/data.ts:25,45`, `lib/admin/media/data.ts:16,46`, `lib/admin/blogg/data.ts:14` | MEDEL | `.limit(200)`-tak (samma mönster som shop_orders/offert) + SUM-läsning för storage |
| A6 | `rate_limit_hits` självstädar per nyckel men övergivna nycklar (engångs-IP) lämnar rader för evigt | migration 0008 | LÅG | cron-DELETE på gamla windows via befintlig cron-route — eller lämna (radformatet litet) |

Middleware = frisk (ingen DB normalt). Worker-CPU = frisk. Kurser/teasers = ej N+1.

## B. 403-rotorsaken — SVETSA (prioritet 2)

Naken bodylös 403 kan INTE komma från vår kod (middleware/rate-limit returnerar aldrig 403 —
verifierat). Det är Cloudflare-edge, och mönstret matchar exakt:

- **Hypotes 1 (starkast): custom-domain re-attach-glapp vid varje deploy.**
  booking/superbooking/minbooking/freshcut/florist är `custom_domain: true` i wrangler.jsonc
  och re-registreras vid VARJE `wrangler deploy` (full route-reconcile). Under glappet svarar
  edgen 403 utan body. `*.boka.corevo.se` är zone-route → reconcileras inte → drabbas aldrig
  (stämmer med observationen). 10+ deployer 2026-07-11 = 10+ glapp-fönster.
- Hypotes 2: CF-token utan Zone→DNS→Edit ger 403 mitt i attach (deploy.yml varnar redan för detta).
- Hypotes 3 (parallell, ej samma symptom): worker-OOM 1102 — redan fixad v1.6.1 (prefetch av).

**Åtgärder:**
| # | Åtgärd | Kostnad |
|---|---|---|
| B1 | Bevisa fönstret: polla booking+superbooking med curl var ~1s under nästa deploy, logga statuskoder; jämför frisk `*.boka`-host | 1 script-körning, ingen kodändring |
| B2 | Verifiera CF-tokenets scope (Zone→DNS→Edit på corevo.se) i CF-dashen — Zivars 2-min-jobb | manuell |
| B3 | Om B1 bekräftar: minska exponeringen — deploya bara vid behov (redan pausad auto-deploy hjälper), och/eller flytta booking/superbooking till zone-routes i stället för custom domains (samma mönster som `*.boka` som aldrig drabbas) | liten wrangler.jsonc-ändring + verify |
| B4 | Kortsiktig instruktion: efter deploy, vänta ~1 min innan admin-surf; envis 403 → hard-refresh/Incognito (stale-cookie-varianten) | ingen |

## C. Skräp — RENSA (prioritet 3)

Grep-verifierat dött:

| # | Vad | Var | Åtgärd |
|---|---|---|---|
| C1 | `setOffertStatus` (deprecated, 0 call-sites, divergent write-path) | `lib/admin/offert/actions.ts:136` | ta bort |
| C2 | `enterHelpMode` (0 call-sites; knappen borttagen) + barrel-rad | `lib/platform/actions/people.ts:485`, `lib/platform/actions.ts:22` | ta bort båda |
| C3 | `ButikLayout` — enda barn är redirect-stubbar, renderar aldrig | `app/butik/layout.tsx` | ta bort layouten (stubbarna kvar) |

**BEHÅLL (verifierat levande, rör ej):** app/butik/actions.ts + CheckoutForm (aktiv köp-räls),
redirect-stubbarna, pickNav (används av /boka + /avboka), sfLn*/sfEd*/fl*-CSS (konsumeras),
working_hour_slots (läses publikt i app/boka/actions.ts:181 — tidigare premiss FEL),
holds.ts + migration 0014 (medvetet vilande, build-once), alla scripts.

## Körordning (när Zivar säger kör)

1. **Körning A:** A1+A2+A5 (DB-tak/count-aggregat) + C1-C3 (rensning) — en commit, tsc/vitest/eslint, tag, deploy, FreshCut-verify.
2. **Körning B:** B1-bevis under den deployen (polla under deploy-fönstret) → beslut B3.
3. A3/A4/A6 = dokumenterade, byggs först när trafik motiverar.

## UTFALL (2026-07-11, v1.7.31)

**Körning A KLAR + deployad (success):**
- A1: listTenants/listTenantsWithStats läser inte längre varje bookings-rad —
  per-tenant HEAD count(*) + 1-rads senaste-läsning. `countBookingsByTenant` borttagen.
- A2: getTenantDetail per-service-räkning takad 5000; getTenantCustomers takad
  1000 kunder / 2000 bokningar / 500 offerter.
- A5: kurser (200 events / 2000 anmälningar), media (1000 + storage-tak), blogg (200).
- C1-C3 rensade: setOffertStatus, enterHelpMode (+barrel), ButikLayout.
- Migration 0054 (platform_booking_stats/service_booking_counts/tenant_storage_usage)
  COMMITTAD men EJ applicerad — Supabase CLI-token utgången (`npx supabase login` krävs;
  MCP saknar write-rättighet). Koden kräver den inte; RPC:erna = uppgraderingsväg
  (ponytail-kommentarer pekar hit).
- Verify: tsc 0 fel, 696 tester gröna, eslint 0 fel. Prod-smoke: florist 200,
  freshcut 200 (FREDAD ok), booking-login 200, superbooking 307.

**Körning B (B1-bevis):** poll 1 Hz på booking + superbooking under HELA deployen —
**0 avvikelser, inget 403-fönster observerat denna deploy.** (florist.boka.corevo.se
resolvar inte via DNS — fel jämförelsehost, säger inget.) Slutsats: fönstret är inte
varje-deploy-deterministiskt; hypotes 1 kvarstår som trolig men obevisad. Nästa bevissteg
om 403 återkommer: kolla CF-dash → Workers → domains-status i samma stund + B2
(token-scope Zone→DNS→Edit).
