# PIN-verifierad bokning med SIM och e-postfallback

Status: godkänd design 2026-07-21
Aktuell leverans: Corevos befintliga Giada/Huawei/SIM-spår
Senare transport: Telia direkt REST eller SMPP bakom samma gatewaykontrakt

## Mål

Kunden ska aldrig kunna skapa en publik bokning innan den angivna kontaktvägen
har verifierats med en sexsiffrig PIN. När Giada och modemet är friska visas
telefonnummer och PIN skickas direkt via SMS. När gatewayen är nere visas i
stället e-post och samma PIN-flöde körs via Corevos befintliga e-posttransport.

En godkänd PIN skapar bokningen atomiskt och skickar bokningsbekräftelsen direkt
via samma kanal. Den befintliga 15-minuterscronen fortsätter enbart att planera
framtida påminnelser; den ligger inte i den normala vägen för PIN eller
bekräftelse.

## Avgränsning

Den här leveransen omfattar:

- automatisk växling mellan SMS och e-post innan kontaktfältet visas;
- fem minuters serverägt slot-hold;
- sexsiffrig PIN, fem verifieringsförsök och omskickscooldown;
- ingen bokning före verifiering;
- omedelbar PIN och omedelbar bekräftelse i samma befintliga Worker-request;
- Corevos enda `notifications_outbox` som audit-/leveranssanning;
- Giadas befintliga API-key-skyddade `/api/v1/messages` och lokala SQLite-kö;
- automatisk fallback till e-post om SMS inte kan accepteras före bokning;
- driftkontroll av API, worker, tunnel, modem, default route och backup;
- ett transportkontrakt som senare kan byta Huawei/SIM mot Telia utan att
  bokningsflödet byggs om.

Följande byggs inte nu:

- globalt kundkonto, PWA-installationsfråga eller ”Mina ställen”;
- alfanumeriskt Sender ID via konsument-SIM;
- flera samtidiga SIM/eSIM eller ett modem per tenant;
- marknadsförings-SMS;
- ny Cloudflare Worker, Queue, Durable Object eller crontrigger;
- Telia-adapter innan avtalets riktiga auth-, Sender ID- och DLR-kontrakt finns.

## Kundflöde

```text
Välj tjänst -> person -> tid -> kontrollera Giada
                                     |
                       +-------------+-------------+
                       |                           |
                 modem friskt                 modem nere
                       |                           |
                 namn + telefon                namn + e-post
                       |                           |
                  skicka SMS-PIN              skicka e-post-PIN
                       |                           |
                       +-------------+-------------+
                                     |
                               skriv sex siffror
                                     |
                         fel/utgången  |  korrekt
                                      v
                       skapa bokning + bekräftelse
```

### Kontaktsteget

Webbläsaren frågar aldrig Giada direkt. En server action gör en kort
server-till-server-kontroll mot `https://sms.corevo.se/health` och kräver:

- HTTP 200 inom 1,5 sekunder;
- `status = ok`;
- `modem_online = true`;
- färsk modemstatus.

Om alla villkor är sanna visas namn + telefon. Annars visas namn + e-post.
Kontrollen kostar ingen ny Worker-invocation; den är en utgående subrequest i
den sidrequest som redan körs.

Hälsa är en ögonblicksbild. Därför skickas SMS-PIN med
`require_online=true`. Om Giada svarar att modemet hunnit gå ned skapas ingen
SMS-körad, SMS-challengen ogiltigförklaras och samma vy byter till e-post utan
att kunden tappar vald tjänst, person eller tid.

### PIN-vyn

- Sex numeriska positioner med ett semantiskt `input` och visuell uppdelning.
- Maskerad destination, exempelvis `07•• ••• ••19` eller `zi•••@example.se`.
- ”Ändra nummer/e-post” ogiltigförklarar aktuell challenge.
- Omskick tillåts efter 30 sekunder och ogiltigförklarar alltid föregående PIN.
- PIN gäller i fem minuter och högst fem felaktiga försök.
- Fel, utgången PIN eller uttömda försök skapar ingen bokning.
- När holdet går ut återgår kunden till tidsvalet med en tydlig förklaring.

## Datamodell och atomisk sanning

### Privat challenge

En ny tabell i `private` lagrar endast den kortlivade verifieringsprocessen:

```text
booking_verification_challenges
  id
  tenant_id
  service_id
  staff_id
  location_id
  start_ts
  request_id
  contact_channel       sms | email
  contact_value         normaliserad telefon/e-post, privat och kortlivad
  guest_name
  guest_note
  pin_hmac              HMAC-SHA-256, aldrig klar PIN
  attempts
  max_attempts          5
  expires_at            skapad + 5 minuter
  consumed_at
  invalidated_at
```

Tabellen exponeras inte genom Supabase Data API. `anon` och `authenticated` har
inga grants. Endast smala `SECURITY DEFINER`-RPC:er med låst `search_path`,
explicit service-role-kontroll och återkallad `PUBLIC EXECUTE` får använda den.

Klar PIN existerar endast i Worker-minne medan meddelandet byggs. HMAC-underlaget
innehåller challenge-ID, tenant-ID, normaliserad kontakt och PIN samt signeras
med Worker-secreten `BOOKING_PIN_PEPPER`. Samma candidate-HMAC skickas till den
atomiska verifierings-RPC:n; databasen behöver aldrig pepper eller klar PIN.

Lyckad verifiering sker i en enda transaktion:

1. lås challenge och kontrollera expiry, attempts och invalidation;
2. jämför candidate-HMAC;
3. kontrollera att slot-hold fortfarande tillhör challengen;
4. skapa bokningen genom samma valideringar som
   `create_storefront_booking_with_release`;
5. konsumera challenge och hold;
6. skapa exakt en `booking_confirmation` eller `booking_request_received` i
   `notifications_outbox` med challengekanalen;
7. returnera booking-ID, status och outbox-ID.

Fel PIN ökar `attempts` atomiskt. Samma challenge kan bara konsumeras en gång.
Samma `request_id` ger samma slutresultat efter ett förlorat nätverkssvar.

### Slot-hold

Den redan driftsatta `slot_holds` och dess service-role-RPC återanvänds. Den
nya start-RPC:n tar ett transaktionslås per personal/tidsfönster, avvisar andra
aktiva överlappande holds och skapar challenge + hold tillsammans.

Publik availability filtrerar aktiva holds. Adminbokning behåller sin befintliga
slutliga DB-constraint; om en administratör hinner boka tiden ska PIN-verifieringen
returnera `slot_taken`, aldrig skapa en dubbelbokning.

## En outbox, direkt transport

`notifications_outbox` förblir den enda notifieringssanningen. Ingen `sms_jobs`
eller parallell Supabase-kö skapas.

### PIN

Start-RPC:n skapar en outboxrad med challenge-ID, kanal och mallnamn men utan
PIN eller full kontakt i payloaden. Server action CAS:ar raden till
`delivery_started`, skickar den klara PIN-koden direkt och kvitterar raden som
`sent`/`failed`. PIN-rader auto-retryas inte eftersom klar PIN inte lagras;
kunden begär i stället en ny challenge.

### Bokningsbekräftelse

Verifierings-RPC:n skapar bokning och bekräftelse-outbox atomiskt. Server action
claimar exakt den returnerade raden och skickar den direkt innan UI:t går till
bekräftelsen. Giadas idempotency key är `outbox:<uuid>`, så samma omedelbara
retry kan aldrig skapa två lokala SMS-jobb.

Normalvägen väntar aldrig på 15-minuterscronen. Om processen kraschar efter
booking-commit men innan transport finns outboxraden kvar för avstämning och
recovery; den påverkar inte att bokningen redan visas sanningsenligt på skärmen.

## Giada-kontrakt

Corevo använder endast HTTPS-tunneln och två server-till-server-anrop:

```text
GET  /health
POST /api/v1/messages
X-API-Key: <Worker-secret>
```

Meddelandet till `/api/v1/messages` innehåller:

```json
{
  "to": "+46701234567",
  "message": "Din kod är 123456",
  "idempotency_key": "outbox:uuid",
  "customer_ref": "challenge-or-booking-uuid",
  "require_online": true,
  "sender_id": null
}
```

Huawei-providern ignorerar `sender_id` och mobilnätet visar SIM-numret.
Fältet finns i kontraktet för den framtida Telia-providern. API:t avvisar
`require_online=true` med 503 innan enqueue om modemstatus är offline eller
för gammal.

API-nyckeln lagras hashad på Giada och som Cloudflare Worker-secret
`SMS_GATEWAY_API_KEY`. URL:n är en vanlig servervariabel. Nyckel, PIN,
telefonnummer och meddelandetext får aldrig loggas.

## E-postfallback

Fallbacken använder Corevos befintliga `sendEmail` och relay-secret; ingen ny
e-postleverantör byggs. PIN skickas direkt med en kort transaktionell mall.
Efter verifiering skickas befintlig bokningsbekräftelse via e-post.

Vald kanal fryses på challengen. En e-postverifierad bokning får inte senare ett
försenat SMS från den ogiltigförklarade SMS-challengen.

## Cloudflare-belastning

Ingen ny Worker eller cron skapas. Varje kundsteg använder den befintliga
Next/OpenNext-requesten:

```text
visa kontaktsteg       1 befintlig request + högst 1 health-subrequest
skicka PIN             1 befintlig action + högst 1 transport-subrequest
verifiera PIN          1 befintlig action + DB-RPC + bekräftelsesubrequest
```

Det ligger långt under Cloudflares gräns på 50 subrequests per invocation på
Free-planen. Den befintliga cronen `*/15 * * * *` fortsätter ge 96 schemalagda
invocations per dygn och ska inte ökas för PIN-flödet.

Officiell referens: `https://developers.cloudflare.com/workers/platform/limits/`.

## Drift och fallback

Giadas befintliga systemd-enheter behålls:

- API och ensam modem-worker;
- health varje minut;
- fast-forward-update var femte minut med tester och rollback;
- daglig SQLite-backup;
- cloudflared med automatisk omstart;
- Huawei-skydd som hindrar USB-modemet från att ta default route eller DNS.

Healthcheck utökas minimalt till att kontrollera `cloudflared` och den externa
tunnelvägen utan att skriva credentials eller PII. Webbplatsens automatiska
e-postfallback är kundens driftreserv; en permanent lokal AI-process behövs inte.

## Framtida Telia-byte

Bokningsflödet anropar alltid samma Giada-kontrakt. När Telia-avtalet kommer
byts endast gatewayprovidern och dess credentials:

```text
nu:       Corevo -> Giada -> Huawei/SIM -> mobilnät
senare:   Corevo -> Giada -> Telia REST/SMPP -> mobilnät
```

Om Telia endast erbjuder ett Sender ID används exempelvis `COREVOBOOK` globalt.
Om avtalet erbjuder dynamiska Sender ID:n aktiveras det redan förberedda
`sender_id`-fältet från en superadmin-godkänd tenantkonfiguration. Ett oskyddat
kund-/requestfält får aldrig styra avsändaren.

Flera SIM/eSIM per tenant är en separat kapacitetsmodell som kräver flera
modemkanaler och routing. Den byggs först när en verklig kund behöver den;
Telia-spåret kräver inget SIM per tenant.

## Acceptans

- [ ] När Giada/modemet är friskt visas telefon och SMS-PIN accepteras direkt.
- [ ] När Giada/modemet är nere visas e-post innan kunden skriver kontaktuppgift.
- [ ] Om SMS faller mellan health och send byter samma intent till e-post.
- [ ] Ingen bokning finns före korrekt PIN.
- [ ] Fel, utgången, gammal eller förbrukad PIN skapar ingen bokning.
- [ ] Ny PIN ogiltigförklarar tidigare PIN.
- [ ] Aktivt hold hindrar en annan publik kund från att ta samma tid.
- [ ] Verifiering + bokning + confirmation-outbox är en DB-transaktion.
- [ ] Samma request/outbox-ID kan inte skapa dubbelbokning eller dubbelt SMS.
- [ ] PIN och bokningsbekräftelse startas direkt, aldrig av 15-minuterscronen.
- [ ] `notifications_outbox` är enda Supabase-kö/ledger.
- [ ] Giada har inga Supabase-credentials.
- [ ] Worker-secrets, PIN, telefon, e-post och meddelandetext saknas i loggar/Git.
- [ ] Tangentbord, autofill, skärmläsare, fokus och felmeddelanden fungerar.
- [ ] E-postfallback och SMS-vägen har automatiserade tester utan externa utskick.
- [ ] Ett separat, uttryckligt canarygodkännande krävs för första riktiga SMS.
