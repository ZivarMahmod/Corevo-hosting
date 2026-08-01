# SMS-gateway — säkerhetsgrind ACC-C-046/047

> Historiskt grindunderlag från före den verifierade `corevo-sms`-leveransen
> `32ed4be`. Blockerstatusen nedan beskriver auditögonblicket, inte aktuellt
> driftbeslut. Aktuellt nuläge finns i `HANDOFF.md`.

Datum: 2026-07-22. Read-only audit; ingen drift, gateway-DB eller produktkod
ändrades och inga secrets, mottagare, PIN-koder eller portal-token lästes ut.

## Beslut

| Grind | Status | Beslut |
|---|---|---|
| ACC-C-046 | **BLOCKER** | Produktions-SHA:n lagrar recipient, meddelandebody och kundnamn i klartext och kopierar dem oförändrade till backup. Authenticated envelope encryption, key-version, rotation och terminal/expiry-redaktion saknas. |
| ACC-C-047 | **BLOCKER** | Verkliga portal-/recovery-token får inte aktiveras. Grindregeln är dokumenterad i portalplanen, men Goal-74-driften har redan skickat verkliga PIN-bodyer genom den blockerade gatewayen; driftläget uppfyller därför inte det nya paketkravet. |

Portalbygget kan använda mockad transport, men ingen riktig PIN, portal-link eller
recovery-hemlighet i paketets flöden får aktiveras innan denna rapport ersatts av
ett oberoende PASS-bevis. Minsta omedelbara gatewaycontainment är SMS-grinden av;
det gör inte i sig ACC-C-047 godkänd och denna audit utförde inte driftändringen.

## Provenance

- Auktoritativ källa: privat, ren klon
  `C:\Users\Zivar-PC\Desktop\corevo-sms-dev`, `master`/HEAD
  `8f136e74b8484374b24bdf4875a133b4e4f20303` (`8f136e7`). Detta är samma SHA
  som ops-dokumenten anger som driftsatt på Giada.
- `C:\Users\Zivar-PC\Desktop\firsör-sas\corevo-sms` är en untracked/stale
  snapshot och används inte för beslutet. Den har samma grundproblem men saknar
  spårbarhet till drift-SHA:n.
- Live-Giadas faktiska rader, journal och backupfiler öppnades inte. Slutsatser
  om formatet grundas på exakt driftsatt kod; ops-dokumenten bevisar dessutom
  att riktiga PIN-jobb och daglig backup har körts.

## Verifierade fynd

### Jobb-DB och API — klartext

- `backend/app/db.py` deklarerar `recipient TEXT NOT NULL`,
  `normalized_recipient TEXT NOT NULL`, `message TEXT NOT NULL` och
  `customer_name TEXT`. Det finns inga ciphertext-, nonce-, wrapped-DEK- eller
  key-versionkolumner.
- `backend/app/queue_service.py` sätter requestens värden direkt i dessa kolumner.
  Workern läser `row["normalized_recipient"]` och `row["message"]` direkt vid
  modemsubmit.
- En PIN ligger i `message`; en portal-link enligt designen innehåller rå
  fragmenthemlighet i samma body. Portal-token har inte byggts/skickats ännu,
  men skulle med nuvarande kod lagras i klartext.
- Det finns ingen body-expiry eller gallring. `sent`, `failed`, `cancelled` och
  gamla PIN-jobb behåller body. Ingen terminal status sätter body/recipient/
  kundnamn till irreversibelt redigerat värde.
- Det inloggade detail-API:t returnerar hela `message`; listans sökning gör SQL
  `LIKE` direkt mot klartextbody. Full body är alltså inte dold från lokal UI.
- API-nyckeln är separat korrekt hashad med SHA-256. Den rotationen är inte
  meddelandekryptering och stänger inte ACC-C-046.

### Loggar — inget avsiktligt bodyutsläpp hittat, men ingen verifierad grind

- Normal workerlogg innehåller jobb-id/status, inte recipient eller body.
  Auditloggen använder maskerat nummer. Uvicorns normala accesslogg loggar
  requestlinje, inte JSON-body.
- Canaryskriptet använder fast, icke-hemlig text och maskerar mottagaren.
- Ingen central body/token-redaktion eller test som matar en markör genom alla
  logger-/exceptionvägar finns. Worker loggar oväntad `Exception` som fri text,
  och providerfel lagras i `last_error`/`raw_response`. Auditens snäva slutsats
  är därför: **inget avsiktligt klartext-bodyflöde till logg hittades i koden,
  men loggsäkerheten är inte mekaniskt verifierad och kvalificerar inte till PASS.**

### Backup — full klartextkopia

- `scripts/backup.sh` kör standardbibliotekets `sqlite3.Connection.backup()` på
  hela aktiva DB:n. Ingen rad-/kolumnredaktion, kryptering eller efterkontroll
  sker. De 30 senaste `.db`-filerna behålls.
- Installeraren skapar `data/` och `backups/` med katalogmode `0700`, vilket är
  ett bra lokalt åtkomstskydd. Backupservicen saknar dock explicit `UMask=0077`
  och skriptet sätter inte backupfilen till `0600`.
- Krypteringsnyckel utanför DB/backuper finns inte, eftersom bodykryptering helt
  saknas. Det finns heller inget verifierat restore-/redaktionsprov.

### Isolerat mekaniskt bevis

Ordinarie `python -m pytest -q` kunde inte starta i Windows-checkouten eftersom
den saknar lokal pytest-installation. Inga beroenden installerades. Ett isolerat
stdlib-prov skapade i stället en temporär DB via exakt `8f136e7`, skrev en
syntetisk markör, körde samma SQLite-backupmekanism och rapporterade endast
booleska resultat:

```text
source_plaintext_recoverable_without_key = true
backup_plaintext_recoverable_without_key = true
```

Repo-/beroendesökningen gav inga träffar på AES-GCM/Fernet/annan AEAD eller
kryptobibliotek. De dokumenterade 77 gröna gatewaytesterna på SHA:n testar
drift, API, modem och idempotens, inte ACC-C-046.

## Minsta konkreta implementation för PASS

Stoppa vid första fullt fungerande lösning; ingen ny kö eller tjänst behövs.

1. **En liten krypteringsmodul och ett pinnat bibliotek.** Använd AES-256-GCM.
   Skapa en slumpad 256-bitars DEK per jobb; kryptera ett kanoniskt payload med
   recipient, normaliserad recipient, body och kundnamn med unik 96-bitars nonce
   och jobbets opersonliga UUID/version som AAD. Wrappa DEK:n med aktiv,
   versionerad KEK via AES-256-GCM och en separat unik nonce.
2. **Ny fail-closed lagringsform.** SQLite lagrar endast payload-ciphertext,
   payload-nonce, wrapped-DEK, wrap-nonce, key-version, AAD/context, maskerad
   destination, metadata och idempotency key. Legacykolumner görs nullable och
   ska vara `NULL`; ingen rå body/recipient/kundnamn får skrivas. Saknad/okänd
   key-version eller auth-tag-fel ska stoppa enqueue/send, aldrig falla tillbaka
   till klartext.
3. **Nycklar utanför data och backup.** En versionerad KEK-keyring samt aktiv
   version ligger i root-ägd systemd credential/env med `0600`, aldrig i Git,
   SQLite, `.env` som backas upp eller backupkatalogen. Workern dekrypterar
   just-in-time efter claim och lämnar aldrig body till API/UI/logg.
4. **Rotation.** Ny aktiv KEK används för nya jobb; ett avgränsat kommando
   rewrappar endast befintliga DEK:ar till ny version. Gammal KEK behålls tills
   alla aktiva rader och backuper som behöver den har gallrats/rewrappats, och
   kan sedan revokeras. Dokumentera normal rotation, emergency revoke och
   restore med key-version.
5. **Redaktion och expiry.** Lägg `expires_at` och `payload_redacted_at`.
   `sent`, terminalt `failed`, `cancelled` och utgånget jobb ska i samma
   transaktion radera ciphertext, wrapped-DEK och nonces. PIN-jobb måste få
   challenge-expiry från Corevo och får aldrig skickas efter den; portal-body
   redigeras direkt efter terminalt transportutfall. Retry använder samma
   krypterade body/idempotency key.
6. **Stäng full-body-ytorna.** Ta bort message-sökning och full body från list-,
   detail-API och UI. Logga endast slutna felkoder, jobb-id, key-version och
   status. Providerstderr/raw-response saneras innan lagring/loggning.
7. **Backupgrind.** Backup får endast innehålla ciphertext för aktiva jobb och
   redigerad metadata för terminala jobb. Sätt `UMask=0077`/filmode `0600`, behåll
   `0700` på katalogen, dokumentera gallring och verifiera restore utan att
   kopiera nycklar till backupen.
8. **Engångssanering vid release.** Sätt live-send false och kräv tom kö. Bygg
   en ny krypterad DB eller gör verifierad offline-migration; gamla terminala
   bodies/PIN:ar ska redigeras, inte reenkrypteras. Checkpointa/trunkera WAL,
   avveckla den gamla DB-filen och alla förfix-backuper enligt lagringsmediets
   säkra raderingsrutin. Återaktivera först efter oberoende test och restoreprov.

## Obligatoriskt bevis före PASS

- Rå DB-, WAL- och backupbytes innehåller inte syntetisk recipient/body/token.
- Fel nyckel, saknad version, manipulerad ciphertext/tag/AAD och nonceåterbruk
  failar stängt; inget jobb skickas.
- Två jobb får olika DEK/nonces. Rotation visar gammal decrypt, nya writes på
  ny version, lyckad rewrap och kontrollerad gammal-key-revoke.
- Worker kan efter restore dekryptera ett aktivt testjobb med extern keyring;
  backupen ensam kan inte avslöja payload.
- Samtliga terminalstatusar och expiry tar bort decryptbar payload; metadata och
  idempotens finns kvar.
- API/UI/log-capture med unika markörer ger noll body/PIN/token-träffar.
- Backupfil är `0600`, katalog `0700`, retention verifierad och samtliga gamla
  klartextbackuper borta.
- Full gatewaypytest är grön på Windows och Giada, följt av oberoende
  read-only schema-/backup-/journalgranskning på exakt driftsatt SHA.

**Största blockerare:** gatewayens beständiga sanning och backupkedjan (upp till
30 kopior) är vanlig SQLite med nyckelfritt läsbar klartextbody. Portal-/recovery-
token och nya verkliga PIN-utskick kan inte säkert tillåtas förrän hela kedjan
ovan är implementerad och mekaniskt verifierad.
