# Direkt operatörs-SMS, verifierad bokning och kundens återkomst

Status: beslutad riktning, extern operatörsanslutning återstår
Beslutsdatum: 2026-07-20
Produkt: Corevo, generell multi-bransch-plattform
Ägare: Zivar

Detta dokument är kanon för Corevos framtida SMS-transport och den första
kundresan efter en bokning. Det ersätter inte ett aktivt goal och aktiverar
ingenting i produktion. `SMS_DELIVERY_MODE` ska förbli `off` tills separat canary
är uttryckligen godkänd.

## Svaret i en bild

```text
DET SOM FINNS NU                         DET SOM KRÄVS FÖR NAMN

Corevo -> Huawei-modem -> Comviq-SIM     Corevo -> egen gateway -> operatörens SMSC
                              |                                      |
                              v                                      v
                    avsändare: telefonnummer               avsändare: FRESHCUT
                    alpha-namn: NEJ                         alpha-namn: JA

Ett bättre modem ändrar inte detta. Namnet sätts i operatörens A2P/SMSC-led,
inte av SIM-kortet eller radiomodemet.
```

## Verifierat modem 2026-07-20

En skrivskyddad kontroll från Zivars dator bekräftade:

| Del | Resultat |
|---|---|
| Modell | Huawei/Brovi `E3372-325`, LTE HiLink |
| Lokal adress | `http://192.168.8.1` via USB Remote NDIS |
| Operatör | Comviq (`24007`) |
| Signal vid kontroll | RSRP `-82 dBm`, RSRQ `-10 dB`, SINR `16 dB` |
| HiLink SMS-API | svarar på den skrivskyddade `sms-count`-kontrollen |
| Ändringar/testutskick | inga inställningar ändrades och inget SMS skickades |

Modemet är alltså nåbart och passar det befintliga nummerbaserade reservspåret.
Det behövs inte för REST eller SMPP: direktoperatörstrafiken går från Corevos
server över internet till operatören. Bildens SIP ALG och port `5060` gäller
internettelefoni, inte SMPP, och ska inte öppnas eller ändras för SMS-projektet.

## Låsta beslut

1. Corevo ska inte bygga sin långsiktiga SMS-transport ovanpå en CPaaS-återförsäljare
   som 46elks, Twilio eller LINK Mobility.
2. Corevo äger gatewaykod, kö, statusmodell, retry, idempotens, loggning och
   produktflöden.
3. Själva leveransen till svenska mobilnät kräver ändå ett avtal och en teknisk
   anslutning till en mobiloperatörs A2P-/Bulk Messaging-plattform. Detta är
   nätgränsen, inte en ersättningsbar kodmodul.
4. Ett vanligt Comviq-SIM i Huawei-modemet kan fortsätta som nummerbaserad reserv
   och för inkommande SMS. Det kan inte skicka valfritt alfanumeriskt avsändarnamn.
5. Ingen ny modemmodell ska köpas för att lösa Sender ID. Ingen modemmodell kan
   ge `FRESHCUT` via ett vanligt konsument-SIM.
6. Avtalsförfrågan går till samtliga fyra svenska mobilnätsägare: Telia,
   Tele2/Comviq, Telenor/Vimla och Tre/Hi3G/Hallon. Telia är första tekniska
   kandidat eftersom den offentliga direktdokumentationen är mest komplett;
   operatör väljs först efter samma skriftliga krav- och pristest.
7. Corevo måste beställa dynamiskt alfanumeriskt Sender ID, inte ett enda låst
   Corevo-namn. Varje godkänd tenant ska kunna använda sitt salongs-/företagsnamn,
   högst 11 tecken.
8. `notifications_outbox` är plattformens enda beständiga meddelandekö. Det får
   inte skapas en parallell `sms_jobs`-tabell eller en andra sanningskälla.
9. PIN-verifiering sker före att bokningen går igenom. En felaktig eller
   overifierad telefon får varken bokning, bekräftelse eller påminnelser.
10. Efter bokningen ska bekräftelse-SMS:ets säkra länk vara den enkla dörren
    tillbaka till bokningen. Fullt konto är inte ett krav i första versionen.
11. Tenantens Sender ID får aldrig komma direkt från ett oskyddat requestfält.
    Det hämtas från serverns godkända tenantkonfiguration och valideras centralt.
12. Inga credentials, bind-lösenord, telefonnummer eller kunduppgifter får
    committas till Git.
13. Corevos befintliga Worker-dispatcher är enda komponent som claimar
    `notifications_outbox`, läser boknings-/kunddata och skapar magic links.
    Transportgatewayen får inga Supabase-credentials.
14. Telias direkta REST API är första transportvalet om avtalet bekräftar
    dynamiskt tenant-Sender ID, DLR och tillräcklig kapacitet. SMPP används först
    när operatören kräver det eller REST faller på ett mätt krav.
15. En transportkvittens betyder inte `accepted` förrän operatörens SMSC/API har
    accepterat meddelandet. En sidecars interna HTTP 202 eller lokala kö räcker inte.

## Vad användaren faktiskt ser

```text
Välj tjänst -> välj person -> välj tid -> namn + mobilnummer
                                           |
                                           v
                                  "Skriv PIN-koden från SMS"
                                           |
                          fel/utgången -----+----- rätt kod
                          ingen bokning             |
                                                   v
                                      bokningen skapas atomiskt
                                                   |
                                                   v
                        SMS från SALONGSNAMN med bekräftelse + säker länk
                                                   |
                                                   v
                         Mina bokningar, avboka, kalender, boka igen
                                                   |
                                                   v
                   fråga om hemskärmsinstallation vid högst två tillfällen
```

## Vad vi köper och vad vi bygger

| Del | Corevo bygger/äger | Operatören tillhandahåller |
|---|---|---|
| Produktflöde | PIN, bokning, magic link, kundvy, PWA | — |
| Kö | `notifications_outbox`, lease, retry, ack | — |
| Gateway | autentiserad transportadapter, providerpolicy, DLR-mappning; SMPP-session endast om SMPP-spåret aktiveras | — |
| Avsändare | tenantval, policy, godkännande, 11-teckensnormalisering | tillåter/routar Sender ID |
| Transport | submit, status, observability | SMSC, interconnect och terminering till mobilnäten |
| Drift | server, statisk publik IP, secrets, larm, kill switch | konto, trafikgränser, support och nätfel |

Det går alltså att slippa betala en tredje parts plattformspåslag och ändå äga
hela gatewayen. Det går inte att undvika mobiloperatörernas nät-/termineringskostnad
för SMS till vanliga telefoner. Alternativet vore att själv bli nätoperatör med
interconnectavtal, vilket är en helt annan verksamhet och inte ett modemprojekt.

## Vad kostar direkt REST/SMPP?

SMPP är ett protokoll, inte ett abonnemang. Corevos egen kod och ett självhostat
open-source-alternativ kan sakna programlicensavgift, men operatören tar betalt
för A2P-avtalet och termineringen. De granskade publika operatörssidorna visar
inte en komplett svensk prislista för Corevos direkta upplägg. Exakt belopp är
därför **offert krävs**, inte något som ska gissas i kod eller budget.

Corevo kan äga och drifta hela SMPP-gatewayen/SMSC-programvaran. Det som inte kan
byggas bort är rätten och nätvägen till vanliga mobilnummer: antingen tecknas ett
direkt operatörsavtal, eller så blir Corevo själv teleoperatör/interconnect-part.
En lokal SMPP-server utan någon av dessa vägar kan ta emot submit-anrop men kan
inte terminera SMS i Telias, Tele2s, Telenors eller Hi3G:s abonnentnät.

```text
månadskostnad = fast avgift/minimiåtagande
              + on-net-segment  × avtalat on-net-pris
              + off-net-segment × avtalat off-net-pris
              + eventuella DLR/Sender ID/VPN-avgifter
```

Ett långt SMS eller Unicode/emoji kan bli flera debiterade segment. Begär därför
följande som separata rader från alla fyra nätägare:

- start-/anslutningsavgift och testmiljö;
- månadsavgift eller minsta trafikåtagande;
- pris per on-net- och off-net-segment samt volymsteg;
- avgift för DLR, dynamiska Sender ID:n och registrering av nya tenantnamn;
- pris för statisk IP/VPN/mTLS eller redundant anslutning om operatören kräver det;
- bind/API-kvot, topp-TPS, support och SLA;
- avtalslängd, uppsägningstid och vad som händer med outnyttjad minimivolym.

Corevo ska välja direkt REST om det uppfyller kraven. Då behövs operatörsavtal,
test-/produktionscredentials, en driftserver och operatörens nät-/authkrav —
inget modem och ingen SMPP-sidecar. För SMPP behövs därutöver normalt statisk
publik IP/allowlist, TLS, `system_id`/bind-secret och en liten långlivad
SMPP-process. Köp inget nytt modem och beställ ingen extra server innan den
vinnande operatören har lämnat sitt tekniska kontrakt.

## Open source-val — inga fler listor behövs

Zivar har lämnat fem relevanta spår. Det räcker för beslut; fler kataloglänkar
ökar inte sannolikheten att lösa operatörsanslutningen. De här projekten ersätter
gatewayprogramvara, inte avtalet, credentials, IP-whitelistningen eller rätten
att routa ett Sender ID genom en operatörs SMSC.

| Kandidat | Styrka | Risk/passform | Beslut |
|---|---|---|---|
| Telia direkt REST | ingen extern open-source-gateway behövs; enklast direktoperatörsväg | måste avtalsverifieras för dynamiskt Sender ID, DLR och kapacitet | **första transportvalet** om kraven passeras |
| Sendium | modern headless Java/Quarkus-gateway; SMPP TX/RX/TRX, TLS, DLR, TPS, Prometheus; aktuell 2026 | GPL-3.0; HTTP 202/intern queue kan bryta Corevos `accepted`-semantik; ung releasegren | **SMPP-kandidat**, endast efter REST-grinden och kraschtest |
| Jasmin | mogen och välkänd; SMPP client/server, routing, DLR, failover; Apache-2.0 | tung drift med AMQP/Redis/Twisted; egna store-and-forward-semantiker; senaste GitHub-release 2023 | **SMPP-reservkandidat** om Sendium faller |
| `bassrehab/smpp-core` | modern Java 21-klient/server, auto-reconnect och metrics; Apache-2.0 | mycket ungt/litet projekt; bibliotek i stället för färdig produktionsgateway | **tunn SMPP-baslinje/fake-SMSC-kandidat**, måste jämföras med fullgateway |
| Kannel | gammal, beprövad SMPP/modem-gateway | legacy C/config/drift och ingen fördel för Corevos gröna fält jämfört med alternativen | **välj bort för nybygget** |
| SourceForge Windows-lista/Gammu/Kalkun | bra för telefon/modem och nummerbaserade SMS | leder tillbaka till konsument-SIM; löser inte alfanumeriskt Sender ID | **välj bort för Sender ID-spåret** |

### Beslutsträd efter operatörens testcredentials

```text
Klarar operatörens direkta REST API tenant-Sender ID + DLR + 12 månaders topp?
  |
  +-- ja --> bygg Corevos tunna REST-transport först
  |
  +-- nej / operatören kräver SMPP --> jämför tunn klientbaslinje med Sendium
                                      mot samma conformance- och kraschtest
                                        |
                                        +-- Sendium fail --> prova Jasmin
                                        |
                                        +-- fullgateway kan inte ge SMSC-kvittens
                                            utan egen beständig sanning
                                              |
                                              +-- använd tunn SMPP-adapter
```

SMPP aktiveras bara om REST inte klarar en dokumenterad topp-TPS, submit-latens,
DLR-/Sender ID-funktion eller ett uttryckligt operatörskrav. Om SMPP behövs blir
valet slutligt först när samma automatiserade conformance- och failure-injection-
suite körts mot en tunn klientbaslinje och fullgatewaykandidaten. Popularitet
eller GitHub-stars är inte leveransbevis. Ingen kandidat får skriva en egen
Supabase-jobbtabell.

## Så får Zivar A2P/Bulk-avtalet och den direkta anslutningen

### Hela svenska operatörskartan

Corevo ska kontakta nätägaren, inte varje lågprisvarumärke separat. Comviq går
via Tele2s nät, Vimla via Telenors nät och Hallon via Tres/Hi3G:s nät. Ett
konsument- eller företags-SIM från något av varumärkena är fortfarande inte ett
A2P-/SMSC-avtal.

| Nätägare och varumärken | Offentligt verifierad väg 2026-07-20 | Corevos nästa steg | Status |
|---|---|---|---|
| Telia | Bulk Messaging med direkt REST och SMPP, beställningsblanketter och teknisk portal | skicka blanketterna och hela kravlistan | **första tekniska kandidat** |
| Tele2 / Comviq | Wholesale Messaging erbjuder A2P on-net, off-net och verifieringsmeddelanden | kontakta Wholesale Messaging och begär direkt API/SMPP-spec | **offentlig A2P-väg verifierad** |
| Telenor / Vimla | Telenor Företag publicerar SMS Pro API, SMS Direkt, SMPP 3.4-spec och CPA för direktkoppling till mobilnätet | ring `08-410 210 66`/använd formuläret och begär rätt produkt för Corevos outbound A2P, dynamiska Sender ID och off-net | **offentlig direktväg verifierad; exakt produkt måste bekräftas** |
| Tre / Hi3G / Hallon | Tre publicerar företags- och partnerskapskontakt, men ingen aktuell publik svensk A2P/SMPP-onboarding hittades | ring Tre Företag `0735-300 630` eller Hi3G-växeln `076-333 33 33` och begär Wholesale/Carrier Messaging | **måste bekräftas skriftligt; anta inte att tjänsten säljs** |

Skicka samma förfrågan till alla fyra. Jämför avtalsmotpart, on-/off-net-pris,
minimiåtagande, dynamiska Sender ID:n, verifieringsprocess, DLR, protokoll,
testmiljö, topp-TPS, IP/VPN/mTLS, SLA och support. Ett lägre listpris vinner inte
om operatören låser ett enda avsändarnamn eller saknar säker DLR-korrelation.

### Spår A — Telia direkt, förstahandsval

Telias aktuella implementationsguide beskriver denna ordning:

1. Kontakta Telia Bulk Messaging och begär ett svenskt **Bulk Messaging Agreement**.
   Avtalet tecknas per land där trafik ska skickas.
2. Ladda ner och fyll i **General customer form** och
   **Technical information form** från
   `https://messaging.teliacompany.com/documents`.
3. Skicka blanketterna till den Bulk Messaging Support-kontakt som står i
   avtalets Appendix 2. Använd inte en påhittad eller gammal supportadress.
4. Efter godkänd order kommer välkomstmejl och portalåtkomst till den kommersiella
   kontaktpersonen.
5. Skapa minst en administratör och en separat teknisk användare i portalen.
6. Beställ/aktivera svensk Bulk SMS-tjänst och välj tekniskt protokoll.
7. Begär både direkt **REST API** och **SMPP 3.4 över TLS**, delivery reports och
   off-net-routing till samtliga svenska mobilnät. Be Telia bekräfta vilka
   Sender ID-/DLR-/kapacitetsregler som skiljer protokollen.
8. Om SMPP beställs: ge Telia gatewayserverns statiska publika IP för
   ACL-whitelistning och begär `bind_transceiver`.
9. Säkerställ att tjänstens addressing policy är **All**, inte **Restricted**.
   `Restricted` tillåter bara tjänstens associerade accessnummer och stoppar
   Corevos tenantnamn.
10. Begär skriftlig bekräftelse på hur Corevo ska styrka rätten att använda varje
    tenants företagsnamn/varumärke som Sender ID och hur nya namn läggs till.
11. Be om testkonto/testfönster, produktionskonto, throughput/window size,
    prislista, minimivolymer, fakturering och support-/incidentväg.

Telias publicerade SMPP-endpoint är `smpp.messaging.teliacompany.com:3550` med
TLS 1.2 eller senare. SNI med samma servernamn krävs. Endpointen kan inte användas
förrän avtal, aktiv tjänst, credentials och IP-whitelist finns.

Telias direkta REST API är planens första transportval när det uppfyller exakt
samma dynamiska Sender ID-, DLR-, on/off-net- och kapacitetskrav. Det är fortfarande
ett direkt operatörsavtal och Corevo äger fortfarande gateway, outbox, retry,
policy och kundflöde. SMPP införs först när REST diskvalificeras av en mätbar
tolvmånadersprognos, ett saknat krav eller ett uttryckligt operatörsvillkor.

### Spår B — Tele2 Wholesale parallellt

Tele2s Wholesale-sida erbjuder A2P-terminering genom deras SMS-gateways för
on-net, off-net och internationell trafik, inklusive verifieringsmeddelanden.

1. Öppna `https://www.tele2.com/about/what-we-offer/wholesale-services/messaging-services/`.
2. Använd kontaktlänkarna på sidan eller ring `+46 70 426 40 39`.
3. Begär ett **direkt avtal med Tele2 Wholesale Messaging**, inte ett vanligt
   Comviq-/Tele2 Business-SIM och inte en CPaaS-partner.
4. Skicka samma kravlista och offertfrågor som till Telia.
5. Be särskilt om teknisk API-/SMPP-specifikation, testcredentials, dynamiskt
   alfanumeriskt Sender ID, DLR, statisk IP-/VPN-krav och svensk off-net-routing.

### Spår C — Telenor/Vimla direkt

Telenor Företags aktuella API-sida beskriver tre relevanta vägar: SMS Pro API
för utskick till mobilkunder, SMS Direkt med publicerad SMPP 3.4-specifikation
och CPA för direktkoppling till Telenors mobilnät. Sidan anger telefon
`08-410 210 66` och ett kontaktformulär för SMS-tjänster.

1. Begär en teknisk säljare för **direkt outbound A2P/Bulk SMS**, inte Premium
   SMS, debitering via SMS eller ett vanligt mobilabonnemang.
2. Be Telenor avgöra skriftligt om Corevo ska använda SMS Pro Connect,
   SMS Direkt eller CPA för exakt detta trafikfall.
3. Kräv bekräftelse på svensk off-net-routing, dynamiska tenant-Sender ID:n,
   DLR, direkt REST/API respektive SMPP, testcredentials och pris.
4. Vimla behöver inte kontaktas separat; testa ändå leverans till ett verkligt
   Vimla-SIM eftersom varumärket använder Telenors nät.

### Spår D — Tre/Hi3G/Hallon direkt

Ingen aktuell offentlig svensk A2P-/SMPP-produkt eller teknisk onboarding kunde
verifieras på Tres webbplats. Det är ett resultat, inte ett nej: Corevo måste få
svaret från Hi3G:s Wholesale/Carrier Messaging innan Tre räknas bort eller in.

1. Ring Tre Företag på `0735-300 630` eller Hi3G Access AB:s växel på
   `076-333 33 33` och be att bli kopplad till Wholesale/Carrier Messaging.
2. Beskriv outbound OTP och transaktionella boknings-SMS, inte roamingaccess,
   premium-SMS eller ett vanligt SIM-utskick.
3. Fråga om Hi3G erbjuder företag en direkt A2P-anslutning till svensk SMSC,
   själva eller genom en namngiven avtalsväg.
4. Kräv samma skriftliga svar och testunderlag som från de andra nätägarna.
5. Hallon behöver inte kontaktas separat; testa ett verkligt Hallon-SIM om Hi3G
   blir kandidat.

### Färdigt meddelande att skicka till operatören

```text
Ämne: Förfrågan – direkt A2P/Bulk SMS med API/SMPP och dynamiskt Sender ID

Hej,

Jag företräder Corevo, en svensk multi-tenant SaaS-plattform för bokning och
kundkommunikation. Vi vill teckna ett direkt operatörsavtal för svensk A2P/Bulk
SMS-trafik och ansluta vår egen gateway till er SMSC. Vi söker alltså inte en
CPaaS-återförsäljare.

Första användningsfallen är OTP/PIN-verifiering före bokning, bokningsbekräftelser,
ändringar och påminnelser. Trafiken är transaktionell och skickas endast efter
kundens egen bokningshandling eller inom den relationen.

Vi behöver:
- direkt REST/HTTP API och/eller SMPP 3.4 över TLS; ange vilket ni rekommenderar
- om SMPP erbjuds: helst bind_transceiver och delivery receipts via deliver_sm
- svensk on-net och off-net terminering till samtliga mobilnät
- dynamiskt alfanumeriskt Sender ID per tenant/företag, högst 11 tecken
- addressing policy som tillåter godkända alfanumeriska namn, inte endast ett
  associerat nummer
- tydlig process för varumärkes-/företagsverifiering av varje Sender ID
- testkonto/testmiljö och separata produktionscredentials
- dokumenterade trafikgränser, throughput, felkoder och SLA; för SMPP även window size
- era krav på statisk IP, mTLS, redundans, VPN och failover
- pris för svensk on-net/off-net-trafik, minimiåtagande och fakturering
- kontaktväg för onboarding, teknisk support och incidenter

Vår gateway, durable queue, retry, idempotens och kundflöden driftas och ägs av
oss. Kan ni skicka avtalsunderlag, General customer form/Technical information
form eller motsvarande samt nästa steg för teknisk onboarding?

Med vänlig hälsning
Zivar Mahmod
Corevo
```

### Underlag att ha redo innan samtalet

- Registrerat bolagsnamn, organisationsnummer, fakturaadress och behörig
  firmatecknare.
- Kommersiell kontakt, teknisk kontakt och incidentkontakt.
- Domäner, produktbeskrivning och integritetspolicy.
- Trafiktyp: OTP, bekräftelse, ändring, avbokning och påminnelse; marknadsföring
  ska vara en separat framtida policy.
- Uppskattad trafik: startvolym per dag/månad, tolv månaders prognos och möjlig
  topp per sekund. Säg sanningen; operatören dimensionerar kvot och SMPP-window.
- Länder: Sverige först. Be om separat offert/process innan fler länder öppnas.
- Lista med första Sender ID:n samt bevis på relationen till respektive tenant.
- Gatewayens statiska publika IPv4-adress. Skaffa inte en dynamisk hem-IP som
  produktionsendpoint.
- Önskad redundans: minst två processer/zoner senare, men börja med ett tydligt
  test- och canaryupplägg.

### Frågor som måste få skriftliga svar

- Är avtalet direkt med mobiloperatören och går trafiken direkt in i er SMSC?
- Tillåts dynamiska alfanumeriska Sender ID:n per slutkund/tenant?
- Är addressing policy `All`, och vilka reserverade namn blockeras?
- Hur registreras och verifieras ett nytt företagsnamn?
- Fungerar namnen off-net till Telia, Tele2/Comviq, Telenor/Vimla och Tre?
- Vilka tecken stöds konsekvent? Corevo använder initialt säkra `A-Z0-9`, högst
  11 tecken, utan emoji eller beroende av blanksteg.
- Krävs statisk IP, VPN, mTLS eller en specifik TLS/SNI-konfiguration?
- Vilka bindtyper, connection count, window size och submit-rate tillåts?
- Vilka DLR-statusar/felkoder skickas och hur länge kan ett slutbesked dröja?
- Hur ska idempotens/correlation ID göras på operatörens sida?
- Vad kostar on-net, off-net, internationellt, DLR, Sender ID-skydd och minimiavgift?
- Finns testtrafik som inte når riktiga telefoner? Finns canarybegränsning?
- Vilket SLA och vilken incidentkontakt gäller utanför kontorstid?

## Målarkitektur

```text
Webb/bokning/superadmin
          |
          | enqueue endast
          v
Supabase notifications_outbox  <----- EN beständig sanningskälla
          |
          | claim + lease + CAS
          v
Corevos befintliga Worker-dispatcher
  - läser tenant/bokning/kund
  - renderar text och skapar magic link
  - validerar godkänt Sender ID
  - äger retry/begin/ack och databasåtkomst
          |
          | autentiserat privat transportanrop
          v
Corevo transport
  - först: tunn direkt REST-adapter
  - vid bevisat behov: EN SMPP-adapter/sidecar
  - inga Supabase-credentials eller kundtabeller
          |
          | operatörens REST/TLS eller SMPP/TLS
          v
Mobiloperatörens Bulk Messaging/SMSC
          |
          +---- Telia
          +---- Tele2/Comviq
          +---- Telenor/Vimla
          +---- Tre/Hi3G/Hallon

DLR: operatör/SMPP-sidecar -> autentiserat Corevo DLR-ingress
     -> strikt validering -> notifications_outbox/delivery-status
```

### Återanvänd det som redan finns

- `5-Kod/apps/web/lib/notifications/outbox.ts` äger enqueue, claim, lease,
  delivery-begin och ack.
- `5-Kod/apps/web/lib/notifications/sms.ts` förbereder redan SMS och tenantens
  avsändarnamn; transportadaptern byts, produktbeslutet behålls.
- `5-Kod/apps/web/lib/notifications/booking-delivery.ts` producerar tenantnamn,
  bokningsmeddelande och säkra kundlänkar.
- `5-Kod/apps/web/app/api/cron/notifications/route.ts` är befintlig dispatchväg.
- `5-Kod/supabase/migrations/0105_restore_deferred_schema_contracts.sql` har
  `slot_holds` samt place/release/prune-RPC:er som ska återanvändas för tiden
  under PIN-verifieringen.
- Den lokala, otrackade `corevo-sms/`-mappen innehåller användbar
  providerabstraktion och modemdrift, men är research/arbetsunderlag tills den
  granskats. Den får inte bli en parallell plattformsdatabas.

### Förbjuden parallell kö

Researchgatewayens nuvarande idé om en separat Supabase-tabell `sms_jobs` ska
inte implementeras i Corevo. Producenter skriver en gång till
`notifications_outbox`; den befintliga Worker-dispatchern claimar raden,
berikar med serverdata och anropar transportprovidern. Detta är den enda tillåtna
topologin. Transportgatewayen får varken Supabase-nyckel, polla outboxen eller
läsa/skriva kundtabeller. En SMPP-sidecar äger i så fall endast wire/session,
medan Corevo äger meddelandets livscykel och beständiga status.

Supabases aktuella säkerhetsmodell skiljer på `GRANT` och RLS. Om en ny gateway-
funktion eller tabell verkligen behövs ska migrationen uttryckligen återkalla
standardåtkomst och bara ge minsta nödvändiga `EXECUTE`/tabellprivilegium till
den serverroll som används. Interna tabeller och hjälpfunktioner hör i ett
icke-exponerat schema, exempelvis `private`. En `SECURITY DEFINER`-funktion i
`public` får inte användas som snabb lösning: funktioner omfattas inte av RLS,
och `EXECUTE` kan annars bli en oavsiktlig API-yta. Varje ny migration ska även
testa cross-tenant-nekande och köras genom Supabase security advisor före merge.

## Gatewaykontrakt

### Providerinterface

Varje transport ska få ett låst, redan validerat jobb:

```text
send(
  outbox_id,
  attempt_id,
  tenant_id,
  to_e164,
  sender_id,
  message,
  correlation_id
) -> accepted(provider_message_id) | retryable(error) | permanent(error) | unknown
```

Om transporten körs som separat process exponeras kontraktet endast på ett
privat, autentiserat HTTPS-/mTLS-nät. Requesten signeras och innehåller tidsstämpel
och unik `attempt_id` mot replay. Transporten returnerar `accepted` först efter
operatörens faktiska submit-kvittens. Timeout efter möjlig submit blir `unknown`,
aldrig en blind omedelbar omsändning.

Huawei- och ModemManager-providerna saknar `sender_id` i sin nuvarande
`send(...)`-signatur. Interfacet behöver utökas innan direktoperatören kopplas
in. Bara direktoperatörsprovidern annonserar kapabiliteten `SENDER_ID`.

### REST först

- Implementera operatörens signerade/autentiserade REST-kontrakt exakt efter
  testcredentials och aktuell specifikation.
- Sätt korta connect-/requesttimeouts, begränsad connection pool och circuit
  breaker; respektera `Retry-After` och operatörens kvot.
- Skicka ett stabilt Corevo correlation-/attempt-ID om API:t stödjer det.
- Verifiera callbacksignatur, källnät/mTLS och schema på DLR. Okända message-ID:n
  loggas utan PII och ändrar ingen rad.
- Samma conformance-suite ska kunna köras mot fake-operatör, REST och ett
  eventuellt SMPP-alternativ.

### SMPP-detaljer som inte får gissas

- SMPP 3.4 över TLS 1.2+ och full certifikatverifiering.
- Telia kräver SNI `smpp.messaging.teliacompany.com`.
- Alfanumerisk källa: `source_addr_ton=0x05`, `source_addr_npi=0x00`.
- E.164-destination: `dest_addr_ton=0x01`, `dest_addr_npi=0x01`, normalt utan
  ett inledande `+` i SMPP-fältet enligt operatörens specifikation.
- `registered_delivery` begär DLR.
- Hantera `bind_transceiver`, `submit_sm`, `submit_sm_resp`, `deliver_sm`,
  `deliver_sm_resp`, `enquire_link`, `unbind` och automatisk återbindning.
- Respektera avtalad connection count, SMPP-window och submit-rate.
- Separera GSM-7 från UCS-2. Räkna segment före submit och visa den verkliga
  segmentkostnaden i driftdata.
- `provider_message_id` och Corevos `outbox_id/attempt_id` måste kunna
  korreleras utan att SMS-text eller telefonnummer loggas i klartext.
- `accepted` betyder accepterad av SMSC, inte levererad till telefonen.
- Efter timeout där submit-resultatet är okänt får systemet inte blint skicka
  dubbelt. Markera `unknown`, reconcila mot DLR/providerstatus och kräva en
  dokumenterad retryregel.

### Två statuslager — blanda inte submit och leverans

| Händelse | Submit-resultat | Leveransstatus | Retry |
|---|---|---|---|
| transport nere före submit | `retryable` | oförändrad | ja, backoff + jitter |
| REST-accept eller `submit_sm_resp` OK | `accepted` | `pending` | invänta DLR |
| tillfällig quota/throttle | `retryable` | oförändrad | ja, respektera gräns |
| reserverat/otillåtet Sender ID | `permanent/configuration_error` | `rejected` | nej, larma |
| timeout efter möjlig submit | `unknown` | `unknown` | ingen blind omsändning |
| DLR delivered | oförändrat | `delivered` | nej |
| permanent DLR-reject | oförändrat | `failed_permanent` | nej |
| subscriber absent/temporary | oförändrat | enligt avtalad felkodspolicy | högst begränsad retry |

DLR-uppdateringar ska vara idempotenta och monotona: en sen eller duplicerad
status får inte flytta `delivered` bakåt. Nuvarande 46elks-specifika
`record_sms_delivery`/message-ID-regex måste generaliseras till
`(provider_key, provider_message_id)` och samtidigt bevara befintlig 46elks-data.
Okända, dubbla och out-of-order DLR:er ska ha explicita testfall.

`unknown` har policy per meddelandetyp. OTP skickas inte blint igen efter möjlig
submit; kunden får begära en ny kod som atomiskt ogiltigförklarar den gamla.
Bokningsbekräftelser och påminnelser väntar på providerstatus/DLR till en
dokumenterad deadline innan en kontrollerad åtgärd görs. Varje operatörs stöd för
idempotency keys eller statusuppslag ska verifieras i test, inte antas.

### Sender ID-policy per tenant

- Källan är superadmin-godkänd tenantkonfiguration, inte visningsnamnet i en
  publik request.
- Lagra både önskat namn, normaliserat transportnamn, verifieringsstatus,
  verifierad tid, verifierare och operatörsstatus.
- Max 11 tecken. För första releasen: `A-Z`, `0-9`; inga osäkra look-alikes.
- Ett namn som är reserverat, inte verifierat eller utanför policyn failar stängt.
- Tenantens SMS-läge ska vara `sms_pending`, `sms_active` eller `sms_rejected`.
  Publik PIN-bokning öppnas först efter godkänd Sender ID-verifiering och en
  lyckad canary på den tenanten.
- Ändring av Sender ID kräver minst privilegium, superadmin step-up/MFA,
  append-only audit med gammalt/nytt värde och notis till tenantens ägare.
- Ingen automatisk fallback till `COREVO` utan ett uttryckligt produktbeslut;
  kunden ska inte få fel avsändare i smyg.
- Alfa-SMS går normalt inte att svara på. Skriv inte “svara JA” i de meddelandena.

## PIN före bokning

### Serverflöde

1. Kunden väljer tjänst, personal och tid.
2. Servern validerar hela valet och skapar ett kort `slot_hold`, exempelvis fem
   minuter, med befintlig `place_slot_hold`-väg.
3. Servern normaliserar mobilnumret till E.164.
4. En kryptografiskt säker fyrsiffrig PIN skapas.
5. Endast HMAC-SHA-256 med versionsmärkt server-pepper, challenge-ID, tenant,
   telefonfingeravtryck, TTL, attempt count och rate-limitdata lagras. En vanlig
   snabb hash räcker inte för ett fyrsiffrigt sökutrymme. Klar PIN lagras inte.
6. Challenge, hold och OTP-rad i `notifications_outbox` skapas atomiskt. OTP-raden
   har `expires_at`; dispatchern hoppar över utgångna koder och har en direkt
   wake-väg plus subminut-recovery, inte bara en lång cronintervall.
7. Kunden skriver PIN. Kontroll sker server-side med konstanttidsjämförelse.
8. Vid rätt kod skapas bokningen och challenge/hold konsumeras i en atomisk
   databas-RPC som också enqueuear bekräftelsen. Tiden får inte kunna dubbelbokas
   mellan verifiering och commit.
9. Alla bokningsskrivvägar, inklusive `create_storefront_booking_with_release`,
   måste respektera aktiva holds. Befintliga `slot_holds` gör inte detta komplett
   i nuläget; det ska bevisas med race-tester innan flödet används.
10. Fel, utgången kod eller uttömda försök skapar ingen bokning. Hold släpps
    eller får löpa ut och kan prunas.
11. Tenantens bokningsinställning väljer endast SMS, SMS med e-postreserv eller
    endast e-post. Kontaktfält, servervalidering och leverans följer samma val.

### Säkerhetsgränser

- TTL cirka fem minuter, högst tre verifieringsförsök per challenge.
- Cooldown innan ny kod och rate limit globalt samt per tenant, telefon,
  IP/device-signal och aktivt antal holds. Ny kod ogiltigförklarar alltid den
  tidigare challenge-koden.
- Samma challenge får bara konsumeras en gång.
- Generiska feltexter ska inte läcka om ett nummer redan finns som kund.
- OTP, magic-link-token och telefonnummer får inte hamna i URL-loggar eller
  applikationsloggar.
- Kundens samtycke och ändamål ska vara tydligt: verifiering och transaktionell
  bokningskommunikation, inte automatiskt marknadsföringssamtycke.

Före live ska en retentionmatris beslutas för OTP-challenges, holds, magic-token-
hashar, provider-message-ID, DLR och säkerhetsloggar. SMS-text, klar PIN, klar
magic-token och fullständigt telefonnummer ska inte finnas i transportloggar.
Råa provider-callbacks sparas bara om ett dokumenterat drift-/revisionsbehov
kräver det, krypterat och med automatisk gallring.

### PIN-vyns obligatoriska tillstånd

| Tillstånd | Vad kunden måste kunna göra |
|---|---|
| skickar | se att koden skickas utan dubbelklick |
| skickad | se maskerat nummer, skriva kod och välja “ändra nummer” |
| fel kod | förstå kvarvarande försök utan att bokningen skapas |
| cooldown/ny kod | se nedräkning; omskick ogiltigförklarar gammal kod |
| utgången/maxförsök | begära ny challenge om tiden fortfarande kan hållas |
| SMS-fel | prova igen eller ändra nummer utan spökbokning |
| tiden förlorad | återgå till tider med tydlig förklaring |
| klar | se bokningsbekräftelsen exakt en gång |

## Magin i bekräftelse-SMS:et

Bekräftelse-SMS:et innehåller en HTTPS-länk till bokningen. Token ska vara
kryptografiskt slumpad; endast dess hash lagras. Ett naket boknings-ID eller en
token i klartext i databasen är aldrig behörighet. Vid första godkända öppning:

1. token valideras server-side mot tenant, kund, bokning, ändamål och utgångstid;
2. token konsumeras atomiskt och byts mot en `HttpOnly`, `Secure`, lämpligt
   `SameSite`-skyddad enhetssession;
3. svaret redirectar till en ren URL utan token och använder strikt
   `Referrer-Policy`; analytics, proxy och accessloggar får inte få tokenvärdet;
4. kunden ser kommande/tidigare bokningar hos den tenanten och kan avboka,
   hämta kalenderlänk och boka igen med förifyllda uppgifter;
5. en ny eller utgången enhet kräver ny SMS-verifiering innan känsliga åtgärder.

Utgången eller redan använd länk ska erbjuda säker återhämtning genom ny
telefonverifiering. Avbokning, ombokning och andra mutationer är POST-actions med
Origin-/CSRF-skydd och serverkontroll av kund, tenant och bokningsägarskap.

Kundvyn måste ha designade lägen för loading, tom historik, aktiv bokning,
bekräftelse av avbokning, policyspärr, lyckad/misslyckad kalenderlänk, inga tider
vid ombokning och utgången session. Alla lägen ska fungera med tangentbord,
skärmläsare, tydlig fokusmarkering och minst WCAG 2.2 AA-kontrast.

Ingen lösenordsregistrering ska stoppa det första flödet. Den verifierade
telefonidentiteten och enhetssessionen ger den enkla återkomsten. Ett fullt konto
kan erbjudas senare utan att historiken tappas.

## PWA-installation utan friktion

- Fråga högst vid de två första lämpliga öppningarna av kundlänken.
- Fråga efter att sidan gett värde, inte innan bokningen syns.
- Android/Chromium: fånga `beforeinstallprompt`, visa Corevos egen tydliga knapp
  efter användargesten och anropa den sparade prompten.
- iPhone/iPad: webbläsaren tillåter inte att ett script installerar PWA:n åt
  kunden. Visa en kort visuell guide: Dela -> Lägg till på hemskärmen.
- När `display-mode: standalone` eller motsvarande visar att appen redan körs
  installerad ska frågan aldrig visas igen.
- Ett “Nej, inte nu” respekteras; räknaren lagras per enhet.

PWA-logiken är en explicit tillståndsmaskin: `unsupported`, `eligible`,
`prompted_once`, `prompted_twice`, `declined`, `accepted` och `standalone`.
Räknaren ökas först när den riktiga frågan visats. Safari-instruktionen får inte
visas i en in-app-webbläsare som saknar rätt Dela-flöde.

## Senare: globalt Corevo-konto och “Mina ställen”

Detta kommer efter att det enkla tenantbundna flödet är bevisat i skarp drift.

1. Kunden får SMS: “Corevo har uppdaterats — säkra ditt konto och samla dina
   ställen.”
2. Telefonen verifieras på nytt.
3. Kunden kan koppla Google, Apple eller annan framtida inloggning.
4. Befintliga verifierade kundrelationer länkas till en global personidentitet
   utan att tenantdata blandas eller exponeras över RLS-gränser.
5. “Mina ställen” kan visa frisör, tatueringsstudio, florist, bilverkstad och
   andra Corevo-tenants som kunden faktiskt har en relation till.
6. Partnerförslag och pushnotiser kräver egna samtycken och får aldrig bakas in
   i boknings-OTP:n.

Global identitet får inte byggas som ett frisörspecialfall och får inte införas
genom att göra `customers` globalt läsbar. Varje relation är tenantbunden även
om en överordnad identitet senare kan samla dem åt den autentiserade personen.

## Byggordning för Claude Code

### Fas 0 — avtal och tekniskt kontrakt

- Skicka samma operatörsförfrågan till Telia, Tele2, Telenor och Tre/Hi3G.
- Få skriftliga svar på checklistan och fyll jämförelsematrisen.
- Frys providerkontraktet efter verklig operatörsspec, inte före.
- Skaffa central secret-hantering, separata test-/produktionscredentials,
  rotationsrutin och emergency revoke. Statisk IP skaffas om valt protokoll kräver den.

### Fas 1 — Corevos kontrakt och tester

- Lägg till `sender_id` och correlation/idempotency i gatewayprovider-kontraktet.
- Skriv tester för capability, 11-teckenspolicy, tenantisolering och felmappning.
- Skriv fake-operatör för REST och fake-SMSC för SMPP; riktiga operatörsanrop får
  inte krävas i CI.

### Fas 2A — direktoperatör-provider via REST

- Bygg tunn REST-adapter först om vinnande operatör klarar kraven.
- Bevisa faktisk operator-accept, DLR-signatur, throttling, timeout och `unknown`
  med conformance-/failure-injection-test.
- Dokumentera mätvärdet eller operatörskravet innan SMPP-spåret öppnas.

### Fas 2B — SMPP endast vid bevisat behov

- Jämför en tunn SMPP-klientbaslinje med Sendium mot exakt samma conformance-,
  restart- och failure-injection-suite. Jasmin provas om Sendium faller.
- En fullgateway används endast som isolerad wire/session-sidecar bakom Corevos
  providerinterface. Dess retry/queue får inte skapa en andra beständig sanning,
  och HTTP 202 från dess interna kö får aldrig mappas till `accepted`.
- Om fullgatewayprojekten faller byggs en tunn adapter med en granskad
  SMPP-klient, där `smpp-core` är kandidat efter mognadsbedömning.
- Implementera inte binär SMPP-serialisering från noll utan ett verifierat
  operatörskrav som inget granskat open-source-alternativ klarar.
- Inga riktiga credentials i kod eller fixture.
- Före produktion: pinna image-digest/version, skapa SBOM, kontrollera licens och
  CVE:er, kör non-root/read-only och exponera inga adminportar publikt.

### Fas 3 — en kö, en dispatcher

- Koppla providern till `notifications_outbox`.
- Behåll claim/lease/begin/ack/CAS och befintliga driftgrindar.
- Ta bort/avvisa varje väg som skapar `sms_jobs` som parallell kö.
- Lägg metrics för queue age, submit latency, bind state, retry, unknown och DLR.
- Generalisera DLR-korrelationen från 46elks-format till provider + message-ID.

### Fas 4 — PIN före bokning

- Introducera OTP challenge-kontrakt och återanvänd `slot_holds`.
- Gör challenge + hold + OTP-outbox atomiskt och ge OTP-raden `expires_at`.
- Gör verify + booking commit + confirmation enqueue atomiskt i en RPC.
- Gör e-post valfri genom hela gästbokningen och låt alla bokningsskrivvägar
  respektera aktiva holds.
- Lägg abuse-/rate-limit-tester och race-tester.

### Fas 5A — magic-link-kundvy

- Bygg den tenantbundna, lösenordsfria kunddörren.
- Implementera token-hash, atomisk konsumtion, ren redirect och återverifiering.
- Vänta med global identitet och partnerrekommendationer.

### Fas 5B — PWA efter fungerande kundvy

- Lägg installationserbjudande för Android och korrekt instruktion för iOS.
- Implementera och testa tillståndsmaskinen samt tvåvisningsgränsen.

### Fas 6 — kontrollerad driftsättning

- `off` -> mocked/local -> operatörens test -> en uttrycklig canarymottagare ->
  en intern testtenant -> begränsad verklig tenant.
- Varje steg har kill switch och verifierad rollback.
- Ingen bred aktivering enbart för att providern accepterar ett test-SMS.
- Mät canary per nät: submit-success, DLR-delivery, p95 submittid, OTP-tid till
  telefon, verifieringsgrad, dubbelsändning och supportfel.

Goal-73 är fortfarande aktiv enligt `HANDOFF.md`. Den här planen är därför
beslut/handoff och blir inte ett konkurrerande aktivt goal förrän Zivar väljer
byggskiftet enligt projektets en-del-i-taget-regel.

## Acceptans — SMS-transport

- [ ] Operatörsavtal är direkt och dokumenterat.
- [ ] Samtliga fyra nätägare har fått samma krav; val/avslag är dokumenterat.
- [ ] Svensk on-net och off-net trafik ingår.
- [ ] Ett godkänt tenantnamn visas som avsändare på verklig Android och iPhone.
- [ ] Huawei/Comviq annonserar aldrig `SENDER_ID`.
- [ ] REST-test bevisar auth, accept, DLR, throttle, timeout och `unknown`; om
      SMPP används bevisas även source TON `0x05`, NPI `0x00` och destination.
- [ ] Otillåtet/reserverat Sender ID failar stängt och larmar.
- [ ] Tenant A kan aldrig skicka med tenant B:s namn.
- [ ] Transportgatewayen har inga Supabase-credentials och inga kundtabeller.
- [ ] `notifications_outbox` är enda beständiga kö.
- [ ] Samma outboxrad skapar inte dubbla SMS vid timeout/restart.
- [ ] DLR korreleras via provider + message-ID, är monotont/idempotent och saknar
      PII i logg; legacy 46elks-ID:n fortsätter fungera.
- [ ] Transportbrott återhämtas med backoff utan tappad lease-semantik.
- [ ] GSM-7/UCS-2 och segmentantal är testade.
- [ ] `SMS_DELIVERY_MODE=off` gör noll nätanrop.
- [ ] Verklig leveransmatris passerar Telia, Tele2/Comviq, Telenor/Vimla och
      Tre/Hallon på Android/iPhone, inklusive minst ett porterat nummer.

## Acceptans — bokning och kundresa

- [ ] Ingen bokning skapas innan rätt PIN verifierats.
- [ ] Challenge + hold + OTP-outbox är en atomisk operation.
- [ ] OTP med passerad `expires_at` skickas aldrig.
- [ ] Fel nummer kan korrigeras och ny PIN begäras utan spökbokning.
- [ ] Utgången/fel PIN och för många försök skapar ingen bokning.
- [ ] Ny PIN ogiltigförklarar gammal PIN.
- [ ] Slot hold hindrar race i samtliga bokningsskrivvägar och släpps efter fel/utgång.
- [ ] Lyckad verifiering kan bara skapa en bokning.
- [ ] Booking commit och bekräftelse-outbox är atomiska.
- [ ] Gäst kan boka med telefon och namn utan tvingande e-post.
- [ ] Magic link ger bara rätt kund rätt tenantdata.
- [ ] Endast magic-token-hash lagras; länken konsumeras atomiskt och redirectar
      till tokenfri URL.
- [ ] Återanvänd/utgången token failar stängt och erbjuder ny SMS-verifiering.
- [ ] Mutationer är POST med Origin-/CSRF- och ägarskapskontroll.
- [ ] Samma betrodda enhet kommer tillbaka utan onödig registrering.
- [ ] Ny enhet kräver ny verifiering för känsliga åtgärder.
- [ ] Android-installation och iOS-instruktion är separata och korrekta.
- [ ] Installationsfrågan visas högst två gånger och aldrig i standalone-läge.
- [ ] PIN-, kundvy- och PWA-tillstånd är testade med tangentbord/skärmläsare och
      WCAG 2.2 AA-kontrast.

## Driftlarm som måste finnas före live

- REST-circuit/operatörs-API eller SMPP-bind nere längre än tröskel.
- Outboxens äldsta SMS äldre än tröskel.
- Kraftig ökning av retry, permanent fail eller `unknown`.
- DLR saknas efter avtalad tid.
- Sender ID-reject eller quota exceeded.
- OTP-send-rate/verify-fel tyder på missbruk.
- Operatörskostnad/segmentvolym avviker från prognos.

## Officiella källor

- Telia Bulk Messaging Implementation Guide:
  `https://cdn.messaging.teliacompany.com/documents/developer/index.html`
- Telia Bulk Messaging-dokument och beställningsblanketter:
  `https://messaging.teliacompany.com/documents`
- Tele2 Wholesale Messaging Services:
  `https://www.tele2.com/about/what-we-offer/wholesale-services/messaging-services/`
- Telenor Företag — SMS Pro API, CPA och SMS Direkt:
  `https://www.telenor.se/foretag/sms/api/`
- Telenor Wholesale:
  `https://www.telenor.se/foretag/wholesale/`
- Tre Företag — partnerskap/wholesale:
  `https://www.tre.se/treforetag/partnerskap`
- Tre Företag — kontakt:
  `https://www.tre.se/treforetag`
- Hi3G Access AB — företagsuppgifter:
  `https://www.tre.se/om-tre/kontakt/foretagsuppgifter`
- Sendium:
  `https://github.com/cytechmobile/sendium`
- Jasmin:
  `https://github.com/jookies/jasmin`
- smpp-core:
  `https://github.com/bassrehab/smpp-core`
- Kannel:
  `https://www.kannel.org/`
- SMPP 3.4-specifikation:
  `https://smpp.org/smpp-specifications/`
- Supabase — Securing your API:
  `https://supabase.com/docs/guides/api/securing-your-api`
- ETSI/3GPP TS 23.040, teknisk SMS-arkitektur och adressering:
  `https://www.etsi.org/deliver/etsi_ts/123000_123099/123040/17.03.00_60/ts_123040v170300p.pdf`

Operatörskrav, priser och kontaktvägar kan ändras. Verifiera alltid den senaste
avtalsbilagan och implementationsguiden innan credentials eller produktion låses.
