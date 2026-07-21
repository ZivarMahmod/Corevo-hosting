# SMS / 46elks — aktivering, canary och rollback

> **Strategiskt ersättningsbeslut 2026-07-20:** 46elks-koden nedan beskriver den
> befintliga, fortsatt avstängda transporten. Den ska inte bli Corevos långsiktiga
> produktionsväg och ska inte aktiveras i väntan på egen gateway med direkt
> operatörsanslutning. Kanonisk plan och Claude-handoff finns i
> `1-Planering/18-sms-direktoperator/00-BESLUT-ARKITEKTUR-BYGGPLAN.md` respektive
> `1-Planering/18-sms-direktoperator/CLAUDE-HANDOFF.md`. Befintlig
> `notifications_outbox` förblir den enda beständiga kön.

## Giada-grund driftsatt 2026-07-21

Den lokala gatewaygrunden är installerad på Giada från
`ZivarMahmod/corevo-sms` `master`-SHA `b365065`:

- API och ensam modem-worker är aktiva; den tidigare Supabase-pollern är
  borttagen ur koden och maskerad i systemd.
- Giada hämtar privat repo med en separat read-only deploy-nyckel. En timer
  kontrollerar `master` var femte minut, accepterar endast fast-forward, kör hela
  testsuiten och rullar tillbaka kod och tjänster om aktiveringen inte blir frisk.
- Hälsokontroll körs varje minut och daglig online-backup av SQLite körs 03:00.
- NetworkManager-/udev-skydd hindrar Huawei HiLink från att ta default route eller
  DNS när USB-modemet ansluts. Vid verifieringen gick internet via kabel-LAN.
- Claude Code finns på Giada för manuell SSH-användning. Ingen Claude-tjänst,
  timer eller lokal LLM körs permanent.

Verifiering på Giada: 49 tester passerade; API-hälsan var `ok`, kön hade noll
väntande jobb och update/health/backup rapporterade `success`. Modemet var inte
fysiskt anslutet och rapporterades därför offline. Inget SMS skickades.

Detta aktiverar inte Corevos SMS-transport. `notifications_outbox` ska senare
pusha autentiserade jobb till Giada; gatewayen ska aldrig få Supabase-credentials
eller claima affärskön själv. Den kopplingen byggs först vid ett godkänt byggskifte
från aktiva goal-73. Fysisk USB-hotplug och ett uttryckligt canary-SMS är två
separata kvarvarande driftprov.

Status 2026-07-18: transport och delivery-webhook är byggda men **fysiskt AV** i
både produktion och staging. `SMS_DELIVERY_MODE` är committad som `off` i
`apps/web/wrangler.jsonc`. Credentials, tenantinställning eller en kodväg kan
inte ensamma skicka ett SMS.

Goal-72 S7 har dessutom lagt till Vault-backed providerkonfiguration per partner,
fryst kostnadsägare/valuta per outboxrad och partnerautentiserad delivery-callback.
Det ändrar inte den fysiska grinden: partnerkonfiguration kan finnas medan mode
är `off`, och får inte tolkas som att dry-run eller live är godkänt.

> Kör inget riktigt provider-`dryrun` och inget liveanrop utan Zivars uttryckliga
> godkännande. Automatiska tester mockar `fetch` och gör noll externa anrop.

## Tre oberoende grindar

| Grind | `off` | `dry_run` | `live` |
|---|---|---|---|
| Global `SMS_DELIVERY_MODE` | noll `fetch` | 46elks med `dryrun=yes` | skarp providergren |
| Tenant `settings.sms_enabled=true` | irrelevant | U8:s kontrollerade testtenant | obligatorisk |
| `SMS_CANARY_RECIPIENTS` | irrelevant | inte levererande | mottagaren måste finnas exakt i listan |

Okänt, tomt eller felcasing på mode betyder alltid `off`. Live utan callback,
credentials, tenant-opt-in eller canary-match gör noll provideranrop. Det finns
ingen "allow all"-konfiguration i denna release; bred aktivering kräver en ny,
separat och uttrycklig produktionsgrind.

## Secrets och konfiguration

Sätt aldrig dessa i Git eller i `NEXT_PUBLIC_*`:

```powershell
# Produktion (utelämna --env)
npx wrangler secret put SMS_46ELKS_USERNAME
npx wrangler secret put SMS_46ELKS_PASSWORD
npx wrangler secret put SMS_46ELKS_CALLBACK_URL
npx wrangler secret put SMS_46ELKS_CALLBACK_SECRET
npx wrangler secret put SMS_CANARY_RECIPIENTS

# Isolerad staging
npx wrangler secret put SMS_46ELKS_USERNAME --env staging
npx wrangler secret put SMS_46ELKS_PASSWORD --env staging
npx wrangler secret put SMS_46ELKS_CALLBACK_URL --env staging
npx wrangler secret put SMS_46ELKS_CALLBACK_SECRET --env staging
npx wrangler secret put SMS_CANARY_RECIPIENTS --env staging
```

- `SMS_46ELKS_CALLBACK_URL`: exakt HTTPS-bas, exempel
  `https://booking.corevo.se/api/webhooks/46elks/delivery`, utan query/userinfo.
- `SMS_46ELKS_CALLBACK_SECRET`: minst 32 slumpade byte. Transporten lägger den som
  lösenord med det fasta användarnamnet `corevo` i 46elks dokumenterade
  Basic Auth-URL. Providern skickar sedan `Authorization: Basic ...` och webhooken
  jämför hela headern konstanttid. Skriv aldrig ut den genererade
  `whendelivered`-URL:en eller callback-hemligheten.
- `SMS_CANARY_RECIPIENTS`: kommaavgränsade E.164-nummer. Detta är PII och ska
  därför vara Worker-secret. `*`, tomt och oparsebara nummer tillåter ingen.
- `SMS_DELIVERY_MODE`: är en vanlig, granskningsbar Worker-var i
  `wrangler.jsonc`; den står kvar på `off` tills ett godkänt steg nedan.

46elks API-anrop använder kontots separata Basic Auth, form-urlencoded och
`dontlog=message`. Live skickar `whendelivered` med callbackens Basic Auth;
dry-run skickar `dryrun=yes` och kan bara returnera `simulated` med `parts` och
`estimated_cost`.

## Säker aktiveringsordning

1. Applicera och verifiera migration 0092 samt 0097 på fresh-start och måldatabas.
2. Kör alla mockade U1/U3/U4-testfall. Bekräfta noll nätverkstrafik i `off`.
3. Sätt secrets ovan men behåll mode `off`. Deploya och verifiera att inget
   provideranrop sker.
4. **Pausa och invänta Zivars ja.** När U8:s kontrollerade canary-kommando finns:
   ändra endast rätt miljös mode till `dry_run`, deploya och kör exakt ett test.
   Godkänt bevis är `simulated`, rimliga `parts`/`estimated_cost` och inget SMS.
5. Sätt tillbaka `off`, deploya och granska outbox/loggar utan telefon eller text.
6. **Pausa för ett nytt separat ja till live.** Sätt testtenantens
   `sms_enabled=true`, lägg bara Zivars nummer i canary-secreten, ändra mode till
   `live` och deploya.
7. Skicka exakt en transaktionell canary. Kräv provider-id och en godkänd callback
   som går `sent` -> `delivered` (eller ärligt `failed`) i samma outboxrad.
8. Sätt omedelbart tillbaka mode `off`. Bred tenantaktivering sker inte i U3.

Provider-callbacken accepterar bara `POST application/x-www-form-urlencoded`,
giltig Basic Authorization och Cloudflares `cf-connecting-ip` från dokumenterade
46elks-adresser: `176.10.154.199`, `85.24.146.132`, `185.39.146.243` eller
`2001:9b0:2:902::199`. Endast `id`, `status` och — för `delivered` — UTC-fältet
`delivered` tillåts. Replay är idempotent och terminal status backas aldrig.
Request-URL:en som når Workern innehåller ingen credential; normal Cloudflare-
observability kan därför vara kvar. Corevos kod loggar aldrig Authorization,
genererad callback-URL, provider-id, telefon eller meddelandetext.

## Omedelbar rollback

1. Ändra `SMS_DELIVERY_MODE` till `off` i aktuell miljö och deploya via ordinarie
   deploy-runbook. Detta är den fysiska kill-switchen och ska ske först.
2. Sätt tenantens `settings.sms_enabled=false`.
3. Rotera/radera 46elks-credentials och callback-secret vid misstänkt läcka.
4. Låt leveranscallbacken vara nåbar tills redan accepterade canary-rader är
   terminala; den kan inte skapa nya utskick.
5. Granska `delivery_started`, `sent`, `delivered` och `failed` i
   `notifications_outbox`. Skicka aldrig om `delivery_started` automatiskt.

## Medvetet kvar till U4/U8

- U4 producerar hela bokningshändelsematrisen via den enda outboxen och kopplar
  den typade SMS-adaptern till en explicit worker. U3 claimar inte alla kanaler.
- U8 tillhandahåller det kontrollerade provider-dry-run- och canary-steget.
- Marknadsförings-SMS, STOPP-flöde, bred aktivering och tenantdebitering ingår
  inte. Transaktionella och marknadsföringsmeddelanden får inte blandas.
