# SMS — 46elks-transporten och aktiveringsgrind

Status 2026-07-17 (plan 006): **transporten är BYGGD men VILANDE**. `sendSms`
POSTar till 46elks (`https://api.46elks.com/a1/sms`, Basic auth, form-encoded
`from`/`to`/`message`) NÄR credentials finns; utan credentials degraderar den
ärligt till `{ ok: false, skipped: true, error: 'transport_unavailable' }`.
Telefonnummer skrivs aldrig till loggar (kontraktstestat i
`notification-logging.contract.test.ts`).

## Aktivering (operatörssteg)

1. Skapa 46elks-konto (plattformsbrett — ETT konto, avsändar-ID per salong).
2. Sätt Workers-secrets — ALDRIG i committad config:
   ```
   wrangler secret put SMS_46ELKS_USERNAME
   wrangler secret put SMS_46ELKS_PASSWORD
   ```
3. Verifiera med testutskick mot eget nummer (DEMO-tenant, `sms_enabled=true`).
4. Byt `KOMMER`-etiketten i produkt-UI:t först när steg 3 bevisats.

## Transportens beteende (implementerat)

- **E.164-normalisering** (`toE164`): `070…`→`+4670…`, `0046…`→`+46…`, befintligt
  `+` behålls; tvetydiga nummer VÄGRAS (vi skickar aldrig till en gissning).
- **Avsändar-ID** (`sanitizeSenderId`): salongsnamnet → ≤11 alfanumeriska tecken
  (46elks-regeln), fallback `Corevo`. Trådas från alla tre dispatch-ställena
  (bekräftelse/påminnelse/avbokning) som `from: tenantName`.
- **Best-effort**: kastar aldrig; icke-2xx → `http_<status>`; nätverksfel →
  `exception`. E-post är ALLTID primär kanal — ett SMS-fel fäller aldrig en
  bokning/påminnelse/avbokning.
- Gate: `tenant_settings.settings.sms_enabled` (default FALSE, opt-in per salong).

## Flöden som anropar transporten

| Händelse | Primär kanal | SMS-villkor |
|---|---|---|
| Ny bokning | E-postbekräftelse | `sms_enabled` + telefon finns |
| Påminnelse | E-post | samma opt-in; raden kräver även e-postmottagare |
| Kundavbokning | E-postbekräftelse | samma opt-in |

## Kvarvarande krav före BRED aktivering (oförändrat)

1. Pris-/faktureringsmodell: debiteras per tenant, ingår i plan eller kreditpott?
   46elks-svaret innehåller `cost` — spara per utskick i `notifications_outbox`
   (plan 014) för vidarefakturering och ägar-dashboard (plan 020).
2. Leveransledger: idempotent utskicksrad per tenant+händelse+kanal+mottagare —
   det ÄR `notifications_outbox` i plan 014; bygg ingen parallell.
3. Leveransrapporter: 46elks kan POSTa status till en `whendelivered`-URL →
   framtida `/api/sms/status`-route med signatur/replay-skydd.
4. **Marknadsförings-SMS är en HELT annan juridisk klass**: kräver
   samtyckesregister + "svara STOPP"-avregistrering (plan 003 + 014). Bygg aldrig
   ihop det med transaktionsutskicken.
5. Integrationstest mot provider-sandbox + SMS-only-kund explicit.

## Medvetet uppskjutet

- Flerstegspåminnelser via SMS (nästa-våg-post i plans/README.md).
- SMS-länk till global kundportal (separat produktbeslut, DIREKTION).
