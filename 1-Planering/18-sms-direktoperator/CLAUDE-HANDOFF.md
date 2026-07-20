---
artifact_contract: "ce-handoff/v1"
created_at: "2026-07-20T21:17:41.1308469Z"
title: "Corevo direktoperatörs-SMS och verifierad kundresa"
summary: "Bygg egen direktoperatörstransport utan CPaaS, REST först och SMPP bara vid bevisat behov, kopplad till Corevos enda outbox och följd av PIN före bokning."
keywords: ["corevo", "sms", "rest", "smpp", "a2p", "otp", "sender-id", "booking"]
cwd: "C:\\Users\\Zivar-PC\\Desktop\\firsör-sas"
resume_focus: "Läs kanondokumentet, jämför alla fyra nätägare, invänta det verkliga kontraktet och bygg REST-provider först utan en parallell sms_jobs-kö."
repository: "Corevo-hosting"
repo_root_sha: "60f60fbc72be0df2ebc757b2d8ebffe94d78aa7d"
branch: "main"
head: "f17ae966b1cc82066ae1000bc09ef82d6b4ec969"
worktree_path: "C:\\Users\\Zivar-PC\\Desktop\\firsör-sas"
---

# Handoff till Claude Code — direkt SMSC, Sender ID och kundflöde

## Läs först

1. `AGENTS.md`
2. `HANDOFF.md`
3. `1-Planering/18-sms-direktoperator/00-BESLUT-ARKITEKTUR-BYGGPLAN.md`
4. `5-Kod/apps/web/lib/notifications/outbox.ts`
5. `5-Kod/apps/web/lib/notifications/sms.ts`
6. `5-Kod/apps/web/lib/notifications/booking-delivery.ts`
7. `5-Kod/docs/ops/sms-activation.md`

Huvuddokumentet ovan är kanon för beslut, operatörsbeställning, arkitektur,
säkerhet, byggordning och acceptans. Improvisera inte en annan SMS-kö eller en
annan identitetsmodell utan ett nytt uttryckligt beslut.

## Uppdraget

Corevo ska skicka transaktionella SMS med tenantens godkända företagsnamn som
alfanumeriskt Sender ID. Gateway och kod ägs av Corevo. Transportgränsen är ett
direkt A2P/Bulk-avtal med en mobiloperatör. Samma förfrågan går till Telia,
Tele2/Comviq, Telenor/Vimla och Tre/Hi3G/Hallon. Direkt REST är första tekniska
valet när kraven klaras; SMPP öppnas bara på ett mätt eller avtalat behov.
46elks/Twilio/LINK ska inte vara den långsiktiga lösningen.

Efter transporten ska kundresan byggas så här:

```text
slot hold -> SMS-PIN -> verifiera -> atomisk bokning -> bekräftelse-SMS
-> säker magic link -> tenantbunden kundvy -> boka igen/PWA
```

Fullt konto och globala “Mina ställen” är en senare fas.

## Får inte brytas

- `notifications_outbox` är den enda beständiga meddelandekön.
- Skapa inte `sms_jobs` eller en separat retry-/statussanning i gatewayen.
- Befintlig Worker-dispatcher är enda outbox-consumer. Transportgatewayen får
  inga Supabase-credentials och läser inga kundtabeller.
- Ett Comviq-SIM/Huawei-modem kan inte leverera alfanumeriskt Sender ID.
- Köp inte ett annat modem för att lösa Sender ID.
- Tenantens avsändarnamn måste komma från godkänd serverkonfiguration.
- Ingen bokning får skapas före rätt PIN.
- Ingen extern/live SMS-trafik utan separat Zivar-godkänd canary.
- `SMS_DELIVERY_MODE` ska fortsätta vara `off` under bygge och automatisk test.
- Secrets och PII får inte committas eller loggas.
- Corevo är multi-bransch; bygg inget frisörspecialfall.
- Följ tenantgränser, RLS och etablerade server-only RPC-mönster.

## Befintliga byggblock

- Kanonisk outbox/lease/CAS:
  `5-Kod/apps/web/lib/notifications/outbox.ts`
- Befintlig 46elks-adapter och Sender ID-normalisering:
  `5-Kod/apps/web/lib/notifications/sms.ts`
- Bokningsmeddelanden, tenantnamn och kundlänkar:
  `5-Kod/apps/web/lib/notifications/booking-delivery.ts`
- Dispatcher/cron:
  `5-Kod/apps/web/app/api/cron/notifications/route.ts`
- `slot_holds`, `place_slot_hold`, `release_slot_hold`, `prune_expired_slot_holds`:
  `5-Kod/supabase/migrations/0105_restore_deferred_schema_contracts.sql`
- Befintlig aktiverings-/rollbackmodell, fortsatt avstängd:
  `5-Kod/docs/ops/sms-activation.md`

## Verifierad lokal modemstatus 2026-07-20

- Huawei/Brovi `E3372-325` HiLink svarar på `http://192.168.8.1` via USB NDIS.
- Operatören identifieras som Comviq och den skrivskyddade SMS API-kontrollen svarar.
- Kontrollvärden: RSRP `-82 dBm`, RSRQ `-10 dB`, SINR `16 dB`.
- Ingen inställning ändrades och inget test-SMS skickades.
- SIP ALG/port `5060` i modemets UI är SIP-telefoni och har inget med SMPP att göra.
- Använd modemet endast för nummerbaserat reserv-/lokalspår. REST/SMPP går från
  driftservern direkt till operatören och ska inte routas genom modemet.

Operatörspriset är ännu okänt eftersom publika direktprislistor saknas. Bygg
inget som antar ett segmentpris, en fast avgift eller ett minimiåtagande; invänta
offerten och lägg priser i drift-/affärskonfiguration, inte hårdkodat i transporten.

## Lokalt arbetsunderlag — inte kanon

Repo-roten innehåller lokala otrackade mappar `corevo-sms/` och
`sms-gateway-research/`. De tillhör Zivars arbetsunderlag och får inte läggas till
i Git i sin helhet.

`corevo-sms/` har användbara idéer:

- providerabstraktion och capability `SENDER_ID`;
- Huawei HiLink-provider som korrekt saknar custom Sender ID/DLR;
- ModemManager-provider;
- framtida SMPP-noteringar om bind, keepalive, submit, DLR och throttling.

Men dess Supabase-poller/`sms_jobs`-förslag strider mot Corevos kanoniska outbox.
Återanvänd endast granskade delar och anpassa dem till plattformens befintliga
claim/lease/begin/ack-kontrakt.

## Aktuell worktree-varning

Följande lokala ändringar fanns när handoffen skrevs och tillhör en separat fix
för synliga bokningstider:

- `5-Kod/apps/web/app/boka/actions.ts`
- `5-Kod/apps/web/lib/booking/tz.ts`
- `5-Kod/apps/web/lib/booking/tz.test.ts`

Skriv inte över, stasha inte och committa inte dem tillsammans med SMS-arbetet.

## Första tekniska leveransen

Bygg inte hela kundportalen i första committen. Börja med en isolerad,
testdriven providergräns som kan ta:

```text
outbox_id, attempt_id, tenant_id, to_e164, sender_id, message, correlation_id
```

och returnera:

```text
accepted(provider_message_id) | retryable(error) | permanent(error) | unknown
```

Leveransen ska innehålla:

1. `sender_id` genom hela providergränsen.
2. Central policy för högst 11 säkra tecken och superadmin-godkänd tenantkälla.
3. Fake-operatör för REST och fake-SMSC för eventuell SMPP: accept, timeout,
   throttle, DLR, restart och felkoder.
4. Direkt REST-provider bakom interfacet. SMPP-provider byggs endast om ett mätt
   krav eller operatören kräver det.
5. Mappning till befintlig outbox utan parallell tabell.
6. Noll riktiga nätanrop i CI och `off` som fail-closed standard.

Open-source-ordningen gäller endast om SMPP-grinden öppnas:

1. Jämför en tunn `smpp-core`-baslinje med Sendium mot samma conformance- och
   kraschtest.
2. Jasmin mot exakt samma suite om Sendium faller.
3. Välj tunn adapter om fullgatewayen inte kan underordnas Corevos
   outboxsemantik eller endast kvitterar en egen intern kö.
4. Kannel och modem-/Windows-listan ska inte användas för det nya Sender ID-spåret.

Verifiera GPL-3.0-konsekvenserna för Sendium och säkerställ att dess interna
queue/retry inte skapar dubbelsändning eller en andra sanningskälla. Jasmins
AMQP/Redis-store-and-forward har samma arkitekturrisk trots Apache-2.0.

Den valda operatörens verkliga credentials, service-ID, kvoter och avtalsregler
är externa blockers. Hårdkoda inte antaganden som operatören ännu inte bekräftat.

## Kritiska repofynd som måste lösas i PIN-fasen

- Befintliga `slot_holds` stoppar inte bevisligen alla bokningsskrivvägar;
  `create_storefront_booking_with_release` och övriga paths ska omfattas.
- Challenge + hold + OTP-outbox ska vara atomiskt. Efter korrekt PIN ska
  booking commit + confirmation-outbox vara en annan atomisk RPC.
- `guest_email` är i nuläget obligatoriskt i delar av flödet och måste bli
  valfritt genom UI, actions, RPC och DB för telefon-first.
- OTP-rader behöver `expires_at`, direkt wake och subminut-recovery så en gammal
  PIN aldrig skickas.
- `record_sms_delivery` är 46elks-specifik och ska generaliseras till
  `(provider_key, provider_message_id)` utan att legacy bryts.

## Oberoende verifiering före merge

- Läs hela diffen mot AGENTS/HANDOFF och huvudplanen.
- Bevisa med test att tenant A inte kan använda tenant B:s Sender ID.
- Bevisa att Huawei inte annonserar `SENDER_ID`.
- Bevisa REST-auth/accept/DLR/timeout; om SMPP byggs, bevisa alpha TON/NPI och
  E.164 TON/NPI mot fake-SMSC.
- Bevisa restart/timeout utan blind dubbelsändning.
- Bevisa DLR-korrelation utan telefonnummer eller text i logg.
- Bevisa att `off` gör noll socket-/HTTP-anrop.
- Kontrollera att ingen `sms_jobs`-migration eller service-role-bred poller tillkom.
- Kontrollera att eventuella nya Supabase-objekt har explicita minimala grants,
  RLS där tabeller exponeras, privata hjälpfunktioner och security-advisor-bevis.
- Kör relevanta tester, typecheck, lint och build enligt `HANDOFF.md`.
- Pusha för granskning; aktivera inte operatörstrafik.

## Extern nästa åtgärd för Zivar

Skicka den färdiga operatörsförfrågan i huvudplanen till alla fyra nätägare:
Telia, Tele2, Telenor och Tre/Hi3G. Telenor har en offentlig SMS/API/SMPP-väg;
Tre måste först bekräfta om en direkt svensk A2P-produkt erbjuds. När avtalsbilaga,
teknisk specifikation och testcredentials kommer granskas de mot samma frågelista
innan implementationen låses. Secrets läggs i driftens secret store, aldrig här.
