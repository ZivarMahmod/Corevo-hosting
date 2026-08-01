# Supabase launch-security triage

**Datum:** 2026-07-22
**Status:** read-only triage klar; inga DB-, Auth-, produkt- eller driftändringar utförda
**Projekt:** `clylvowtowbtotrahuad`
**Scope:** live advisors + migrations 0001–0119 + befintliga SQL-/kontraktstester

## Sammanfattning

Advisorresultatet innehåller **150 security notices** och **188 performance
notices**, men de är inte 338 likvärdiga sårbarheter.

Ingen verifierad P0 hittades. Alla publika tabeller har RLS och den stora
GraphQL-ytan följer uttryckliga Data API-grants. De fem private-tabellerna utan
RLS saknar direct grants till `anon`/`authenticated`; deras funktionsvägar är
pinade till `search_path=''` och har smala execute-grants. De två private-tabeller
som advisorn listar med “RLS enabled, no policy” är avsiktligt deny-all för
klientroller.

Fyra P1 behöver stängas före bred lansering:

1. **Default EXECUTE är fortfarande fail-open för nya funktioner.** Migration
   0108 återkallar tabell-/sekvensdefaults men inte funktionsdefaults. Live
   `pg_default_acl` visar `EXECUTE` till `anon`, `authenticated` och
   `service_role` för funktioner skapade av både `postgres` och
   `supabase_admin`. En framtida `SECURITY DEFINER` kan därför bli API utan att
   författaren uttryckligen valt det.
2. **Tre invokerfunktioner är både mutable-search-path och direkt körbara av
   anon:** `platform_booking_stats()`, `service_booking_counts(uuid)` och
   `tenant_storage_usage(uuid)`. RLS/invoker begränsar skadan, så detta är inte
   P0, men exponeringen är oavsiktlig och ska stängas.
3. **Supabase GraphQL används inte av appen men exponerar samma 24/58 tabeller.**
   Live kör `pg_graphql 1.5.11`; projektet får alltså inte 1.6.0:s nyare default
   med avstängd introspection. Det finns ingen GraphQL-användning i appen utöver
   genererade typer; Cloudflare-scriptets GraphQL är en annan tjänst.
4. **Leaked-password protection är avstängt** trots att projektet är Pro och
   backoffice fortfarande har lösenordsinloggning.

Performancefynden är i huvudsak skalningsskuld. Det viktigaste är 45 saknade
FK-index på heta kö-/boknings-/notifieringstabeller, en konkret initplan-policy
och Auths absoluta poolgräns på 10 anslutningar. 127 permissive-policy-notices
kommer huvudsakligen från avsiktlig OR-union mellan tenant-, partner- och
plattformspersonas; ingen ny cross-tenant-läcka bevisades av advisorn.

## Källor och metod

- Read-only Supabase Security Advisor och Performance Advisor hämtades 2026-07-22.
- Read-only katalogfrågor kontrollerade extensionversion/schema,
  `pg_default_acl`, funktionsprivilegier och funktionskonfiguration.
- Migrationskedjan 0001–0119 och relevanta pgTAP-/kontraktstester lästes.
- Sju fokuserade Vitest-filer kördes: **50/50 gröna**.
- Ingen migration applicerades och ingen Auth-/Data API-/GraphQL-inställning
  ändrades.

Officiell bakgrund:

- [Performance and Security Advisors](https://supabase.com/docs/guides/database/database-advisors)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [GraphQL security](https://supabase.com/docs/guides/graphql/security)
- [pg_graphql 1.6.0: introspection disabled by default](https://supabase.com/changelog/46320-breaking-change-in-pg-graphql-1-6-0-graphql-introspection-disabled-by-default)
- [Data/GraphQL API becomes opt-in for new tables](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## Security 150 — triage per kategori

### 1. Private RLS enabled utan policy — 2 INFO, avsiktligt

Exakta objekt:

- `private.booking_verification_challenges`
- `private.scheduler_heartbeats`

Båda har RLS, inga policies och inga klientgrants. Service-role-vägarna fungerar
eftersom service role/ägaren bypassar RLS. Detta är deny-all för Data API-roller,
inte en läcka.

[Advisor remediation 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

### 2. Mutable search_path — 3 WARN, verklig P1-hardening

Exakta objekt:

- `public.platform_booking_stats()`
- `public.service_booking_counts(uuid)`
- `public.tenant_storage_usage(uuid)`

Alla tre skapas i `0054_platform_aggregates.sql`, är `SECURITY INVOKER` och
refererar tabeller med kvalificerat `public.`. Det gör att RLS fortfarande gäller
och förhindrar en direkt privilege-bypass. Livekatalogen visar samtidigt:

- `proconfig = null` för alla tre;
- `anon_execute = true`;
- `authenticated_execute = true`;
- `service_execute = true`.

`0054` ger explicit authenticated execute men återkallar aldrig default/Public.
Åtgärden ska därför både sätta `search_path=''` och återkalla `PUBLIC`, `anon` och
onödiga service-role-grants innan exakt avsedd roll återges. Testa därefter
resultatet med `has_function_privilege`, inte bara källtext.

[Advisor remediation 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

### 3. `btree_gist` i public — 1 WARN, accepterad P2 tills branchbevis finns

`btree_gist 1.7` ligger live i `public`; den skapades redan i
`0001_core_schema.sql` och används av EXCLUDE-skyddet mot dubbelbokning.
`0004_public_read_and_hardening.sql` dokumenterar att flytt av extensionen
medvetet sköts upp för att inte riskera constraints.

Detta är namespace-hardening, inte en konstaterad dataexponering. Flytta inte
extensionen som en blind advisor-fix. Bevisa först på disposable branch att
befintliga GiST-index/constraints, nya migrationer och dubbelbokningstester
överlever `ALTER EXTENSION ... SET SCHEMA extensions`; annars registreras en
tidsbegränsad accepterad exception.

[Advisor remediation 0014](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)

### 4. GraphQL-visible tabeller — 24 anon / 58 authenticated

GraphQL följer samma PostgreSQL-grants och RLS som REST. Synlighet betyder därför
inte automatiskt att alla rader är läsbara. `0108_explicit_data_api_grants.sql`
gör ytan avsiktlig och kolumnbegränsar `tenants`/`tenant_settings`; SQL-testet
`data_api_grants_0108_test.sql` kräver samtidigt RLS på varje public-tabell.

Det kvarvarande problemet är onödig API-yta: appen använder 221
Supabase `.from()`/`.rpc()`-anrop men inget `/graphql/v1` eller `pg_graphql`.
Liveversionen är `pg_graphql 1.5.11` i schema `graphql`, och public-schemat saknar
GraphQL-konfigurationskommentar. Förstahandsvalet är därför att avaktivera
`pg_graphql` efter branch-/stagingbevis. Om GraphQL måste behållas ska extensionen
uppgraderas och introspection uttryckligen vara avstängd i prod.

Anonlistan är exakt den uttryckliga storefront-readytan:

```text
blog_posts, content_slots, gallery_items, location_opening_hours, locations,
loyalty_plans, media_assets, modules, services, shop_product_variants,
shop_products, shop_shipping_options, site_content_vertical_defaults, staff,
staff_services, template_slots, templates, tenant_events, tenant_modules,
tenant_settings, tenants, verticals, working_hour_slots, working_hours
```

Authenticated-listan är:

```text
audit_log, blog_posts, booking_status_history, bookings, contact_messages,
content_slots, customer_favorites, customer_notes, customer_notification_prefs,
customers, event_registrations, gallery_items, gift_cards, location_closures,
location_opening_hours, locations, loyalty_ledger, loyalty_members,
loyalty_plans, media_assets, modules, notifications_outbox, offert_requests,
partner_license_months, partner_license_price_events, partner_members,
partner_sms_configs, partner_tenant_events, partners, payment_disputes, payments,
push_subscriptions, role_permissions, roles, services, shop_order_items,
shop_orders, shop_product_variants, shop_products, shop_shipping_options,
site_revisions, slot_holds, staff, staff_services, template_slots, templates,
tenant_domains, tenant_events, tenant_member_permissions, tenant_modules,
tenant_settings, tenants, time_off, user_location_access, users, verticals,
working_hour_slots, working_hours
```

- [Advisor remediation 0026 — anon](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed)
- [Advisor remediation 0027 — authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed)

### 5. Anon-executable SECURITY DEFINER — 7 WARN, avsiktlig allowlist

Exakta funktioner och vakter:

1. `confirm_shop_order(uuid,text,uuid,text,text,text,text,uuid,text,uuid,text)` —
   ordertoken, serveruppslag av pris/lager och inputvalidering.
2. `event_seats_left(uuid)` — read-only kapacitetsaggregat, ingen kunddata.
3. `get_public_bookable_starts(uuid,uuid,uuid,uuid[],timestamptz[])` — bounded
   availability-projektion; returnerar bara bokningsbara par.
4. `get_public_booking(uuid)` — read-only bekräftelsesammanfattning via
   högentropi-UUID, uttryckligen utan kontaktuppgifter/note.
5. `get_public_shop_order(uuid,text)` — ordertoken krävs.
6. `release_shop_order(uuid,text,text)` — ordertoken + tillåtna statusövergångar.
7. `resolve_tenant_by_domain(text)` — returnerar endast slug för verifierad domän
   på aktiv tenant.

Samtliga är `search_path=''`. De är verkliga publika API-endpoints och ska därför
inte “fixas” genom generell revoke. Däremot saknas ett enda globalt katalogtest
som kräver att **exakt** dessa sju, och inga andra SECURITY DEFINER-funktioner,
är anon-executable. Lägg till det testet. Behandla `get_public_booking(uuid)` som
en bearer-link: loggar/referrer får inte sprida UUID:n; om framtida svar får PII
ska separat confirmation-token bli obligatorisk.

[Advisor remediation 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

### 6. Authenticated-executable SECURITY DEFINER — 54 WARN, avsiktlig RPC-yta

Alla 54 livefunktioner är pinade till `search_path=''`. En katalogtriage av
funktionsdefinitionerna visar att 51 innehåller `auth.uid()`, en `private.*`-vakt
eller tokenargument. De tre utan sådan vakt är de avsiktligt publika read-only
projektionerna `event_seats_left`, `get_public_booking` och
`resolve_tenant_by_domain`.

Den exakta allowlisten, grupperad efter kontrakt, är:

- **Publik overlap (7):** `confirm_shop_order`, `event_seats_left`,
  `get_public_bookable_starts`, `get_public_booking`, `get_public_shop_order`,
  `release_shop_order`, `resolve_tenant_by_domain`.
- **Kund/identitet (4):** `claim_customer_account`,
  `customer_loyalty_totals`, `get_customer_contact`,
  `set_my_notification_preferences`.
- **Bokning/schema/personal (24):** `create_admin_booking`,
  `create_admin_time_off`, `create_admin_time_off_series`, `create_my_time_off`,
  `create_public_booking`, `create_staff_walk_in`, `create_staff_with_defaults`,
  `delete_admin_time_off`, `delete_my_time_off`, `get_admin_time_off_impacts`,
  `get_busy_intervals`, `mark_admin_time_off_booking_handled`,
  `preview_admin_time_off_impacts`, `replace_staff_services`,
  `reschedule_admin_absence_booking`, `reschedule_admin_booking`,
  `restore_schedule_backup`, `save_location_booking_settings`,
  `seed_explicit_slots_from_hours`, `set_admin_booking_status`,
  `set_my_primary_location`, `set_primary_location`, `set_staff_active`,
  `set_tenant_member_permissions`.
- **Sajtrevisioner (4):** `discard_site_draft`, `publish_site_draft`,
  `restore_site_revision`, `save_site_draft`.
- **Plattform/partner (15):** `partner_update_tenant_user`,
  `platform_create_customer`, `platform_cron_health`,
  `platform_customer_safe_rows`, `platform_drift_health`,
  `platform_outbox_rows`, `platform_outbox_summary`,
  `platform_partner_summaries`, `platform_replace_service_staff`,
  `platform_replace_staff_schedule`, `platform_replace_staff_services`,
  `platform_save_tenant_billing`, `platform_set_contact_message_status`,
  `save_partner_sms_config`, `sync_partner_license_open_month`.

Migrations 0076–0119 har många objektsspecifika execute-/negative tests. Advisor-
varningen ska ändå behållas som en allowlist-review, inte masskonverteras till
`SECURITY INVOKER`: flera funktioner behöver avsiktligt kringgå en snäv tabell-RLS
efter att de gjort starkare tenant-/roll-/platskontroll i kroppen.

[Advisor remediation 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

### 7. Default function privileges — verklig P1 som advisorn bara visar indirekt

`0108_explicit_data_api_grants.sql` säger att nya public-objekt ska opta in, men
återkallar bara defaults för tables och sequences. Live `pg_default_acl` visar:

```text
owner postgres       / schema public / functions: anon=X, authenticated=X, service_role=X
owner supabase_admin / schema public / functions: anon=X, authenticated=X, service_role=X
```

Detta förklarar varför varje funktionsmigration måste komma ihåg egna revokes.
Det räcker inte som långsiktig säkerhetskontroll. En hardeningmigration ska:

- återkalla default function EXECUTE från `PUBLIC`, `anon`, `authenticated` och
  `service_role` för relevanta owner-roller;
- återkalla breda execute-grants på befintliga funktioner;
- återge exakt de dokumenterade allowlisterna till respektive roll;
- bevara nödvändiga Auth-hook-/service-role-grants;
- verifiera både clean replay och nuvarande livehistoria.

Gör inte en generell revoke live utan den atomiska re-granten i samma migration;
det skulle annars slå ut bokning, admin och notifieringar.

### 8. Leaked-password protection — P1 Auth-konfiguration

Aktivera HIBP-skydd i Auth settings före publik lansering. Funktionen finns på Pro.
Canarytesta ett känt komprometterat testlösenord och ett starkt lösenord, samt
verifiera invite/reset/login så att supportpåverkan är känd.

[Advisor remediation — password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### 9. Fem private-tabeller utan RLS — kontrollerad, inte P0/P1

Exakta objekt:

```text
private.working_hour_slots_0076_snapshot
private.staff_walk_in_intents
private.customer_account_claims
private.customer_claim_merge_intents
private.customer_erasure_auth_cleanup
```

De ligger utanför exponerat schema, saknar direct table grants för
`anon`/`authenticated`, och deras vägar går via pinade, roll-/tokenfencade
funktioner. Befintliga tester kontrollerar flera av execute-/table-gränserna.
RLS kan senare läggas till som defense-in-depth, men det är inte en launch-P0/P1
så länge det globala private-schema-testet fortsätter kräva noll client grants.

## Performance 188 — triage

### 1. Unindexed foreign keys — 45

Detta är inte en säkerhetsläcka. Index behövs främst för FK-parent delete/update,
joins och filter; de ska prioriteras efter trafik och query plans, inte skapas
blint i ett enda svep.

Exakta constraints:

```text
private.booking_verification_challenges:
  booking_verification_challenges_booking_id_fkey
  booking_verification_challenges_hold_id_fkey
  booking_verification_challenges_outbox_id_fkey
  booking_verification_challenges_pin_outbox_id_fkey
  booking_verification_challenges_service_id_fkey
  booking_verification_challenges_staff_id_fkey
private.customer_account_claims:
  customer_account_claim_claimed_tenant_fkey
  customer_account_claim_customer_tenant_fkey
  customer_account_claims_used_by_fkey
public.blog_posts: blog_posts_cover_asset_id_fkey
public.content_slots: content_slots_asset_id_fkey, content_slots_updated_by_fkey
public.customer_favorites: customer_favorites_service_id_fkey, customer_favorites_staff_id_fkey
public.customer_notes: customer_notes_created_by_fkey, customer_notes_location_id_fkey
public.customer_notification_prefs: customer_notification_prefs_customer_tenant_fkey
public.gallery_items: gallery_items_asset_id_fkey
public.location_closures: location_closures_created_by_fkey
public.location_opening_hours: location_opening_hours_confirmed_by_fkey
public.loyalty_members: loyalty_members_customer_id_fkey, loyalty_members_plan_id_fkey
public.notifications_outbox:
  notifications_outbox_booking_id_fkey
  notifications_outbox_customer_id_fkey
  notifications_outbox_staff_id_fkey
public.partner_license_months: partner_license_months_tenant_id_fkey
public.partner_license_price_events: partner_license_price_events_actor_user_id_fkey
public.partner_tenant_events:
  partner_tenant_events_actor_user_id_fkey
  partner_tenant_events_tenant_id_fkey
public.push_subscriptions: push_subscriptions_customer_tenant_fkey, push_subscriptions_tenant_id_fkey
public.shop_order_items:
  shop_order_items_event_registration_id_fkey
  shop_order_items_gift_card_id_fkey
  shop_order_items_product_id_fkey
public.shop_orders: shop_orders_pickup_location_id_fkey, shop_orders_shipping_option_id_fkey
public.shop_product_variants: shop_product_variants_image_asset_id_fkey
public.shop_products: shop_products_image_asset_id_fkey
public.site_revisions:
  site_revisions_created_by_fkey
  site_revisions_published_by_fkey
  site_revisions_source_revision_id_fkey
  site_revisions_updated_by_fkey
public.slot_holds: slot_holds_service_id_fkey
public.user_location_access: user_location_access_created_by_fkey
public.users: users_primary_location_id_fkey
```

Första indexvågen bör benchmarka de heta objekten:
`booking_verification_challenges`, `notifications_outbox`, `slot_holds`,
`users.primary_location_id` och claims/erasure-livscykeln. Notera att befintliga
kompositindex med `tenant_id` först inte alltid täcker en FK vars nyckelkolumn
kommer senare; exempelvis täcker `(tenant_id, primary_location_id)` inte FK-
operationer som börjar med `primary_location_id`.

[Advisor remediation 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

### 2. Auth RLS initplan — 1, enkel P1

Objekt: `public.role_permissions`, policy `role_permissions_read`.

`0025_role_permissions.sql` använder `auth.role() = 'authenticated'` utan `TO`
clause. Det ger både per-row reevaluation och onödiga policyroller. Byt till
`FOR SELECT TO authenticated USING (true)` och gör adminpolicyn roll-/action-
specifik med `(select private.is_platform_admin())`. Detta tar även bort flera av
de sex duplicate-policy-notices som advisorn rapporterar för tabellen.

[Advisor remediation 0003](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

### 3. Unused indexes — 14, inte dropplista

```text
payment_disputes_payment_idx
notifications_outbox_drift_active_tenant_idx
tenants_vertical_id_idx
tenants_partner_id_idx
shop_products_tenant_idx
shop_orders_tenant_idx
partner_license_price_events_partner_idx
blog_posts_tenant_idx
offert_requests_tenant_idx
gift_cards_tenant_idx
shop_products_tenant_category_idx
shop_order_items_event_idx
shop_order_items_type_idx
shop_variants_tenant_idx
```

Flera är nya (partner/drift) eller tillhör avstängda/lågtrafikerade moduler.
“Unused” sedan senaste statistikreset bevisar inte att indexet saknar värde.
Kräv indexålder, `pg_stat_user_indexes`, representativ trafik, query plan och
kontroll att det inte stöder constraint/kommande modul innan drop. Detta är P2
capacity cleanup.

[Advisor remediation 0005](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

### 4. Multiple permissive policies — 127, avsiktlig struktur men P1-prestandaskuld

Notiserna träffar följande exakta table/action-ytor (antal notices inom hakparentes):

```text
audit_log [2]: authenticated INSERT, SELECT
blog_posts [4]: authenticated DELETE, INSERT, SELECT, UPDATE
booking_status_history [1]: authenticated SELECT
bookings [1]: authenticated SELECT
contact_messages [1]: authenticated SELECT
content_slots [4]: authenticated DELETE, INSERT, SELECT, UPDATE
customer_favorites [1]: authenticated SELECT
customer_notes [4]: authenticated DELETE, INSERT, SELECT, UPDATE
customer_notification_prefs [1]: authenticated SELECT
customers [2]: authenticated INSERT, SELECT
event_registrations [2]: authenticated SELECT, UPDATE
gallery_items [4]: authenticated DELETE, INSERT, SELECT, UPDATE
gift_cards [3]: authenticated INSERT, SELECT, UPDATE
location_closures [1]: authenticated SELECT
location_opening_hours [1]: authenticated SELECT
locations [4]: authenticated DELETE, INSERT, SELECT, UPDATE
loyalty_ledger [1]: authenticated SELECT
loyalty_members [1]: authenticated SELECT
loyalty_plans [4]: authenticated DELETE, INSERT, SELECT, UPDATE
media_assets [4]: authenticated DELETE, INSERT, SELECT, UPDATE
modules [1]: authenticated SELECT
offert_requests [1]: authenticated SELECT
partner_license_months [1]: authenticated SELECT
partner_license_price_events [1]: authenticated SELECT
partner_members [1]: authenticated SELECT
partner_sms_configs [1]: authenticated SELECT
partner_tenant_events [1]: authenticated SELECT
partners [1]: authenticated SELECT
payment_disputes [1]: authenticated SELECT
payments [1]: authenticated SELECT
role_permissions [6]: anon/authenticated/authenticator/cli_login_postgres/dashboard_user/supabase_privileged_role SELECT
roles [2]: authenticated INSERT, SELECT
services [4]: authenticated DELETE, INSERT, SELECT, UPDATE
shop_order_items [1]: authenticated SELECT
shop_orders [2]: authenticated SELECT, UPDATE
shop_product_variants [4]: authenticated DELETE, INSERT, SELECT, UPDATE
shop_products [4]: authenticated DELETE, INSERT, SELECT, UPDATE
shop_shipping_options [4]: authenticated DELETE, INSERT, SELECT, UPDATE
site_content_vertical_defaults [1]: authenticated SELECT
site_revisions [1]: authenticated SELECT
staff [3]: authenticated INSERT, SELECT, UPDATE
staff_services [4]: authenticated DELETE, INSERT, SELECT, UPDATE
template_slots [1]: authenticated SELECT
templates [1]: authenticated SELECT
tenant_domains [1]: authenticated SELECT
tenant_events [4]: authenticated DELETE, INSERT, SELECT, UPDATE
tenant_member_permissions [1]: authenticated SELECT
tenant_modules [5]: anon SELECT; authenticated DELETE, INSERT, SELECT, UPDATE
tenant_settings [3]: authenticated INSERT, SELECT, UPDATE
tenants [4]: authenticated DELETE, INSERT, SELECT, UPDATE
time_off [1]: authenticated SELECT
user_location_access [3]: authenticated DELETE, INSERT, SELECT
users [2]: authenticated INSERT, SELECT
verticals [1]: authenticated SELECT
working_hour_slots [4]: authenticated DELETE, INSERT, SELECT, UPDATE
working_hours [4]: authenticated DELETE, INSERT, SELECT, UPDATE
```

Den stora ökningen kommer från migrations 0114–0115: en tenantregel och en
partner-/plattformregel är separata permissive policies för samma roll/action.
Det är semantiskt OR och i huvudsak avsiktligt. Konsolidera inte allt på en gång;
det riskerar att ändra auktorisering. Börja med heta SELECT-tabeller
(`bookings`, `customers`, `staff`, `services`, `working_hours`) och de två rena
policyhygienfallen `role_permissions`/`tenant_modules`. För varje konsolidering
måste cross-tenant-, partner-, platform-, owner-, staff- och anon-matrisen vara
identisk före/efter.

[Advisor remediation 0006](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

### 5. Auth DB connections absolute — 1 P1 driftkonfiguration

Advisorn visar max 10 Auth-anslutningar med absolut tilldelning. En framtida
instance-upgrade ökar då inte Authkapaciteten. Byt till procentbaserad allokering
efter att nuvarande instance/poolbudget dokumenterats och belastningstestats.

[Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

## Rekommenderad sekventiell goal-ordning

Numren ska sättas mot den aktuella byggkön; skapa aldrig parallella goals.

1. **Supabase S1 — Auth och oanvänd API-yta.** Aktivera leaked-password
   protection med canary. Bevisa att appen inte använder Supabase GraphQL och
   avaktivera `pg_graphql` på branch/staging före prod; alternativt uppgradera och
   stäng introspection explicit. Kontrollera att REST/RPC fortsätter fungera.
2. **Supabase S2 — fail-closed function surface.** Återkalla default function
   EXECUTE för relevanta owner-roller, pina och smalgranta de tre 0054-funktionerna,
   och atomiskt återge exakt 7 anon/54 authenticated/service/Auth-hook allowlists.
   Detta är den viktigaste DB-migrationen.
3. **Supabase S3 — heta FK-index + policy initplan + Authpool.** Benchmarka och
   skapa första indexvågen, rätta `role_permissions`, byt Authpoolen till procent
   och mät efteråt.
4. **Supabase S4 — policykonsolidering i små vertikala slices.** Börja med heta
   lästabeller. Ett table/action-par per verifierad slice; inga massrewrites.
5. **Supabase S5 — lågprioriterad namespace/index hygiene.** Branchbevisa
   `btree_gist`-flytt och granska de 14 unused indexes över tillräcklig statistik-
   period. Acceptera dokumenterad exception där risk överstiger nytta.

S1 och S2 ska vara klara före provisioning→publish-lanseringen. S3 ska vara klar
före volympåslag. S4/S5 får inte blockera svensk pilot om mätvärden är friska och
allowlist-/isolationstesterna är gröna.

## Obligatoriska testkrav för goalsen

### Catalog/privileges

- Clean replay av 0001–ny migration på disposable Supabase.
- Testa `pg_default_acl` för både `postgres` och `supabase_admin`: ingen implicit
  function EXECUTE till `PUBLIC`, `anon` eller `authenticated`.
- Exakt allowlist: 7 anon- och 54 authenticated-executable SECURITY DEFINER;
  varje övrig sådan funktion ska ge `has_function_privilege(...)=false`.
- Alla SECURITY DEFINER och alla public-RPC:er ska ha pinad `search_path`.
- De tre 0054-funktionerna: anon/service nekas, authenticated tillåts, RLS bevaras.
- Varje public-tabell ska ha RLS; grants ska matcha 0108/0109 exakt.
- Varje private-tabell ska sakna direct privileges för `PUBLIC`, `anon` och
  `authenticated`, oavsett om RLS används.

### Negativa säkerhetstester

- Cross-tenant A→B för owner, staff, partner A→partner B och vanlig authenticated.
- Samtliga 54 RPC:er ska ha minst ett nekande test för fel roll/tenant/plats eller
  fel token, inte bara ett positivt happy path.
- De sju anon-RPC:erna ska testas för output-schema, maxgränser, token/UUID-
  fail-closed och frånvaro av PII.
- GraphQL: endpoint/introspection ska vara avstängd om S1 väljer disable; annars
  ska grants/RLS ge samma negativa resultat som REST.
- Auth: leaked-password canary, starkt lösenord, invite, reset och reauth.

### Performance/regression

- `EXPLAIN (ANALYZE, BUFFERS)` på representativa FK-delete/join-flöden före/efter
  varje indexvåg; dokumentera write-amplification och indexstorlek.
- RLS-matris före/efter varje policykonsolidering samt planjämförelse.
- Dubbelbokning/concurrency, PIN-claim, outbox-claim, partner-RLS,
  sajtpublicering och customer erasure ska fortsätta vara gröna.
- Rerun båda advisors och spara diff. Kvarvarande advisor-notices ska vara exakt
  namngivna, riskbedömda exceptions — inte en ospecificerad totalsiffra.

## Verifiering i denna audit

Följande source-/contracttester kördes read-only och gav **7 filer, 50 tester,
0 fel**:

```text
anonymous-intake-security.contract.test.ts
public-write-rpc-security.contract.test.ts
payment-rpc-security.contract.test.ts
pin-booking-migration.contract.test.ts
partner-scope-migration.contract.test.ts
booking-foundation-0078.contract.test.ts
site-revisions-0080.contract.test.ts
```

SQL-testerna lästes men kördes inte mot prod. Katalogfrågorna var rena SELECT.
