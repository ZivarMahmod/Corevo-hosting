# SMS — nuläge och aktiveringsgrind

Status 2026-07-17: **transport ej aktiverad**. Produkten visar SMS som `KOMMER`
och har inget kundreglage som kan lova leverans. `sendSms` returnerar alltid
`{ ok: false, skipped: true, error: 'transport_unavailable' }`; telefonnummer
skrivs inte till loggar.

## Flöden som redan anropar transportgränssnittet

| Händelse | Primär kanal | SMS-försök | Kundlänk |
|---|---|---|---|
| Ny bokning | E-postbekräftelse | Bara om ett äldre `sms_enabled=true` finns och telefon finns; transporten skippar ärligt | E-posten använder signerad `/avboka/<id>?token=...`, inte en ofärdig kundportal |
| Påminnelse | E-post | Samma opt-in-kontroll; idag krävs även e-postmottagare för att raden ska behandlas | Ingen SMS-länk |
| Kundavbokning | E-postbekräftelse | Samma opt-in-kontroll | Ingen SMS-länk |

Det finns alltså inget falskt leveransbesked, men det finns heller ingen riktig
SMS-leverans eller leveransledger. Ett gammalt databasvärde kan utlösa ett
observerbart `skipped`-försök, aldrig ett skickat-resultat.

## Krav innan SMS får slås på

1. Besluta leverantör och kostnadsmodell. 46elks är namngiven kandidat, inte
   ett tyst arkitekturbeslut.
2. Lägg leverantören bakom befintliga `sendSms` och håll bokningsflödena
   leverantörsoberoende.
3. Lagra credentials som Workers-secrets; inget API-nyckelvärde i repo,
   `tenant_settings` eller klientkod.
4. Normalisera mottagare till E.164 och validera avsändarnamn enligt
   leverantörens/Sveriges regler.
5. Inför en idempotent utskicksrad per `tenant + händelse + kanal + mottagare`,
   med `queued/sent/delivered/failed/skipped`, provider-id och tidsstämplar.
6. Hantera provider-webhooks med signaturkontroll, replay-skydd och
   idempotens. Bounce/STOP/opt-out ska blockera framtida marknads-SMS.
7. Separera transaktionella SMS från marknadsföring och dokumentera samtycke,
   retention och personuppgiftsbiträde.
8. Bestäm om SMS debiteras per tenant, ingår i plan eller har kreditpott. UI:t
   får inte aktiveras före detta beslut.
9. Lägg integrationstest med provider-sandbox/fake, webhook-test samt E2E för
   bokning, påminnelse och avbokning. Testa även SMS-only-kund explicit.
10. Först därefter: migrera/normalisera eventuella gamla `sms_enabled`, visa
    reglaget och byt `KOMMER` till en status som kan bevisas.

## Medvetet uppskjutet

- Provider-HTTP-anrop och credentials.
- Pris-/faktureringsmodell.
- Flerstegspåminnelser via SMS.
- SMS-länk till global kundportal; den portalen är ett separat produktbeslut.
