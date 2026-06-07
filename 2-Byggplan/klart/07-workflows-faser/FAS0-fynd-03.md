<!-- WORKFLOW-03 FAS 0 recon (A1-A7), synthesized 2026-06-03. Auto-extracted from recon workflow wwiwkun36. -->

# FAS 0-fynd (WORKFLOW-03)

> Auktoritativ baslinje-brief, syntetiserad ur recon A1–A7 (verifierade mot live-DB `clylvowtowbtotrahuad` + kod-på-disk). Driver byggvågorna VÅG 1–5. Allt nedan är belagt med `fil:rad`-evidens från recon. **Inget i denna brief kräver om-verifiering** — siffrorna är frysta baslinjer.

---

## 1. Executive summary

Plattformen är **feature-complete och inte live-trasig idag** — men den vilar på fem latenta brott som alla detonerar i samma ögonblick som (a) en andra location skapas, (b) Stripe-betalning slås på, eller (c) en authed-kund bokar via storefronten. De fem viktigaste fynden:

1. **Split-brain på kund-identitet (HÖGST PRIO, spänner A3+A6).** Den enda insert-vägen `create_public_booking` skriver `bookings.customer_profile_id` men ALDRIG `customer_id`. Samtidigt läser ALLA 0011/0012-funktioner (PII-avslöjningsfönster, klientkort, lojalitet, favorit-RLS) på `customer_id`. MEMORY säger `customer_profile_id` är "live contract, never repoint"; DB-funktionerna säger `customer_id`. Nycklarna har divergerat och underhålls inte. Detta **blockerar lojalitets-earn** OCH gör att en inloggad kunds storefront-bokningar **osynliga i /konto**. Måste avgöras innan något nytt byggs ovanpå endera nyckeln.

2. **Booking-livscykeln har NOLL audit/historik.** Ingen booking-mutation (create/cancel/no_show/complete/walk-in/rebook/admin-flip) skriver en `audit_log`-rad; ingen status-historiktabell finns. `audit_log` innehåller bara `tenant.*`-rader. Den "galna/försvunna" bokningen är **odiagnostiserbar by design**. Förstärks av att `bookings_tenant_id_fkey` OCH `audit_log.tenant_id` båda är `ON DELETE CASCADE` — att radera en tenant (vilket ops-runbooks och platform-rollback faktiskt gör) hard-deletear både bokningar och deras audit-spår: total, oåterkallelig tyst förlust.

3. **Roll-vs-yta-gränsen sitter i route-GROUP-layouten, inte i middleware.** Middleware gör bara authed-eller-ej + host-routing och läser aldrig roll/nivå. Den enda materiella luckan: kod-på-disk **redirectar INTE** super_admin från `/admin` — den renderar DEMO-salongens admin-dashboard (super_admin är ankrad till `tenant_id=11111111`). Detta motsäger den live-observerade "redirect till /". Kontradiktionen måste lösas (deployad worker ≠ disk, ELLER observationen var post-login-landningen).

4. **Migrations-nummerplan är ren och säker NU, men bara nu.** Repo har 0001–0012 + 0014 (0013 saknas avsiktligt). Cloud har exakt 0001–0012; `0014_slot_holds` är committad men EJ applicerad (slot_holds-tabell saknas, `holds.ts` dvilande). Det gör att 0013 kan fyllas säkert (inget env har 0014-utan-0013). Forward-plan: **0013=loyalty-earn, 0014=slot_holds (oförändrad), 0015=domän-RPC** — måste appliceras i ordning 0013→0014→0015.

5. **Säkerhets-baslinjen är solid: 15 WARN / 0 ERROR.** RLS är den faktiska stängslet (alla 19 publika tabeller har RLS på; anon-prob ger 0 rader från all PII). Latenta penga-hål (guest-cancel utan refund; pay-then-cancel-race) är reella i kod men sovande tills Stripe går live. Multi-location är en **latent fälla**: `location_id` finns överallt men ingen läs/skriv-väg diskriminerar på den — en andra location-rad korrumperar bokningsdata tyst.

---

## 2. Role-boundary truth + target  *(driver VÅG 1)*

### Tre distinkta lager — kartan
| Lager | Vad det gör | Var |
|---|---|---|
| **Middleware** | ENDAST authed-eller-ej + tenant-from-host. Läser ALDRIG roll/nivå. | `middleware.ts L100-106`; `lib/supabase/middleware.ts L13` ("Authorization (role level) stays in the DAL/layouts, not here") |
| **Route-GROUP-layout** | Roll-vs-yta-stängslet via `requirePortal`/`requirePlatformAdmin`; ärvs av alla barn-sidor (som dessutom re-fence:ar defensivt). | `lib/auth/session.ts L74-91`; `app/(admin)/layout.tsx L9` |
| **Tenant-scope** | `getAdminTenant(user)` läser `user.tenantId` ur verifierad JWT (aldrig klient-input) + `.eq('tenant_id', ...)` + RLS `tenant_id=private.tenant_id()`. INGEN parameter-driven cross-tenant-läcka. | `lib/admin/tenant.ts L25-37`; `lib/admin/actions.ts L28-30,L84` |

### Roll→yta-MATRIS som koden tvingar IDAG (verkliga DB-nivåer 2/3/6/8)
| Roll (DB-nivå) | /konto | /personal | /admin | /platform |
|---|---|---|---|---|
| kund (2) | ✅ (host-gated till egen storefront) | /ingen-atkomst | /ingen-atkomst | /ingen-atkomst |
| staff (3) | ✅ | ✅ | /ingen-atkomst | /ingen-atkomst |
| salon_admin (6) | ✅ | ✅ (hierarkiskt, lvl≥3) | ✅ (6≥5 av en slump) | /ingen-atkomst (saknar platform_admin-flagga) |
| super_admin (platform_admin=true) | ✅ | ✅ | **renderar DEMO-salongen, INGEN redirect** | ✅ cross-tenant |

### Route-buggen, klassificerad (de två nivåerna får INTE kollapsas)
- **Fel roll på främmande yta = UX-GLITCH, inte access-hole (bekräftat ingen läcka).** staff(3)→/admin → `requireMinLevel(5)` → redirect `/ingen-atkomst`. kund(2)→/admin eller /personal → `/ingen-atkomst`. salon_admin(6)→/personal passerar (hierarkiskt by-design) men `getMyStaff(user.id)` ger tom "Ingen personalprofil kopplad" — empty state, inte annans kalender. Inget fall läcker annan tenants/users data. Evidens: `lib/auth/session.ts L74-84`; `app/(personal)/personal/page.tsx L29-45`.
- **super_admin på /admin = ACCESS-HOLE-ADJACENT DESIGN-GAP (ingen cross-tenant-läcka, men tyst single-tenant-ankring + oguardad mutation).** `/admin` ligger på platform-hosten som middleware INTE bouncar (BACKOFFICE-bounce gäller bara TENANT-hosts, `middleware.ts L95-97`). `(admin)/layout.tsx`→`requirePortal('admin')`=`requireMinLevel(5)`; platform_admin passerar alltid. `admin/page.tsx`→`getAdminTenant(user)` med `user.tenantId=11111111` → renderar demos admin. Super_admin kan **inte se vilken tenant de muterar** och kan bara nå demo (ingen tenant-switcher finns). Evidens: `app/(admin)/layout.tsx L9`; `lib/auth/session.ts L74-79`; DB: platform@corevo.se → platform_admin=true, tenant_id=11111111.

### KODKONTRADIKTION (måste lösas av dirigenten)
Live-observerat: super_admin på `booking.corevo.se/admin` → redirect till `/`. Kod-på-disk gör MOTSATSEN (renderar demo, ingen redirect). En redirect till `/` (inte `/ingen-atkomst`) är signaturen ENBART för `portalHomeFor(platform_admin)=/` som fyrar från `login/page.tsx L17` (post-login-landning) eller som länk på `/ingen-atkomst` — aldrig från en direkt authed `/admin`-navigering. **Slutsats: antingen fångade live-observationen post-LOGIN-landningen, eller så divergerar deployad worker (live=commit `11cdc66`) från HEAD.**

### Fantom-rollnivåer (debt/footgun)
`PORTAL_MIN_LEVEL = {kund:2, personal:3, admin:5, platform:7}` + 8-nivå-kommentaren refererar nivåer som INTE finns i DB. Verkliga roller: 2/3/6/8. `/admin`-grinden (min 5) släpper in salon_admin ENBART för 6≥5 (slump, inte avsikt). `/platform` använder inte nivå 7 alls — `requirePlatformAdmin()` kollar `app_metadata.platform_admin`-BOOLEAN. **Risk:** seedas någonsin en nivå-4/5/7-roll skiftar yt-matrisen tyst utan kodändring. Evidens: `lib/auth/roles.ts L1-24`; `lib/auth/session.ts L87-90`; DB roller {2,3,6,8}.

### Rekommenderad ETT central-guard-plats (B+A)
**Hård begränsning:** middleware-user bär ENDAST JWT-app_metadata (`platform_admin`, `tenant_id`) — INGEN `roleLevel`. roleLevel hämtas i `session.ts L36-54` via DB-join som designen uttryckligen förbjuder i middleware.
- **(A) OMEDELBAR stopgap:** lägg app_metadata-only-guard i middleware step-4 (~`L82`, efter `updateSession`) som bouncar platform_admin av `/admin` → stänger super_admin/host-gapet UTAN DB-anrop.
- **(B) LÅNGSIKTIGT:** aktivera den väntande Supabase auth-hooken (Dashboard-toggle, pending sedan G12) för att lyfta `roleLevel` in i JWT custom claims — då kollapsar HELA matrisen till EN middleware-guard på app_metadata.
- (C) Alternativ utan hook: konsolidera de 4 `requirePortal`-anropen till en path-driven `requireSurface(path)` i DAL:en — fortfarande per-group, inte i middleware.

---

## 3. Migration truth + clean numbering plan  *(driver VÅG 2)*

### Applied-vs-repo diff (1:1 rent, en repo-ahead-fil)
- **Cloud applicerat:** exakt 0001–0012 (12 rader). Inga cloud-only/orphan-migrationer.
- **Repo:** 0001–0012 + **0014** (13 filer; **0013 saknas avsiktligt**).
- **Enda asymmetri:** `0014_slot_holds` är committad i repo men EJ applicerad (`slot_holds`-tabell finns ej; `to_regclass('public.slot_holds')` är null). Konsumenten `lib/booking/holds.ts` är medvetet dvilande (ingen live-import), `types.ts` fryst → noll beteendeändring, säkert. Header: "INTE APPLICERAD — APPLICERA EJ utan Zivar-OK".
- **VIKTIGT:** cloud-`version` är en apply-time-timestamp (t.ex. `20260602123620`), INTE `00NN`-prefixet. `00NN` är bara läsbarhetskonvention. Verklig ordning = apply-sekvensen.

### Varför 0013-gapet är avsiktligt (inte slumpmässigt)
`lib/kund/loyalty.ts:8,46` refererar EXPLICIT "migration 0013" som den obyggda loyalty-EARN-triggern. Schemat är redan pre-staged i det APPLICERADE 0011: `loyalty_ledger.reason`-CHECK inkluderar `'earn_completed'`, och unik idempotens-index `loyalty_ledger_earn_once` på `(booking_id) WHERE reason='earn_completed'` finns. RLS är SELECT-only för authenticated → earn MÅSTE komma från en SECURITY DEFINER/trigger-väg — exakt det 0013 var tänkt att vara. `loyalty_ledger` har 0 rader. Evidens: `0011:120,225-226,546-551`.

### Ren forward-nummerplan (REKOMMENDERAD)
| Nr | Innehåll | Status / motiv |
|---|---|---|
| **0013** | **loyalty-EARN-trigger** | FYLL gapet. Matchar `loyalty.ts:8,46`-referensen, använder earn-schemat 0011 redan riggade. **Säkert ENBART för att 0014 är oapplicerad på cloud** → inget env har 0014-utan-0013. |
| **0014** | **slot_holds** | OFÖRÄNDRAD. Redan committad, `holds.ts` riggad mot den. Flytta den INTE nedåt för att stänga gapet (bryter committad fil + kod-ref). |
| **0015** | **resolve_tenant_by_domain RPC** | Nästa fria efter 0014. **Ersätter goal-16:s stale `0011`-namn.** |

### goal-16 custom-domains MÅSTE om-pekas
`goal-16-custom-domains.md` namnger sin migration `0011_resolve_tenant_by_domain.sql` / "Migration 0011" rakt igenom (Berörda filer, Steg 1, Steg 6 seed, Verifiering) — men 0011 konsumerades av kund-identity. RPC:n finns inte i cloud (proc-count 0). **Om-peka till 0015 och skriv om kroppen**, annars skapar byggaren en andra 0011-kollision. Bonus: goal-16 step 5 bär en stale wrangler-routes-fix (`demo.corevo.se` vs live `kvikta.corevo.se`+`booking.corevo.se`) som inte får tappas vid om-pekningen. `tenant_domains` har redan 1 rad i cloud.

### Apply-ordning-mandat
0013→0014→0015 (alla oapplicerade idag, så uppnåeligt). **Om domän-0015 någonsin appliceras INNAN 0013 skrivits blir back-fill av 0013 en out-of-order-risk** — speglingen av varför 0013-fyllning är säker idag.

### Bär-skuld från redan-applicerade 0011 (GDPR-regression, self-flagged)
0011 lade till PII i `public.customers` (full_name/email/phone/contact_hash) + `public.customer_notes`, plus en M5-scrub-trigger som bara fyrar när `customers.status='anonymized'`. `lib/gdpr/erase.ts:38-49` nullar bara booking-fält och **sätter aldrig** `customers.status='anonymized'` → scrub-triggern fyrar aldrig. 0011:s egen header (P2) varnar för detta. Beslut: kod-fix eller liten följdmigration innan fler PII-features.

---

## 4. Flow-vs-table gaps  *(driver VÅG 2)*

Av 11 kärnflöden: **8 fullt wired, 2 partiella, 1 (EARN) helt saknad write-väg.**

| Flöde | Status | Backing-tabell + write-väg | Evidens |
|---|---|---|---|
| Skapa/redigera tenant | ✅ WIRED | tenants insert + tenant_settings + cascade-rollback | `lib/platform/actions.ts:83-112` |
| Service CRUD/toggle | ✅ WIRED | services, FK-guarded delete | `lib/admin/actions.ts:36-132` |
| Staff CRUD/invite + staff_services | ✅ WIRED | roles upsert + service-role invite (degraderar mjukt) | `lib/admin/actions.ts:141-364` |
| Branding + storefront-media + copy | ✅ WIRED | tenant_settings jsonb, merge-not-clobber, R2-prune | `lib/admin/actions.ts:587-858` |
| Boka (guest + authed) | ✅ WIRED | `create_public_booking` DEFINER, EXCLUDE no_double_booking | `app/boka/actions.ts:201-286` |
| Rebook | ✅ WIRED | create-new-then-release-old, kompensations-rollback, carryBookingPayment | `lib/kund/actions.ts:197-282` |
| Pay/refund (authed) | ✅ WIRED (ops-gated) | Stripe Checkout DIRECT charge, payments UNIQUE(booking_id) | `app/boka/actions.ts:301-366`; `lib/stripe/refund.ts` |
| Schema (working_hours) | ✅ WIRED | skrivs av admin, läses av engine | `lib/admin/actions.ts:393`; `app/boka/actions.ts:116-121` |
| Schema (working_hour_slots) | ⚠️ PARTIAL (stale kommentar) | skrivs+läses (sedan 0011), men `lib/admin/actions.ts:433-437`-kommentaren säger felaktigt att engine INTE läser den | läs: `app/boka/actions.ts:128-191` |
| Guest-cancel refund | ⚠️ PARTIAL (penga-hål) | `cancelByToken` saknar refundBookingPayment helt | `app/avboka/actions.ts:56-105` |
| **Lojalitet EARN** | ❌ **MISSING WRITE-PATH** | tabell+RLS+earn-once-index finns, men INGEN insert-policy, INGEN trigger, INGEN RPC | se kontrakt nedan |

### Loyalty-EARN-kontraktet (spelas ut konkret för 0013)
- **Var det ska fyra:** på `status → 'completed'`-övergången, som sker i exakt två platser: admin `lib/admin/actions.ts:1042` (setBookingStatus) och personal `lib/personal/actions.ts:51` — båda gör idag bara `bookings.update({status})` + `sendReviewNudgeForBooking`.
- **Mekanism (val A rekommenderas):** `AFTER UPDATE`-trigger på bookings `WHEN status->completed` — matchar earn-once-unik-indexet + append-only-designen, är "migration 0013" som koden redan antar. (Val B = explicit service-role-insert i båda setBookingStatus.) RLS är SELECT-only → MÅSTE vara SECURITY DEFINER/trigger.
- **HÅRT FÖRKRAV:** `loyalty_ledger.customer_id` är `NOT NULL FK` till `customers(id)` (`0011:113`), men (1) `create_public_booking` skriver ALDRIG `bookings.customer_id` (refererar inte customers-tabellen alls); (2) en `customers`-rad är inte garanterad — `signUpCustomer` skapar auth.users + public.users men INGEN customers-rad; 0011-backfillen mintade bara rader för kunder som redan hade bokningar. **Earn-vägen MÅSTE därför först resolva `customer_profile_id → customers.id` (lazy-create raden) innan den kan inserta en ledger-rad.** Detta är samma split-brain som §5.
- **Formel + per-tenant-config:** poäng-per-bokning (flat/pris-baserad/duration-baserad?) lagras i `tenant_settings.settings.loyalty` (håller redan tier-trösklar — utöka med earn-rate).
- **REDEEM är också obyggt** (ledger stödjer `reason='redeem'`, signed delta; inget skriver det). Lägre prio — ingen UI lovar spendbarhet (`hasLedger=false` guardar). Avgör om in-scope eller deferred.

---

## 5. Booking-disappearance vectors + realtime state  *(driver VÅG 2 traceability + VÅG 4 realtime)*

### "Galna/försvunna bokningen" — root-cause-hypoteser, rangordnade
1. **Tenant CASCADE-delete (HÖGST sannolik, den enda vektor evidens visar faktiskt fyrade).** `bookings_tenant_id_fkey`=CASCADE OCH `audit_log.tenant_id`=CASCADE (båda verifierade live via pg_constraint). Radera en tenant → fysiskt bort både alla bokningar OCH allt audit_log som kunde ha registrerat dem — dubbel, oåterkallelig förlust utan tombstone. **Inte hypotetiskt:** `docs/ops/go-live-G13.md:34-39` instruerar `delete from public.tenants where slug='frisor3'`; MEMORY: frisor2 raderad + frisor1→demo; `lib/platform/actions.ts:94` gör `tenants.delete()` som rollback. Evidens: `0001:143,190`.
2. **Authed storefront-bokning är okopplad från kontot (latent "saknas i mitt konto").** `createBooking` (`boka/actions.ts:201`) kör som ANON via `createPublicClient` UTAN `p_customer` → även inloggad kund får `customer_profile_id=NULL`. /konto listar med `.eq('customer_profile_id', userId)` → storefront-bokningen syns ALDRIG i kontot. Bara rebook-vägen passar `p_customer`. Idag latent (alla 8 live-bokningar är gäster), men fyrar när authed-kunder bokar via storefront. Evidens: `lib/kund/bookings.ts:77,101`.
3. **Admin setBookingStatus saknar status-precondition (ACCESS-HOLE).** `admin/actions.ts:1024-1032` uppdaterar by id+tenant_id ENBART, utan `.in('status',...)` — en salon_admin kan flippa en `cancelled`/`no_show`-bokning tillbaka till `confirmed` (koden förutser t.o.m. EXCLUDE-clashen). Kontrast: staff-vägen guardar `.in('status',['pending','confirmed'])` (`personal/actions.ts:46`). Kombinerat med noll audit = bokningar kan tyst "komma tillbaka" utan spår.
4. **Rebook byter booking-id** (create-new + cancel-old, redirect till `${newId}`). Gamla id:t lämnas `cancelled` för evigt; bokmärken/HMAC-cancel-länkar/staff-referens till original-id pekar nu på en cancelled-rad. Läses av användaren som "min bokning flyttade sig själv". Ingen historik-rad binder newId→oldId. Kontrast: staff rebook gör in-place UPDATE (`personal/actions.ts:158`) — inkonsekvent modell.

### Audit/historik-täckningsgapet (KÄRNAN)
**Ingen booking-mutation skriver audit.** `audit_log` innehåller live ENBART `tenant.*` (create×3, activate, suspend, branding) och NOLL booking-entiteter. Enda triggern på `public.bookings` är `trg_bookings_updated` (set_updated_at) — ingen audit-trigger, ingen status-historiktabell. `audit_log` skrivs bara från `lib/platform/audit.ts` + `lib/gdpr/erase.ts`. Ingen av booking-mutatorerna (create/walk-in/cancel/no_show/complete/rebook) skriver audit. **Konsekvens: när en bokning "missköter sig" finns ingen registrering av vem som ändrade, från vilken status, när, eller om den raderades vs avbokades.** Detta ÄR varför incidenten är oförklarlig.

### Split-brain customer-nyckel (samma som §1.1, §4-förkrav)
Skapa-vägen skriver `customer_profile_id`; alla 0011/0012-features läser `customer_id`. 0011-FAS-7-backfillen länkade `customer_id` EN gång vid migrationstid (`0011:636-642,697-710`). Nya bokningar är INTE länkade: senaste raden `bab8214e` (2026-06-02 16:01, efter backfill) har BÅDE `customer_profile_id=NULL` OCH `customer_id=NULL`. För varje post-backfill-bokning matchar PII-avslöjningsfönstret, klientkort-lookup och lojalitets-länkning aldrig → kunden osynlig för staff-tooling. MEMORY säger profile_id; DB-features säger customer_id. **Nycklarna divergerar och måste reconcilas innan fler features byggs.**

### Realtime-state: helt obyggt (greenfield, inte trasigt)
Publikationen `supabase_realtime` finns men har NOLL tabeller (`pg_publication_rel` → table=null; bookings ej publicerad). INGEN klient-subscription någonstans i apps/web (grep `.channel(`/`.subscribe(`/`postgres_changes` = 0 träffar). Personal/admin-kalendrarna uppdateras bara via `revalidatePath` efter server-action. Två öppna kalendrar ser inte varandras ändringar förrän navigering/refresh. "Realtime" som feature existerar inte — det är greenfield för VÅG 4.

### Mindre vektorer
- **Övergiven `pending` låser sloten för evigt** (paying salons): `create_public_booking` insertar `pending`; EXCLUDE blockerar pending|confirmed|completed; enda som flyttar pending→confirmed är succeeded-webhooken. Övergiven Stripe-checkout → sloten död tills `start_ts` passerar. Ingen cron sveper stale pendings (enda cron = reminders). `0014_slot_holds` (5-min hold-med-expiry) committad men oapplicerad. `pending=3` live, `pending>1d=0`.
- **`no_show`/`cancel` lämnar raden + `customer_profile_id` saknar FK** → GDPR-delete skulle orphana den (hanteras app-lager av `erase.ts:122`, men ingen DB-enforcement; rå `auth.admin.deleteUser` skulle läcka).

---

## 6. Debt + risk register (severity-rankad)

| # | Sev | Titel | Detalj + evidens | Klass |
|---|---|---|---|---|
| 1 | **HIGH** | Guest token-cancel utan refund | `cancelByToken` sätter `cancelled` + skickar avbokningsmejl men anropar ALDRIG `refundBookingPayment`. Authed (`kund/actions.ts:167`) + staff (`personal/actions.ts:203`) gör det. Enda glasklara penga-hålet — total frånvaro av refund-kod, inte race. | silent-loss |
| 2 | **HIGH** | Pay-then-cancel-före-webhook-race | `payment_intent.succeeded` (`webhook/route.ts:106-117`) sätter payment `succeeded` + confirm ENBART `WHERE status='pending'` — ingen else/refund-gren för redan-`cancelled`. Cancel före webhook → refund no-op:ar (`refund.ts:24` early-return på `!=='succeeded'`) → sen webhook capturar pengarna, ser cancelled, refundar aldrig. Kund debiterad, slot fri, pengar tysta kvar. | silent-loss |
| 3 | **HIGH** | Split-brain customer_id/profile_id | Se §5. Blockerar loyalty-earn + osynliga konto-bokningar. | data-gap |
| 4 | **HIGH** | Noll booking-audit | Se §5. Incidenter odiagnostiserbara. | data-gap |
| 5 | **HIGH** | Tenant CASCADE-delete dödar bokningar+audit | Se §5.1. `0001:143,190`. | silent-loss |
| 6 | **MED** | Övergiven pending låser slot | Se §5. Ingen TTL/expiry/cron. | silent-loss |
| 7 | **MED** | Admin setBookingStatus utan status-guard | Se §5.3. Kan återuppliva cancelled/no_show. `admin/actions.ts:1024-1032`. | access-hole |
| 8 | **MED** | Rebook byter booking-id, bryter gamla länkar | Se §5.4. Ingen newId→oldId-historik. | ux-glitch |
| 9 | **MED** | Multi-location latent fälla | Se §8. 2:a location-rad korrumperar tyst. | silent-loss |
| 10 | **MED** | 0011 PII utanför GDPR-erase-räckvidd | Se §3. `erase.ts` sätter aldrig `status='anonymized'`. | silent-loss |
| 11 | **LOW** | `charge.refunded` friar inte bokningen | `webhook/route.ts:180-207` sätter bara `payments='refunded'`, rör inte bokningen → refunderad payment + aktiv bokning som håller slot. | debt |
| 12 | **LOW** | Reminder-cron skickar FÖRE stamp | `reminders.ts:116/131` skickar, `:139` stampar `reminded_at` efter → crash mellan = dubbel-send. At-least-once. | debt |
| 13 | **LOW** | Guest-PII i `bookings.note` free-text | `boka/actions.ts:222-234` lagrar gäst-namn/mejl/telefon som sträng; GDPR/scrub-implikation, kan ej dedupas till customers-rad, kan aldrig earna lojalitet. | debt |

**By-design-säkra (re-flagga EJ som hål):** rate-limit fail-OPEN (medvetet), carryBookingPayment race-safe, cancelByToken status-guardad mot dubbel-notis, webhook account-fence, EXCLUDE→`slot_taken`-mappning, webhook-idempotens för normalvägen. (`A4` finding 8.)

---

## 7. RLS/security baseline  *(siffran VÅG 5 inte får regressa)*

| Advisor | Antal | Sammansättning |
|---|---|---|
| **Security** | **15 WARN / 0 ERROR** | 1× extension_in_public (btree_gist), 5× anon-executable SECURITY DEFINER, 7× authenticated-executable SECURITY DEFINER, 1× auth_leaked_password_protection. **Ingen `rls_disabled_in_public`** — linter ser RLS överallt. |
| **Performance** | **22 INFO/WARN / 0 ERROR** | 3× unindexed FK (customer_favorites.service_id/staff_id, customer_notes.created_by), 18× unused_index (nya 0011-tabeller ej ännu körda), 1× multiple_permissive_policies på `roles`. |

**FRYST BASLINJE: 15 security WARN / 0 ERROR + 22 perf. Varje ny ERROR eller ny anon-läsbar PII efter VÅG-arbete = regression.** Kör om advisor efter varje migration som lägger tabell/policy (särskilt om 0014 appliceras).

### Verifierat solidt
- Alla 19 publika tabeller `relrowsecurity=true`. Roll-aware-mönstret (`private.tenant_id` + `private.role_level` + `private.current_customer_id`) live på varje PII-tabell.
- **Empirisk anon-prob: 0 rader** från customers/users/bookings/customer_notes/loyalty_ledger/payments (`set local role anon`). RLS — inte grants — är gränsen. staff=2, tenant_settings=5 (avsiktligt publik-läs).
- Varje projekt-ägd SECURITY DEFINER har `proconfig search_path=''` (ingen injektionsyta). De 12 DEFINER-WARN handlar om vem-som-kan-EXECUTE via PostgREST, inte search_path.

### Topp-risker / lättfixar
- **`scrub_customer_notes_on_anonymize`** är en trigger-fn men anon/auth EXECUTE-grantbar (0011:368 revokar `public` men inte default-grant som 0012 gjorde). En rad `REVOKE EXECUTE FROM anon, authenticated` tar bort WARN + ytan. Ingen beteendeändring.
- **Leaked-password-protection + auth-hook** = Dashboard-toggles (ej SQL-migrerbara), pending sedan G12 — Zivar flippar före go-live.
- **btree_gist i public** = destruktiv `ALTER EXTENSION SET SCHEMA` som rör double-booking-exclusion-constraint. **Rekommendation: ACCEPTERA WARN** (låg risk).
- **Bred Supabase-default anon-GRANT** på PII-tabeller (ofarligt — RLS nekar, 0-rad bevisat) — tightning = belt-and-suspenders.
- Spot-check `tenant_settings.contact`/`notifications`-JSON en gång under VÅG-arbete (säkerställ ingen salongsägare klistrade in SMTP/API-secret).

---

## 8. Parked + multi-location decision  *(driver VÅG 4)*

| Parkerat item | Klass | Vad det kräver |
|---|---|---|
| **Multi-location / multi-store** | BUILDABLE-NOW (additivt) | Schemat bär redan `location_id` på alla operativa tabeller + locations-tabell + one-primary-index. **MEN latent fälla — se nedan.** |
| **G03b designtrohet** | BUILDABLE-NOW, DELVIS REDAN LEVERERAD | Del 3 (tema-presets) ANSES NÖJD av WAVE-3:s 5 distinkta tema-layouter (Salvia/Leander/Zigge/Linnea/Edit, `HANDOFF.md:43`). **Scope bara till live-resten: Del 1** (Playwright-scrape freshcut.se + tofifi → `designspec-frisor.md`) **+ Del 2** (fidelity-polish av publik v1). Bygg INTE om hela droppen. |
| **Franchise (grupp/parent över tenants)** | EGET ARKITEKTURBESLUT — flagga, designa EJ | Kräver ny entitet över tenant, cross-tenant roll-up, grupp-billing, cross-tenant-roll — bryter single-tenant-RLS (`private.tenant_id()`). Täcks INTE av location-lagret. `HANDOFF.md:124,129`. |
| **Super-enkel onboarding** | EGET ARKITEKTURBESLUT (planeringssession) | Idag bara admin-skapar-tenant (`lib/platform/actions.ts:122-123`), ingen self-service signup. Produkt/tooling-beslut. `1-Planering/02-onboarding-flode.md` antar enkel salong, enkel location. |

### Multi-location: den latenta fällan (MÅSTE veta före greenlight)
`location_id` finns men **ingen läs/skriv-väg diskriminerar på den** — display-only. Båda resolve-vägar hard-pinnar PRIMARY: `getTenantContext` läser bara `is_primary=true` (`boka/actions.ts:56-62`); `create_public_booking` selectar `where is_primary limit 1` (`0005:234-237`). **Dagen en 2:a location-rad insertas utan om-riggning bryts tre saker tyst:** (1) varje bokning stämplas med PRIMARY:s location_id oavsett bokad staffs verkliga location (data-korruption); (2) `availability` returnerar ALLA tenant-staff, aldrig location-scopat → cross-location slot-bleed; (3) timezone tas från primary för alla. **Måste om-riggas FÖRE någon 2:a location-rad någonsin insertas.** Idag: 5 tenants × exakt 1 primary, 0 NULL, 8 bokningar — inget trasigt.

**Build-scope om green-lit:** (1) `p_location`-param till `create_public_booking` + resolva staff/availability per location; (2) location-picker-steg i BookingWizard (eller per-location subdomän/slug); (3) admin manage-locations CRUD (add/rename/set-primary/deactivate); (4) per-location staff/service/working-hours-tilldelnings-UI (kolumner finns, nya rader ärver alltid `ctx.tenant.locationId`); (5) **avgör om services/priser är per-location** — original `DB-schema.md` förutsåg `service_prices.location_id` + `location_hours` men byggd modell kollapsade till ett pris + staff-keyad hours. Reconcilas eller hålls platt.

---

## 9. Öppna beslut för dirigenten (konsoliderad, rangordnad)

**Beslut som blockerar bygg-start:**

1. **CANONICAL OWNERSHIP-NYCKEL** *(blockerar VÅG 2 lojalitet + traceability)*: `customer_profile_id` (MEMORY: "never repoint") vs `customer_id` (alla 0011/0012-features läser). Välj EN och antingen (a) gör `create_public_booking` populera `customer_id` på varje insert, eller (b) re-peka 0011/0012-features till `customer_profile_id`. **Måste avgöras innan något bygger på endera.**

2. **CENTRAL-GUARD-PLATS** *(blockerar VÅG 1)*: (A) middleware step-4 app_metadata-only — stänger platform_admin/host-gapet NU men kan ej nivå-separation; (B) aktivera auth-hook → roleLevel i JWT → full matris i en middleware-guard; (C) DAL `requireSurface()`. **Rekommendation: B (långsiktigt) + A (omedelbar stopgap).**

3. **super_admin /admin-kontradiktion** *(blockerar VÅG 1)*: är live-"redirect till /" verklig på DIREKT authed-nav (→ worker `11cdc66` divergerar från HEAD, redeploy) eller var det post-login-landningen? Och målet: bounca super_admin till platform-dashboard (kräver ny guard) ELLER tillåt med EXPLICIT tenant-SWITCHER (idag tyst låst till demo, kan mutera omedvetet)?

4. **MIGRATIONS-NUMMER** *(blockerar VÅG 2)*: bekräfta **0013=loyalty-earn, 0014=slot_holds (oförändrad), 0015=domän-RPC**, apply-ordning 0013→0014→0015, och om-peka goal-16 off stale 0011. (Alt: strict-append loyalty=0015/domän=0016 + korrigera `loyalty.ts`-kommentarerna — men då dangler 0013-slot permanent.)

5. **0014 NU eller DVILANDE** *(blockerar VÅG 4 holds/pending-expiry)*: applicera `0014_slot_holds` nu (kräver Zivar per-gångs-OK per header + `types.ts`-regen för att av-dvila `holds.ts`) ELLER håll READY. No-op på beteende idag.

6. **DESTRUCTIVE-RESET PITR-FÖRKRAV** *(guardrail för ALLA vågor)*: eftersom tenant-delete CASCADE:ar bort bokningar+audit oåterkalleligt (§5.1) och ops-runbooks faktiskt kör `delete from tenants` — **innan någon destruktiv migration/reset/tenant-delete i vågorna, bekräfta PITR/backup-täckning**. Beslut: behåll CASCADE (acceptera tyst destruktion) vs flytta tenants till soft-delete (`status='deleted'`, hard-delete aldrig) så booking+audit-historik överlever. Koppla även loss `audit_log.tenant_id` från CASCADE.

**Beslut för bygg-innehåll (icke-blockerande för start, krävs inom respektive våg):**

7. **Refund-paritet** *(VÅG 2/penga)*: lägg `refundBookingPayment` i `cancelByToken` NU (före Stripe live) — annars håller varje betald gäst-cancel pengarna. Plus webhook-refund-on-cancelled-gren + cancel-time-refund-timing (annullera in-flight PI eller köa refund webhooken honorerar).

8. **Booking audit/status-historik** *(VÅG 2 traceability)*: DB-trigger-baserad `booking_status_history` + audit_log-täckning för varje booking-mutation, så framtida incidenter är diagnostiserbara.

9. **Authed storefront-ägarskap** *(VÅG 2)*: ska `boka/actions.ts createBooking` koppla inloggad user som `p_customer` så storefront-bokningar syns i /konto?

10. **Abandoned-pending-cleanup** *(VÅG 4)*: ship slot_holds (0014) + wire holds.ts och/eller pending-expiry-sweep, ELLER acceptera slot-svält. Scope:a sweepen till paying salons/rader-med-payment (annars cancellas riktiga bokningar — `pending` betyder DUBBELT: "väntar betalning" på paying, "normal bokning" på non-paying). Avgör också om non-paying salons ska få `confirmed` direkt.

11. **Admin status-guard** *(VÅG 1/2)*: lägg status-precondition / tillåten-övergångs-matris på admin setBookingStatus.

12. **Rebook-modell** *(VÅG 2)*: reconcila kund (create-new-then-cancel, byter id) vs staff (in-place UPDATE, behåller id). Välj en kanonisk semantik + om old→new-länkning ska sparas.

13. **Realtime-scope** *(VÅG 4)*: live kalender/availability-uppdateringar in-scope (publikation + klient-subscription båda obyggda) eller `revalidatePath`-only?

14. **Fantom-rollnivåer** *(VÅG 1)*: reconcila `roles.ts` (admin=5/platform=7, 8-nivå-kommentar) mot verklig DB {2,3,6,8} — ändra trösklar (admin=6, platform=via flagga) eller seeda saknade roller. Lämna båda = tyst matris-skift när nivå-4/5/7 nånsin skapas.

15. **Parked-scope** *(VÅG 4)*: bekräfta multi-location near-term-bygg vs parkerat (MÅSTE om-riggas FÖRE 2:a location-rad); G03b scope:as till Del 1+2 (Del 3 nöjd av WAVE-3); franchise + super-enkel onboarding = egna planeringssessioner, designa EJ nu.
