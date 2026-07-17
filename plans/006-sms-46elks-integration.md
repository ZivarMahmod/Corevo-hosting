# Plan 006: Koppla in SMS via 46elks (full integration — provider-fetch, E.164, avsändar-ID, opt-out)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/lib/notifications/sms.ts 5-Kod/apps/web/lib/notifications/booking.ts 5-Kod/apps/web/lib/notifications/reminders.ts 5-Kod/apps/web/app/avboka/actions.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (störst kundvärde per timme av alla rester enligt kodyte-läsningen)
- **Effort**: M
- **Risk**: LOW (dispatchen är redan inkopplad + best-effort; detta fyller EN fetch + normalisering)
- **Depends on**: none
- **Category**: feature / lanseringsgrind
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

SMS-notiser är efterfrågat och nästan klart: hela dispatch-rälsen finns redan
inkopplad (bokningsbekräftelse, påminnelse, avbokning), gated på tenantens
`sms_enabled`-flagga, med telefonnummer-parsning. Det ENDA som saknas är själva
provider-anropet inuti `sendSms` — idag en TODO-stub som degraderar till no-op.
Superadmin-SPEC:en namnger redan providern: **46elks (plattformsbred)** — ett
svenskt SMS-gateway. Utan detta går alla notiser bara via mejl, och en salong som
slår på SMS får tyst tystnad.

**Provider-kontrakt (46elks, verifierat mot deras API-dok 2026-07-17):**
- `POST https://api.46elks.com/a1/sms`
- **Basic auth** (`api_username:api_password`) — INTE Bearer.
- **form-urlencoded** body (INTE JSON): `from`, `to`, `message`.
- `from` = text-avsändar-ID (max 11 tecken, a–z/0–9, inga mellanslag) ELLER ett
  E.164-nummer om man vill kunna ta emot svar.
- `to` = mottagare i E.164 (`+46…`).
- Svar = JSON med bl.a. `id`, `status`, `cost`.

Stubben använder idag FEL kontrakt (`Bearer` + JSON) i sin TODO-kommentar — den
måste ersättas, inte fyllas i rakt av.

## Current state

Repo: pnpm-monorepo i `5-Kod/`. App `apps/web` (Next.js på Cloudflare Workers/OpenNext).
Kommandon från `5-Kod/`. Kodkommentarer på svenska/engelska blandat — matcha filens
befintliga ton (sms.ts är på engelska).

### Transporten (den enda filen som behöver riktig logik)

`5-Kod/apps/web/lib/notifications/sms.ts` (78 rader). `sendSms` degraderar redan
korrekt: tomt nummer/kropp → typad fel-retur; ingen nyckel → `{ ok:false, skipped:true }`
+ logg; kastar ALDRIG. TODO-blocket (rad 41–53) är där providern ska in:

```ts
  const key = process.env.SMS_PROVIDER_API_KEY
  ...
  if (!key) {
    logger.info('sms.skipped (SMS_PROVIDER_API_KEY unset)', { to })
    return { ok: false, skipped: true }
  }
  try {
    // TODO(provider): wire the real SMS provider fetch here ...
    logger.info('sms.skipped (provider not yet implemented)', { to })
    return { ok: false, skipped: true }
  } catch (err) { ... }
```

Filen exporterar också `parseGuestPhone(note)` — plockar telefon ur gäst-noten
(`Gäst: <namn> <email> <telefon> [— note]`). Använd som den är.

### Mönstret att spegla: `email.ts`

`5-Kod/apps/web/lib/notifications/email.ts` visar husets HTTPS-transport-mönster:
läser `EMAIL_RELAY_URL`/`EMAIL_RELAY_SECRET`, degraderar när de saknas, `fetch` i
`try/catch`, typad `SendResult`, loggar `warn` på icke-2xx. **Spegla exakt denna
form** för 46elks.

### Dispatchen (redan klar — ändras INTE)

- `5-Kod/apps/web/lib/notifications/booking.ts:84-90` — best-effort SMS efter
  bokningsbekräftelse, gated på `sms_enabled`.
- `5-Kod/apps/web/lib/notifications/reminders.ts:127-134` — påminnelse-SMS, per-tenant
  `sms_enabled`-map, `parseGuestPhone`.
- `5-Kod/apps/web/app/avboka/actions.ts:93-108` — avboknings-SMS.
- Toggeln: `tenant_settings.settings.sms_enabled`, default FALSE (opt-in), läses av
  `lib/notifications/settings.ts` (`getSmsEnabled`, rad ~73–90).

### Secrets-konvention

Env läses via `process.env.*` i server-only-moduler; produktionsvärden sätts som
Cloudflare Worker vars/secrets (se `wrangler.jsonc` för mönstret — men lägg ALDRIG
hemligheter i committad config; secrets sätts via `wrangler secret put` / dashboard).
Drift-referenser dokumenteras i `5-Kod/docs/ops/`.

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm --filter web exec vitest run lib/notifications` | gröna |
| Full test | `pnpm test`              | gröna               |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope**:
- `5-Kod/apps/web/lib/notifications/sms.ts` (provider-fetch + E.164-normalisering + avsändar-ID)
- `5-Kod/apps/web/lib/notifications/sms.test.ts` (skapa)
- `5-Kod/apps/web/lib/notifications/booking.ts` + `reminders.ts` + `app/avboka/actions.ts`
  (ENDAST om avsändar-ID/tenant-namn måste trådas in — se steg 4; håll diffen minimal)
- `5-Kod/docs/ops/` (env-dokumentation)

**Out of scope**:
- `sms_enabled`-toggeln och settings-läsningen — fungerar redan.
- Inkommande SMS/svar, MMS, leveransrapporter-webhook — egen framtida plan (46elks
  stödjer det, men transaktionsutskick behöver det inte nu).
- Marknadsförings-SMS/kampanjer — separat (kräver samtyckesregister, se steg 5).
- Byte av notis-arkitekturen (senders tar `to,data` — rör inte signaturerna i onödan).

## Git workflow

- Direkt på `main`. En commit per steg. Stil: `feat(sms): koppla in 46elks-transporten`.
- Pusha inte; deploy + `wrangler secret put` är operatörens steg.

## Steps

### Step 1: E.164-normalisering för svenska nummer

I `sms.ts`, lägg en ren hjälpfunktion `toE164(raw: string): string | null` FÖRE
`sendSms`:
- redan `+…` → behåll (strippa mellanslag/bindestreck).
- `0046…` → `+46…`.
- `07XXXXXXXX` (svenskt mobilnr, 10 siffror med ledande 0) → `+467XXXXXXXX`.
- annars, om det är rena siffror utan tydlig landskod → returnera `null` (skicka inte
  ett tvetydigt nummer).

Detta är money/edge-logik → lämna en liten självkontroll (assert-baserad `demo()`
eller testfall i steg 6).

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Ersätt TODO-blocket med 46elks-anropet

Byt env-läsningen och fetchen. 46elks kräver basic auth + form-encoding:

```ts
  const user = process.env.SMS_46ELKS_USERNAME
  const pass = process.env.SMS_46ELKS_PASSWORD
  const e164 = toE164(to)
  if (!e164) return { ok: false, error: 'invalid_recipient' }
  if (!user || !pass) {
    logger.info('sms.skipped (46elks credentials unset)', { to: e164 })
    return { ok: false, skipped: true }
  }
  try {
    const auth = Buffer.from(`${user}:${pass}`).toString('base64')
    const from = sanitizeSenderId(args.from) // steg 4; default 'Corevo'
    const res = await fetch('https://api.46elks.com/a1/sms', {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ from, to: e164, message: args.body }),
    })
    if (!res.ok) {
      logger.warn('sms.send_failed', { to: e164, status: res.status })
      return { ok: false, error: `http_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    logger.warn('sms.send_threw', { to: e164, error: err instanceof Error ? err.message : String(err) })
    return { ok: false, error: 'exception' }
  }
```

OBS Cloudflare Workers: `Buffer` finns via OpenNext/nodejs_compat i detta repo
(verifiera — annars använd `btoa`). Om `Buffer` inte är tillgängligt: `btoa(\`${user}:${pass}\`)`.
Behåll `SmsResult`-typen. Uppdatera modulens topp-kommentar (rad 4–13) så den
beskriver 46elks i stället för "no provider wired".

**Verify**: `pnpm typecheck` → exit 0;
`grep -n "api.46elks.com" apps/web/lib/notifications/sms.ts` → 1 träff;
`grep -c "SMS_PROVIDER_API_KEY" apps/web/lib/notifications/sms.ts` → 0 (gamla env-namnet borta).

### Step 3: Utöka `sendSms`-signaturen med valfritt avsändar-ID

Ändra `sendSms(args: { to: string; body: string; from?: string })`. `from`
default → `'Corevo'`. Lägg `sanitizeSenderId(name?: string): string` som: tar
salongsnamnet, strippar icke-alfanumeriskt, klipper till 11 tecken, faller tillbaka
på `'Corevo'` om tomt (46elks tillåter bara ≤11 tecken a–z/0–9 som text-avsändare).

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Tråd in salongsnamnet som avsändare (minimal diff)

I de tre dispatch-ställena skickas redan tenantnamnet in i mejl-/SMS-texten
(`tenantName`). Skicka det även som `from`:
- `booking.ts:90` → `sendSms({ to, body, from: tenantName })`
- `reminders.ts:134` → `sendSms({ to: phone, body: …, from: tenantName })`
- `avboka/actions.ts:108` → `sendSms({ to: phone, body: …, from: tenantName })`

Gör INGET annat i dessa filer. Om `tenantName` inte redan finns i scope på raden →
skicka inte `from` (default 'Corevo' gäller då); tvinga inte in en ny DB-läsning.

**Verify**: `pnpm typecheck` → exit 0; `pnpm --filter web exec vitest run lib/notifications` → gröna.

### Step 5: Opt-out-fotnot i SMS-texterna (juridik)

Transaktions-SMS (bekräftelse/påminnelse/avbokning) till egen kund är tillåtet utan
opt-out enligt marknadsföringslagen — men det är god sed och billigt att lägga en
kort avsändaridentifiering. Verifiera att varje SMS-kropp börjar med salongsnamnet
(de gör redan det: "TenantName: …"). Ingen STOP-avgift/STOPP-hantering behövs för
ren transaktion; DOKUMENTERA i ops-notisen (steg 7) att marknadsförings-SMS (framtida
kampanjmodul) KRÄVER samtycke + "svara STOPP"-hantering och därför är en egen plan.

**Verify**: `grep -n "tenantName" apps/web/lib/notifications/reminders.ts` → SMS-kroppen prefixad.

### Step 6: Tester

Skapa `lib/notifications/sms.test.ts` (följ `email.test.ts`-strukturen — mocka
`fetch` och `process.env`):
- `toE164`: `070…`→`+4670…`; `0046…`→`+46…`; redan `+46…`→oförändrad; skräp→`null`.
- `sanitizeSenderId`: "Fresh Cut!"→"FreshCut" (≤11, alfanum); tomt→"Corevo".
- `sendSms`: utan credentials → `{ skipped:true }`, ingen fetch; med credentials +
  giltigt nummer → fetch mot `api.46elks.com` med Basic-auth-header och
  form-encoded body; 500-svar → `{ ok:false, error:'http_500' }`; fetch kastar →
  `{ ok:false, error:'exception' }` (kastar aldrig uppåt).

**Verify**: `pnpm --filter web exec vitest run lib/notifications/sms` → alla gröna.

### Step 7: Ops-dokumentation

Skriv/utöka en fil under `5-Kod/docs/ops/` (t.ex. `notifications.md`): env-variablerna
`SMS_46ELKS_USERNAME` + `SMS_46ELKS_PASSWORD` sätts via `wrangler secret put` (aldrig i
committad config), 46elks-kontot är plattformsbrett (ETT konto, avsändar-ID = salongsnamn),
kostnad per SMS (46elks fakturerar plattformen — koppla till flöde-2-underlag senare),
och att marknadsförings-SMS är en separat samtyckeskrävande plan.

**Verify**: filen finns och nämner båda env-namnen + "wrangler secret".

### Step 8: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint` → allt exit 0.

## Test plan

Se steg 6 — `lib/notifications/sms.test.ts` är kärnan. Existerande sviter får inte
brytas (`pnpm test` grönt). Ingen live-SMS skickas i test (fetch mockad).

## Done criteria

- [ ] `sendSms` POSTar till `https://api.46elks.com/a1/sms` med Basic auth + form-encoding
- [ ] `toE164` normaliserar svenska nummer; ogiltiga → skickas inte
- [ ] Avsändar-ID = sanerat salongsnamn (≤11 alfanum), default 'Corevo'
- [ ] `grep -c "SMS_PROVIDER_API_KEY" apps/web/lib/notifications/sms.ts` → 0
- [ ] `lib/notifications/sms.test.ts` finns och är grön (E.164 + sanitize + skip + fetch + felfall)
- [ ] Ops-notis med env-namn under `5-Kod/docs/ops/`
- [ ] `pnpm test && pnpm typecheck && pnpm lint` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- `Buffer` OCH `btoa` saknas i Workers-runtime (basic-auth kan inte byggas) — rapportera.
- Dispatch-ställena (`booking.ts`/`reminders.ts`/`avboka`) matchar inte excerpten
  (drift) — rapportera i stället för att gissa var `from` ska in.
- `getSmsEnabled`/`sms_enabled`-läsningen visar sig borttagen — då är gaten borta och
  detta blir ett större jobb; rapportera.
- 46elks-svaret på ett testnummer ger oväntad status i en manuell rök — rapportera
  status + body (utan att exponera credentials).

## Maintenance notes

- När leveransrapporter behövs: 46elks kan POSTa status till en `whendelivered`-URL —
  bygg då en `/api/sms/status`-route (egen plan).
- Kostnadsspårning: 46elks-svaret innehåller `cost` — vill man fakturera vidare per
  SMS (flöde 2), spara `cost` per utskick i en framtida `sms_log`-tabell.
- Marknadsförings-SMS (kampanjmodul) är en HELT annan juridisk klass: kräver
  samtyckesregister + "svara STOPP"-avregistrering. Bygg aldrig ihop det med
  transaktionsutskicken.
- Reviewer: kontrollera att `sendSms` fortfarande ALDRIG kastar (best-effort-kontraktet
  är att en SMS-miss aldrig får fälla en bokning/avbokning/påminnelse).
