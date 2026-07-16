# Kundadmin – djupgranskning 2026-07-16

## Omfattning

Granskningen omfattade hela ägar-/adminytan mot den verkliga FreshCut-tenanten:
dokumentation, appkod, migrationshistorik, live-databas, desktop, mobil/PWA och
verkliga skrivflöden. Kundportalen byggdes inte om. FreshCut verifierades som en
bokningskund; webshop, offert, blogg, lojalitet, presentkort och kurser är avstängda
och deras adminytor visar detta i stället för påhittade data. Stripe är inte anslutet,
så betalningsvarningar och onlinebetalningskrav visas inte.

## Datakedjan för bokningsbar personal

En bokningsbar tid kräver hela kedjan nedan. UI:t visar nu samma sanning som DB:n,
och databasen är slutlig spärr även om någon anropar API:t utan gränssnittet.

1. Aktiv tenant och plats.
2. Aktiv personal på samma tenant/plats.
3. Aktiv tjänst kopplad via `staff_services`.
4. Arbetspass för rätt veckodag i `working_hours`.
5. Publik/kundbokning följer explicit start eller raster; admin/personals walk-in får
   använda valfri minut inom arbetspasset.
6. Tid, tjänstelängd, frånvaro, befintlig bokning och buffert valideras atomiskt.

FreshCut hade fem aktiva resurser och sju aktiva tjänstekopplingar per resurs. Zivar
hade bara måndag på primärplatsen; därför var avsaknaden av tider övriga dagar korrekt
data, inte en kalenderbugg. Ny personal får nu automatiskt aktiva tjänster samt
måndag–fredag 09–17 i en enda transaktion, så en ny rad kan inte bli halvkonfigurerad.

## Åtgärdade fel

| Område | Före | Efter |
|---|---|---|
| Adminbokning | Ny kund kunde fastna i otydligt sökläge och bokningen såg trasig ut. | Separata debounce-/sök-/fel-/tomlägen, stale-request-skydd och verklig bokning med ny kund verifierad. |
| Tillgänglighet | UI-spärrar kunde kringgås och buffert/raster var inte en gemensam DB-sanning. | Atomisk trigger för resurser, längd, schema, frånvaro, krock, buffert och advisory lock. |
| Bokningslängd | En aktiv rad kunde uppdateras till godtycklig längd och personalombokning använde tjänstens senare ändrade längd. | Längdsnapshot är oföränderlig och både admin/personal bevarar bokningens ursprungliga längd vid flytt. |
| Bokningsskrivning | Roll 3+ kunde göra rå `UPDATE` och hoppa över appens refund-/spårflöde. | Authenticated får bara lägga in nya walk-ins; alla befintliga bokningsändringar går genom verifierade serveractions. |
| Historik | Slutförda besök erbjöds som flyttbara trots DB:ns historikregel. | Endast pending/confirmed kan ombokas eller dras. |
| Betalning | Stripe-webhook kunde lämna lyckad betalning och pending-bokning isär. | Betalning + bekräftelse sker atomiskt i `confirm_booking_payment`; regeln aktiveras bara när Stripe faktiskt är på. |
| Personal/schema | Flerstegs-delete/insert kunde lämna halv status, halv tjänstelista eller halv backup. | Atomiska RPC:er för skapa, aktivera, tjänstekopplingar och schemaåterställning. |
| Behörighet | Tenant-claim och rollnivå kunde leva kvar efter inaktivering/rollbyte. | `private.tenant_id()`, roll och plattformsbehörighet verifieras mot aktiv DB-rad; inaktiv personal tappar åtkomst. |
| Publika RPC:er | Supabase default privilege exponerade ägar-RPC:er för `anon` trots intern owner-vakt. | `anon EXECUTE` är uttryckligen återkallat och live-verifierat. |
| Tenantgräns | En inloggad roll 3+ kunde få adminundantag för fria startminuter även när bokningens tenant var en annan. | Undantaget kräver service role eller att JWT-tenanten exakt matchar bokningens tenant. |
| Gästavbokning | Tokenlänken satte status men saknade avbokningstid och aktör. | Självservice sparar nu `cancelled_at`, `cancelled_by=customer` och uppdaterar endast samma tenants aktiva bokning. |
| Kunder/sök | Global sök var främst navigation och tomt/fel kunde blandas ihop. | Tenant-scopade verkliga kunder och bokningar, tydliga loading/error/empty-lägen och direktlänk till rätt dag/kundkort. |
| Domän/länk | ”Min sida” kunde falla tillbaka till fel värd. | Verifierad primärdomän används i portal och plattformsdetalj. |
| Mobilkalender | Personfilter och kalenderverktyg var svåra att tolka. | Kompakt dag/vecka/månad, idag/navigering, märkta verktyg och tryck på namn för en person; tryck igen återställer alla. |

Migrationsfiler: `0071_role_aware_admin_rls.sql`,
`0072_booking_availability_fence.sql`, `0073_atomic_staff_schedule_admin.sql`,
`0074_admin_rpc_execute_fence.sql` och `0075_same_tenant_booking_admin_fence.sql`.

## Verifiering

- Live rollback-test: rå authenticated boknings-UPDATE gav 0 rader.
- Live rollback-test: adminbokning 10:07 inom arbetspass accepterades.
- Live rollback-test: ändrad tjänstelängd stoppades av
  `booking_duration_snapshot_immutable`.
- Live rollback-test: ny personal fick aktiv rad, alla aktiva tjänster och exakt fem
  vardagspass; allt rullades tillbaka.
- Live DB-verifiering: adminundantaget i `assert_booking_available` kräver nu samma
  tenant och känsliga admin-RPC:er saknar fortfarande `anon EXECUTE`.
- Lokal verklig E2E: skapade `Codex Sluttest 20260716` som ny kund, bokade 30 minuter,
  hittade kund + bokning i global sök, öppnade kundkort, avbokade och dolde kunden.
  Live DB bekräftade `cancelled_by=business`, tidsstämpel, 30-minuterslängd och
  `hidden_at`.
- Mobil 390×844: kalender, bottennavigering, dag/vecka/månad, idag/bläddring,
  verktygsnamn och personfilter fram/åter verifierade visuellt och funktionellt.
- 18 adminrutter öppnade med riktig session utan serverfel eller login-redirect.
- Vitest: 113 filer, 1184 tester gröna.
- TypeScript: `tsc --noEmit` grön.
- ESLint: 0 fel; 7 sedan tidigare kända varningar utanför ändringsytan.
- Next production build: grön.
- Aktuell webbläsarkonsol efter ren omstart: 0 errors/warnings.

## Kända separata driftpunkter

Supabase Advisor har äldre, plattformsövergripande varningar om GraphQL-synlighet,
överlagrade läspolicies, tre äldre funktioner utan låst `search_path`, lösenordsskydd
och publika token-/boknings-RPC:er som avsiktligt används av storefront. De nya
admin-RPC:erna har ingen anon-behörighet. Återstående advisorposter kräver en egen
plattformsrevision eftersom de berör alla vertikaler och ska inte ändras inne i
FreshCuts kundadminrelease utan separat kompatibilitetsprovning.
