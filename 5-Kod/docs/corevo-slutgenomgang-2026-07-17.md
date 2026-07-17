# Corevo — slutgenomgång 2026-07-17

## Status

Arbetet finns på `codex/corevo-final-sweep` och är verifierat lokalt men inte
driftsatt. Produktionsdatabasen är verifierad till migration 0082; koden kräver
0083–0088. Production-workflowen stoppar därför före build tills operatören har
applicerat migrationerna och satt `PROD_DB_MIGRATION=0088`.

## Faktiskt ändrat

- Inställningar har ett gemensamt vertikalt `SettingsWorkspace`. Den dubbla
  horisontella inställningsnavigeringen är borttagen och gamla länkar redirectar
  till ägande yta. Tjänster, personal, schema, platser, bokningsregler, betalning,
  påminnelser, integrationer, konto och sekretess använder samma skal.
  Paket 04 är därmed tekniskt komplett enligt sin egen kanon: bara
  Bokningsregler, Tjänster och Konto är fullbyggda mönsterexempel; övriga
  kategorier ska behålla dagens verkliga innehåll i det nya skalet. Personal och
  Schema använder därför avsiktligt sina befintliga funktionskomponenter. En
  individuell visuell omdesign av dem är ett separat framtida designpaket, inte
  en kvarvarande lucka i 04.
- Inställningssökning, scope, sparning, laddning, fel och owner-only
  personalbehörighet är tenant-fenced. Manipulerad scope vid sparning avvisas.
  Mobilens kategori-/tillbaka-läge följer URL:en, alla fristående ägandeytor
  behåller skalet vid laddning/fel/tomt tenantläge och samma detaljerade
  sökindex används i Inställningar och Ctrl-K.
- Login-open-redirect, SVG-upload, publika tenant-CSS-sinks, PII-loggar och
  fail-open login-rate-limit är stängda. Lösenordsåterställning är tillagd.
- Anonyma kontakt-, offert- och kursflöden går genom validerad/rate-limitad
  serverkod. Direkta tabellgrants stängs i 0084. Publika skriv-/betal-RPC:er
  stängs i 0085.
- Kursanmälan på plats är atomisk och kapacitetslåst i 0086.
- Stripe-webhooken är fail-closed, idempotent och testad för success/refund/fel.
  Stripe API-version är pinnad.
- PayPal-captures mot terminal, felbelopp eller okänd order auto-refundas. Lokal
  order/payment-status speglas atomiskt i 0087. Presentkortsleverans kan retryas
  utan att kunden får ett falskt “betalningen avbröts”.
- Utgångna webshop-reservationer och `slot_holds` sveps av pending-expiry.
  Påminnelser claimas atomiskt med lease i 0088, och överlappande cron-körningar
  kan inte processa samma rad samtidigt.
- SMS är ärligt funktionsflaggat som ej levererande. Systemet ger inga falska
  leveransbesked och använder inte en död global kundportal-länk.
- Node 22 används lokalt/CI/deploy. CI kör unit/contract/build och har en
  obligatorisk lokal Supabase-jobb för migrationer + pgTAP/RLS. Full E2E förblir
  gated tills en seedad stagingmiljö finns.
- Realtime-bokningsklienten laddas bara på översikt, bokningar och personal, inte
  på Inställningar, kunder, tjänster eller plattformsadmin.
- Personalpanelen visar inte längre ett påhittat biofält. Oförändrat namn/plats
  kan inte skickas, kalenderfärgen skickas explicit och vald färg är låst.
  Permanent radering erbjuds bara när bokningsantalet är noll; annars bevaras
  historiken och inaktivering förklaras. Schemahoppet behåller personens plats.

## Verifiering

| Kontroll | Resultat |
|---|---|
| Unit/contract | 177 filer, 1 500 tester, alla gröna |
| Acceptanskontrakt 03/04/06 | 5/5 + 4/4 + 3/3 |
| TypeScript | Grön |
| ESLint | 0 fel, 7 äldre orelaterade varningar |
| Branschvakt | 0 nya fynd, 34 baseline |
| Kontrastvakt | 16 mallar, 0 brott |
| Production build | Grön, 59,1 s; kompilering 15,6 s |
| Diffkontroll | Grön |
| CodeRabbit | Webbappen granskad: 10 issues (6 major, 4 minor). Ett verifierat 04-major om destruktiv notis-merge är rättat och regressionstestat; 9 issues utanför 04 är kvar nedan. |
| Lokal pgTAP/RLS | Ej körbar: Supabase CLI och Docker saknas lokalt. CI-jobb tillagt. |
| Authenticated browser-E2E | Ej körd: lokal testwebbläsare saknade session och Chrome-kopplingen var otillgänglig. |

## Prestanda

Lokal produktionsmätning före de sista korrekthetsändringarna (samma kodrunda):

| Sida | Cold DCL/load | Transfer | Decoded |
|---|---:|---:|---:|
| Login | 265/361 ms | 197 908 B | 655 927 B |
| FreshCut storefront | 701/805 ms | 356 066 B | 1 383 373 B |

Warm load var 29 ms för login och 40 ms för storefront. Storefront-layoutens
oberoende dataladdningar är redan parallella och navigationsgating använder
count-frågor. Den mätbara ändringen i denna sweep är att realtime-bundle och
subscription inte längre laddas på icke-bokningssidor. Ingen ärlig tidsmässig
före/efter-jämförelse finns för exakt samma produktionsbuild, så sådan påstås inte.

## Kvar före första riktiga kund

1. Granska/applicera 0083–0088 med backup-checkpoint; verifiera grants, advisors
   och den avvikande live-reservationen (`reserved_qty=4` utan order).
2. Kör obligatorisk CI inklusive Supabase-jobbet och aktivera seedad staging E2E.
3. Kör Zivars autentiserade Inställningar-acceptans på desktop/mobil och rollerna
   ägare/personal, inklusive Personal → rätt person/plats i Schema. Goal 71 flyttas
   inte till klart före detta.
4. Verifiera Stripe Connect-webhook, email relay, SPF/DKIM/bounce och cron i skarp
   miljö. Flytta schemaläggning från GitHub Actions till durable trigger senare.
5. Verifiera Supabase backup-restore/PITR och R2-versionering/backup praktiskt.
6. Ta fram juridiskt granskade villkor, integritetstext, DPA, org.nr/moms på kvitto
   och retention för kontaktmeddelanden.
7. Bygg kundimport före migrering av en kund från annat bokningssystem.
8. Hantera CodeRabbits fem kvarvarande major-issues i kurskapacitetsfel,
   påminnelse-idempotens, presentkortsleveransens lease och PayPal-validering/
   timeout. Fyra minor gäller två testkontrakt, rejected cron-RPC och en
   inkonsekvent bildformatstext. Inget av de nio är i paket 04, men major-fynden
   ska verifieras innan hela slutgenomgångsgrenen driftsätts.

## Medvetet uppskjutet / kräver produktbeslut

- PLATSCHEF-roll och större behörighetsarkitektur.
- Global kundidentitet/“Mina företag” och admininitierad GDPR-radering över tenants.
- PayPal Partner-modell och tenantfakturering. PayPal v1 får inte slås på för
  externa kunder eftersom pengarna landar på plattformskontot.
- Full SMS-leverantör/kostnadsmodell, flerstegspåminnelser och no-show-avgift.
- Ägaradminens kontaktinkorg i navigationen; datalager/komponent finns men ingen
  kanonisk ägarnav-design har beslutats.
- Retention för `contact_messages`/`site_revisions`, privata R2-utkast och
  public-view/kolumnhärdning för de 18 avsiktligt publika tabellerna.
- Portfolio, meny, recurring, deposition och inlämning är roadmap-/previewnycklar,
  inte aktiverade produktmoduler. Rabattkoder, väntelista och klippkort är ej byggda.
- Rapportexport, fysisk POS, Mini-Planday och global kundhub är framtida produktdelar.

## Ärlig bedömning

| Område | Nu |
|---|---:|
| Repo-hygien och dokumentation | 92 % |
| Kodyta och sidstruktur | 90 % |
| Inställningar 04 — workspace/navigation/funktion | 100 % |
| Personal + Schema — individuell ny design | 65 % |
| Bokning, personal och schema | 82 % |
| Multi-bransch-motor | 80 % |
| Säkerhet, betalning och data-integritet | 78 % |
| Test och kvalitet | 77 % |
| Design 04–06 totalt | 76 % |
| Notiser och cron-drift | 70 % |
| Lanseringsgrindar | 64 % |

Samlad bedömning mot “en riktig kund kan onboardas, betala och drifta utan ständig
manuell hjälp”: **cirka 74 %**. Koden är betydligt stabilare än utgångsläget, men
juridik, extern driftverifiering, staging-E2E, import och tenantfakturering är verkliga
lanseringsgap och ska inte döljas bakom en högre procentsiffra.
