# 46elks-kompatibilitet för notifierings-outbox

46elks är en avgränsad kompatibilitetstransport för durabla SMS-notifieringar och
partnerkonfiguration. Den är inte transporten för boknings-PIN; PIN använder Giada
enligt [PIN-runbooken](pin-booking-activation.md).

Den verkliga runtimekedjan är:

```text
/api/cron/notifications
  -> dispatchNotificationOutbox
  -> deliverClaimedSmsOutbox
  -> tenant-/partnertransport
  -> 46elks
  -> /api/webhooks/46elks/delivery
  -> record_sms_delivery
```

## Fysiska grindar

`SMS_DELIVERY_MODE` har tre slutna lägen: `off`, `dry_run` och `live`. Okänt eller
tomt värde blir `off`. Repoets Worker-konfiguration ska vara `off` tills ett separat
aktiveringsbeslut ändrar den.

Ett provideranrop kräver dessutom:

- tenantens SMS-opt-in;
- exakt mottagare i `SMS_CANARY_RECIPIENTS`;
- giltig tenant-/partnertransport;
- providerkonfiguration;
- callbackkonfiguration i `live`.

Det finns ingen wildcard-canary. `off` ska göra noll provideranrop. `dry_run` får
bara köras som uttrycklig canary och ska inte leverera ett SMS.

## Konfiguration

Globala 46elks-värden använder Worker-hemligheterna
`SMS_46ELKS_USERNAME`, `SMS_46ELKS_PASSWORD`,
`SMS_46ELKS_CALLBACK_URL`, `SMS_46ELKS_CALLBACK_SECRET` och
`SMS_CANARY_RECIPIENTS`. Partnertransporten löses genom den etablerade
Vault-/partnerägaren.

Inga värden, telefonnummer, callback-URL:er med credentials eller meddelandetexter
får skrivas i Git, dokument eller logg.

## Aktivering

1. Verifiera mockade tester för `off`, `dry_run`, `live`, timeout, osäkert svar och
   idempotent callback.
2. Sätt provider- och callbackkonfiguration men behåll `off`.
3. Deploya genom [deploy-runbooken](deploy-runbook.md) och bevisa noll nätverk i
   `off`.
4. Efter uttryckligt godkännande: använd `dry_run` för exakt en canary och återgå
   till `off`.
5. Live kräver ett nytt separat godkännande, exakt canarymottagare och en
   kontrollerad tenant.
6. Kräv provideracceptans och en autentiserad callback till samma outboxrad.
7. Återgå till `off` efter canary. Bred aktivering är ett eget releasebeslut.

Callbacken ska fortsätta vara fail-closed för metod, content type, käll-IP,
Basic-auth, fältmängd, provider-id och statusövergång. Den får uppdatera en befintlig
outboxrad men aldrig skapa ett nytt utskick.

## Rollback

1. Sätt `SMS_DELIVERY_MODE=off` och deploya genom ordinarie väg.
2. Stäng tenantens SMS-opt-in.
3. Rotera provider- och callbackhemligheter vid misstänkt läcka.
4. Låt callbacken vara nåbar för redan accepterade providerjobb tills de är
   terminala.
5. Auto-retrya aldrig ett jobb med osäker provideracceptans; reconcila det mot
   providerstatus först.
