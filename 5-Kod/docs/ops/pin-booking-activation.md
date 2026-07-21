# PIN-verifierad bokning — aktivering och drift

Gäller goal-74. Migration `0118` och Worker-version
`0d440c6f-fbfa-433a-b8f5-c5f39f72d3da` driftsattes 2026-07-21 genom deploy-run
`29840569825`. Produktions-Workern har server-only Giada-bas och en separat
API-nyckel. Med frånkopplat modem nådde ett liveprov FreshCuts kontaktsteg och
visade endast Namn + E-post, utan mobilfält eller konsolfel.

Quectel RM550V-GL-stödet är mergat i gatewayens `master`-SHA `835cb60` med 76
gröna tester, men är ännu inte installerat eller hårdvaruverifierat på den
avstängda Giadan. Senast verifierade drift-SHA där är `09a6dab`.

Ett autentiserat offline-anrop mot gatewayen gav `503 modem_offline`, skapade
inget köjobb och lämnade kön på noll. `sms.corevo.se/health` rapporterade samtidigt
`status=ok` och `modem_online=false`. E-postens verkliga leveranscanary, fysisk
RM550V-kallstart och SIM-canary återstår.

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

## Kvarvarande aktiveringsordning

1. Kör e-postfallback-testlistan i
   `6-Testing/goal-74-pin-bokning-testlista.md`, inklusive verklig e-postleverans.
2. Montera RM550V-GL i en WWAN-kompatibel M.2 B-key 3052-plats med SIM och rätt
   antenner medan Giadan är helt strömlös. Starta därefter Giadan.
3. Låt update-timern hämta gateway-SHA `835cb60`. Sätt på Giada
   `COREVO_PROVIDER=modemmanager` och behåll `COREVO_LIVE_SEND_ENABLED=false`;
   starta om API och worker.
4. Verifiera att `mmcli` ser modemet och ett upplåst SIM, att radiodelen når
   `registered`, att ingen databärare finns och att GSM/CDMA visas som
   `unmanaged` i NetworkManager.
5. Verifiera att `ip route get 1.1.1.1` fortfarande går via `eno1`, att
   `/health` visar `send_enabled=false`, `modem_online=false` och
   `queue_pending=0`, samt att bokningssidan därför fortfarande visar e-post.
6. Pausa för Zivars uttryckliga ja. Kör gatewayens interaktiva canary och skicka
   exakt ett SMS till Zivars tillåtna nummer.
7. Efter godkänd canary: sätt `COREVO_LIVE_SEND_ENABLED=true`, starta om API och
   worker och verifiera `modem_online=true` med färsk tid.
8. Bekräfta att en ny bokningssession visar mobilnummer och genomför en enda
   demo-bokning genom PIN, DB, outbox och Giada.

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
RM550V-enheten görs strikt `unmanaged` i NetworkManager. En root-ägd minutkontroll
slår endast på radiodelen via `mmcli --enable` och skapar ingen databärare.
Profil- och dispatcherskydd för `never-default`, route metric `900` och ignorerad
DNS ligger kvar som försvar på flera nivåer. Den senaste verifieringen utan modem
visade internet/default route via kabel-LAN `eno1` (`192.168.50.1`).

## Rollback

1. Sätt först `COREVO_LIVE_SEND_ENABLED=false` på Giada och starta om API och
   worker. Health maskerar då modemet som offline, alla sändvägar ger 503 och
   väntande gatewayjobb makuleras innan en senare återaktivering.
2. Ta vid behov bort `GIADA_SMS_BASE_URL` eller `GIADA_SMS_API_KEY` från Workern
   för ytterligare isolering. Enbart nyckelrotation är inte en health-kill-switch.
3. Behåll e-postrelay och `BOOKING_PIN_PEPPER`. Bokning fortsätter verifierat via
   e-post utan att PIN-skyddet stängs av.
4. Rulla tillbaka webbversionen endast via ordinarie deploy-runbook. Rulla inte
   tillbaka databasmigrationen så länge någon challenge/outboxrad kan finnas.
5. Granska `notifications_outbox`, Giadas lokala journal och slutlig bokningsstatus
   utan att skriva ut kontakt eller meddelandetext.
