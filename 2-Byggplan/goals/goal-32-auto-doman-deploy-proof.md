# goal-32 — Kund-domäner: auto vid onboarding + ALDRIG nere vid deploy
Thinking: ⚫ (rör live-routing för ALLA kunder + deploy-säkerhet — fel här = kundsidor nere / hela plattformen nere. Verifiering på RIKTIG deploy obligatorisk.)

**Datum:** 2026-06-16
**Typ:** Autonom byggorder för Claude Code — körs via /goal. **Körs direkt EFTER goal-31 (S0).**
**Vad detta är:** Enda ingångspunkten. Läs den + `1-Planering/01-arkitektur/doman-automation-pa-onboarding.md` FÖRST.

## Mål
En salongs storefront-domän (`<slug>.corevo.se`) ska:
1. **Kopplas automatiskt vid onboarding** (ingen handpåläggning i CF, ingen manuell wrangler.jsonc-edit).
2. **ALDRIG försvinna vid en deploy** — vi kommer ha 100+ deploys; kundsidor får inte gå ner.
3. **Bara försvinna vid manuell radering.**
4. Synas i en **"Domäner"-lista i super-admin** (status per salong: live / cert pending / fel).

Slut på det manuella domän-pillandet. Idag åker `test-barber.corevo.se` varje deploy för att den bara låg i CF-dashboarden (FX-14-fällan).

## Lägeskoppling
Task #19. Bygger på `1-Planering/01-arkitektur/doman-automation-pa-onboarding.md` + befintlig domän-kod (goal-23: `lib/cloudflare/custom-hostnames.ts` + DomänPanel, dormant bakom `DOMAIN_PROVISIONING_ENABLED`). Efter detta → tillbaka till sajtbyggaren S1.

## Utgångsläge (verifierat 2026-06-16)
- `wrangler.jsonc` `routes` = `booking` / `superbooking` / `minbooking` (custom_domain) + `test-barber.corevo.se` (nyss inlagd som temp) + `*.boka.corevo.se/*` (wildcard route, cert blockat på Free → används ej).
- **Onboarding skapar BARA en DB-rad** (tenant + slug). Den rör inte Cloudflare alls. → domän = manuellt steg idag.
- Codebasens FX-14-filosofi: domäner i `routes` (config = sanning) så deploy RE-ASSERTAR dem. Funkar för 3 fasta hosts — skalar INTE till 100 kunder via handredigering.
- goal-23 byggde CF-for-SaaS custom-hostnames-väg (API-managed) + secrets `CF_API_TOKEN`/`CF_ZONE_ID` satta. Anon/POS orörda. `🛑 *.corevo.se`-wildcard är FÖRBJUDET (fångar POS-subdomäner admin/kiosk/superadmin/www/dev).

## Autonomi-regler
- Alla tekniska val själv; en commit per punkt; verifiera + pusha före nästa.
- Bygg ENDAST via `C:\tmp\kod`. Gates före varje push: vitest · tsc 0 · lint 0 · opennext build PASS · grep-guard ren.
- DB-ändring bara via numrerad idempotent migration + RLS + rollback.
- `packages/auth` FRYST. POS/`corevo.se`/`root` orörd. DAL-fence intakt.
- **Deploy-verifiering är OBLIGATORISK** — denna goal får INTE stämplas klar utan bevis på en RIKTIG deploy (se Klar när).

## Beslut redan fattade — stanna inte
- Storefront-URL = `<slug>.corevo.se` (bare subdomän, gratis cert per host). INTE `*.boka` (Zivar vill ej ha "boka" i URL + ej betala för wildcard-cert).
- Per-kund-domäner läggs ALDRIG manuellt i wrangler.jsonc av Zivar. Antingen genereras de från DB, eller hanteras via CF-API — F1 avgör vilket.
- Återbruk goal-23-koden, bygg inte om.
- `test-barber.corevo.se`-raden i config = temp; får ersättas av den nya mekanismen.

## Steg
**F1 — Välj + BEVISA deploy-proof-mekanism (mini-spike, gör FÖRST).** Utvärdera mot CF-docs + en riktig test-deploy vilken som är säkrast så att (a) booking/superbooking/minbooking ALLTID står kvar, (b) kund-domäner överlever deploy, (c) funkar för `<slug>.corevo.se` på den delade corevo.se-zonen utan att röra POS. Kandidater:
   - **(A) Generera `routes` från DB vid deploy** — ett script läser aktiva tenant-domäner ur DB → skriver dem i config/generated config före `wrangler deploy` → varje deploy re-asserterar ALLA kund-domäner (codebasens FX-14-filosofi, men automatiskt, inte handredigerat).
   - **(B) CF for SaaS custom hostnames (goal-23-vägen)** för storefront-domäner — API-managed, ligger UTANFÖR wrangler routes → deploy rör dem ej. Verifiera att det funkar för egen-zons-subdomän `<slug>.corevo.se` + fallback origin.
   - **(C) routes ut ur config + `workers_dev:false`** (CF:s dokumenterade "dashboard/API äger routing"-metod) + API-attach. Verifiera att de 3 fasta hostarna INTE detacheras.
   Skriv beslutet + beviset i `1-Planering/01-arkitektur/doman-automation-pa-onboarding.md` (UTFALL-sektion).

**F2 — Auto-attach vid onboarding.** Onboarding-flödet (skapa tenant) kopplar `<slug>.corevo.se` automatiskt via vald mekanism (idempotent: lägg till om saknas, ta ALDRIG bort). Gratis cert per host. Domänen live utan handpåläggning.

**F3 — "Domäner"-lista i super-admin.** Vy som listar varje salongs domän + status (live / cert pending / fel), läst från CF/DB. Återbruk DomänPanel där det går.

**F4 — Vakt-script `5-Kod/scripts/check_domains` (offline).** Listar alla aktiva tenants → assertar att var och en har en kopplad, fungerande domän + att de 3 fasta hostarna lever. Larmar om något driftar. (Del av automation-script-lagret.)

## Klar när (kontrakt — bevisat på RIKTIG deploy)
- [ ] Mekanism vald + motiverad + bevisad i doman-automation-doc:ens UTFALL.
- [ ] `booking` + `superbooking` + `minbooking` + 1 test-kund-domän svarar 200 EFTER **två deploys i rad** (bevis: URL:er + status).
- [ ] En NY onboarding (skapa tenant) → dess `<slug>.corevo.se` blir live UTAN manuellt CF-steg, och överlever en efterföljande deploy.
- [ ] Manuell radering är ENDA sättet en domän försvinner (verifierat: en deploy ensam tar inte bort någon).
- [ ] "Domäner"-listan i super-admin visar alla + status, render-verifierad inloggad, 0 console-fel.
- [ ] `check_domains` finns + kör grönt.
- [ ] Gates gröna; worker-version + rollback-id noterade; POS `corevo.se` orörd (200).

## Anti-patterns
- Ta ALDRIG ner booking/POS. Testa deploy-säkerheten på staging/kontrollerat INNAN prod-deploy.
- ALDRIG `*.corevo.se`-wildcard (fångar POS).
- Ta ALDRIG bort en kund-domän automatiskt — bara manuell radering.
- Stämpla ALDRIG klart utan bevis på en riktig deploy (detta är hela poängen).
- Bygg via `C:\tmp\kod`, aldrig repo-roten.

## Rollback
- Mekanism (A): ta bort generations-steget → config tillbaka till statiska routes.
- (B)/(C): återställ `routes`-blocket i wrangler.jsonc till nuläget (booking/superbooking/minbooking/test-barber/boka) + redeploy. `wrangler rollback <id>`.
- DB-migration (om någon): drop-block.

## Rapportera
Vald mekanism + varför + deploy-beviset (URL:er före/efter två deploys). Hur onboarding nu kopplar domän. Lista-vyn. Cowork/Nörden gör oberoende live-verifiering (två deploys, ny onboarding) — lita ej på "klart".

## Versionshistorik
| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-06-16 | Auto-domän + deploy-proof-brief (Cowork). Körs direkt efter goal-31 (S0), före S1. |
