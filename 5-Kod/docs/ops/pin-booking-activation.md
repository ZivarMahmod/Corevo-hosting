# PIN-verifierad bokning — aktivering och drift

Gäller goal-74. Koden är byggd för både SMS via Giada och e-postfallback, men
aktiveras först när migration, secrets och respektive canary är verifierade i
ordningen nedan.

## Verkligt dataflöde

```text
Kunden väljer tid
        |
        v
Worker frågar Giada /health (max 1,5 s)
        |
        +-- friskt + modem online --> visa endast mobilnummer
        |                              |
        |                              v
        |                         PIN skickas direkt
        |
        +-- nere/stale/okänt -------> visa endast e-post
                                       |
                                       v
                                  PIN skickas direkt

Rätt PIN --> Supabase skapar bokning + notifications_outbox i samma transaktion
                                              |
                                              v
                         exakt den outboxraden claimas och skickas direkt
```

15-minuterscron används inte för PIN eller det normala, direkta
bekräftelseflödet. Den befintliga cron-körningen är kvar för schemalagda
påminnelser och säkra retryfall. Ingen ny Worker, Queue, Durable Object eller
crontrigger har skapats.

## Säkerhetskontrakt

- PIN är sex siffror, gäller fem minuter, kan provas högst fem gånger och kan
  skickas om tidigast efter 30 sekunder.
- Start och omskick begränsas fail-closed i två separata lager: per klient-IP
  och per maskerat kontaktmål/challenge. Byte av nummer eller IP kringgår därför
  inte utskicksgränsen.
- Klartext-PIN finns endast i serverminnet medan transportanropet görs. Databasen
  lagrar HMAC-digest, maskerad kontakt och leveransstatus.
- En tids-hold skapas tillsammans med challenge och visas som upptagen för andra.
  Den släpps atomiskt när kunden backar eller vid känt leveransfel och löper
  annars ut automatiskt.
- Bokningen kan bara skapas av den service-role-skyddade finalize-RPC:n efter
  korrekt PIN. Samma challenge/request kan köras igen efter ett tappat svar utan
  dubbelbokning.
- Giada får aldrig Supabase-credentials. `notifications_outbox` är fortsatt den
  enda affärs-/leveranssanningen; Giadas SQLite är en lokal exekveringsjournal.
- Telefon, e-post, PIN, session token och API-nyckel får aldrig skrivas i logg.

## Serverkonfiguration

Följande är server-only secrets/vars. Lägg dem aldrig i Git eller i
`NEXT_PUBLIC_*`.

| Namn | Krav | Funktion |
|---|---|---|
| `BOOKING_PIN_PEPPER` | unik slumphemlighet, minst 32 tecken | HMAC för PIN och kontakt |
| `GIADA_SMS_BASE_URL` | publik HTTPS-bas, normalt `https://sms.corevo.se` | health + send |
| `GIADA_SMS_API_KEY` | nyckeln som skapats på Giada | `X-API-Key` vid send |
| `GIADA_HEALTH_MAX_AGE_SECONDS` | standard `90` | stale health går till e-post |
| `GIADA_HEALTH_TIMEOUT_MS` | standard `1500` | e-post väljs snabbt vid driftfel |
| `GIADA_SEND_TIMEOUT_MS` | standard `4000` | direkt SMS-anrop |
| `EMAIL_RELAY_URL` | befintlig relay | PIN/bekräftelse när SMS är nere |
| `EMAIL_RELAY_SECRET` | befintlig relayhemlighet | relay-auth |
| `NOTIFICATIONS_FROM` | befintlig publik Worker-var | avsändare för e-post |

API-nyckeln ska roteras samordnat: skapa/rotera på Giada, uppdatera Worker-secret
och verifiera health/send innan den gamla vägen avvecklas. Skriv aldrig ut den i
driftlogg eller dokument.

## Aktiveringsordning

1. Deploya den granskade `corevo-sms`-revisionen till Giada med befintlig
   fast-forward/test/rollback-mekanism. Kontrollera att hela gateway-testsuiten är
   grön.
2. Applicera och verifiera
   `supabase/migrations/20260721111357_pin_booking_verification.sql` i staging.
3. Sätt `BOOKING_PIN_PEPPER` och fungerande e-postrelay i staging, men utelämna
   Giada-nyckeln. Då måste bokningssidan välja e-post före kontaktsteget.
4. Kör hela e-postfallback-testlistan i
   `6-Testing/goal-74-pin-bokning-testlista.md`.
5. Sätt Giada-bas och API-nyckel i staging. Med frånkopplat/offline modem ska
   e-post fortfarande väljas inom health-timeouten.
6. Anslut SIM/modem och kör Giadas lokala modemverifiering. Kontrollera samtidigt
   att Giada behåller kabel-LAN/default route och DNS.
7. Pausa för Zivars uttryckliga ja. Skicka därefter exakt en SMS-canary till
   Zivars tillåtna nummer och verifiera samma bokning i DB, outbox och Giada.
8. Först efter godkänd staging-canary: applicera migrationen i produktion,
   uppdatera migrationscheckpoint, sätt produktionens secrets och deploya via
   ordinarie `scripts/deploy-prod.mjs` med Environment approval.

SIM-spåret visar telefonnummer som avsändare. `FRESHCUT` eller annat
alfanumeriskt tenantnamn kräver ett framtida godkänt A2P/REST- eller SMPP-avtal.
Det byter transportadapter bakom samma kontrakt och ändrar inte PIN-/bokningsflödet.

## Driftkontroller

| Kontroll | Friskt | Automatisk kundreaktion |
|---|---|---|
| `GET /health` | `status=ok`, `modem_online=true`, färsk `time` | mobilnummer + SMS |
| Health timeout/5xx/stale | aldrig tolkat som SMS-friskt | e-post före inmatning |
| `POST /api/v1/messages` | autentiserat, `require_online=true`, stabil idempotens | PIN/bekräftelse direkt |
| Send 503/offline | inget lokalt SMS-jobb skapas | PIN-start avbryts, hold släpps; ny e-postchallenge |
| Supabase finalize | `booked` + booking/outbox-id i samma svar | exakt outbox-id dispatchas direkt |
| Tappat finalize-svar | challenge är idempotent | kunden kan trycka Bekräfta igen |

Giadas systemd healthcheck kör varje minut och update-timern var femte minut.
Det behövs ingen permanent Claude-/Codex-session och ingen lokal LLM för driften.

## Rollback

1. Ta bort/rotera `GIADA_SMS_API_KEY` i Worker-miljön. Health-kontraktet faller då
   stängt till e-post; inga nya SMS-anrop kan autentiseras.
2. Behåll e-postrelay och `BOOKING_PIN_PEPPER`. Bokning fortsätter verifierat via
   e-post utan att PIN-skyddet stängs av.
3. Rulla tillbaka webbversionen endast via ordinarie deploy-runbook. Rulla inte
   tillbaka databasmigrationen så länge någon challenge/outboxrad kan finnas.
4. Granska `notifications_outbox`, Giadas lokala journal och slutlig bokningsstatus
   utan att skriva ut kontakt eller meddelandetext.
