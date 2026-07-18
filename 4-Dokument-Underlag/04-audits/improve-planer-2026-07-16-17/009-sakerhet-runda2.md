# Plan 009: Säkerhet runda 2 — open redirect, boknings-backstop, SVG-upload, R2-utkast, fail-open rate-limit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- "5-Kod/apps/web/app/(auth)" 5-Kod/apps/web/lib/r2/upload.ts 5-Kod/apps/web/lib/security/rate-limit.ts 5-Kod/apps/web/lib/personal/actions.ts 5-Kod/apps/web/app/butik/actions.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (open redirect) → P2/P3 (resten)
- **Effort**: M (summa av små, oberoende delsteg)
- **Risk**: MED (auth-redirect + rate-limit-beteende + DB-backstop måste inte bryta
  legitima flöden — varje steg verifieras för sig)
- **Depends on**: mjuk koppling till plan 008 (CRON constant-time bor där — dubbla inte)
- **Category**: security
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

En andra, djupare säkerhetsrunda (efter att RLS-grunden, webhooks och secrets
bekräftats rena) hittade en HIGH-lucka och flera medelstora. Ägaren vill "inga läckor
överallt" — dessa stänger konkreta klasser:

1. **Open redirect (HIGH)** — `next`-parametern efter inloggning släpper
   protokoll-relativa URL:er (`//angripare.se`) → phishing efter äkta login på
   corevo-domänen.
2. **Bokningsmutationer kör service-role utan DB-backstop** — de tre personal-actionsen
   är korrekt filtrerade idag, men det finns ingen andra försvarslinje; en framtida
   action som glömmer ett `.eq` ger tyst cross-tenant-skrivning.
3. **Bilduppladdning tillåter osaniterad SVG** + litar på klient-MIME → latent
   stored-XSS när media flyttas till `media.corevo.se` (planerat i koden).
4. **Alla tenants delar EN publik R2-bucket** — opublicerade storefront-utkast är
   publikt nåbara via URL.
5. **Rate-limitern failar ÖPPET** på DB-fel → login-throttling försvinner tyst vid strul.
6. **Shop-kassans nedströms-actions saknar egen rate-limit.**

## Current state

Repo: pnpm-monorepo i `5-Kod/`. App `apps/web`. Kommandon från `5-Kod/`.

### SÄK-01 — open redirect (verifierat)

`app/(auth)/actions.ts:104`:
```ts
  if (next && next.startsWith('/')) redirect(next)
```
`app/(auth)/login/page.tsx:17`:
```ts
    redirect(sp.next && sp.next.startsWith('/') ? sp.next : portalHomeFor(user))
```
`startsWith('/')` släpper `//angripare.se` och `/\angripare.se` (protokoll-relativa) →
extern redirect efter login. `next` kommer rått ur `?next=`.

### SÄK-02 — boknings-service-role utan backstop (verifierat)

`lib/personal/actions.ts:67-75, 199-208, 238-253` använder `createAdminServiceClient()`
(RLS-bypass) för UPDATE på `bookings`. Efter migration 0076 finns bara SELECT/INSERT-
policyer på `bookings` — ingen authenticated UPDATE/DELETE-policy. Triggern
`guard_authenticated_booking_update` (`0072:304`) returnerar tidigt för service-role.
De tre actionsen ÄR korrekt filtrerade (`.eq('tenant_id').in('staff_id',…).in('status',…)`)
men har ingen DB-linje bakom sig.

### SÄK-03 — SVG-upload (verifierat)

`lib/r2/upload.ts:35-41` — `EXT` innehåller `'image/svg+xml': 'svg'`; `:62` validerar
bara mot `file.type` (klientens påstådda MIME, ingen magic-byte-koll); `:74` lagrar med
`contentType: file.type`. `:92-93` dokumenterar planerad flytt till `media.corevo.se`
(same-site → SVG-JS blir stored-XSS då).

### SÄK-04 — delad publik R2-bucket (verifierat)

`wrangler.jsonc:49,156` — `R2_PUBLIC_BASE_URL=https://pub-…r2.dev` (en publik bucket,
ingen signering). Utkast skrivs under `tenants/<id>/storefront-drafts`
(`lib/platform/actions/site-revisions.ts:35`). Nycklar bär `randomUUID` (svår
uppräkning) men ett delat/läckt URL exponerar opublicerade utkast.

### SÄK-05 — fail-open rate-limit (verifierat)

`lib/security/rate-limit.ts:53-61` — returnerar `true` (tillåtet) vid RPC-`error` OCH i
`catch`. Kommentar bekräftar avsiktligt fail-open. WAF-backstoppet är "documented-only".

### SÄK-06 — shop-actions utan rate-limit (verifierat)

Bara `reserveOrder` rate-limitar (`app/butik/actions.ts:66`). `confirmOrder:167`
(skickar orderbekräftelse-mejl per anrop), `startShopCheckout:376`,
`startPaypalCheckout:486`, `cancelOrder:264` samt `app/avboka/actions.ts:cancelByToken:26`
saknar `checkRateLimit`.

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | gröna               |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope**:
- `5-Kod/apps/web/app/(auth)/actions.ts` + `app/(auth)/login/page.tsx` (open redirect)
- `5-Kod/apps/web/lib/r2/upload.ts` (SVG + magic-byte + content-disposition)
- `5-Kod/apps/web/lib/security/rate-limit.ts` (fail-closed för login)
- `5-Kod/apps/web/app/butik/actions.ts` + `app/avboka/actions.ts` (rate-limit)
- Ny migration för boknings-UPDATE-backstop (SÄK-02)
- En delad `safeNext`-helper (t.ex. i `lib/auth/`) + dess test

**Out of scope**:
- CRON constant-time (SÄK-07) — ligger i plan 008 steg 5; dubbla inte.
- R2-buckets faktiska omkonfiguration (SÄK-04 fullösning = signerade URL:er/proxy) —
  steg 4 gör den MINSTA härdningen (content-disposition + dokumentera); full
  bucket-separation är en egen ops-plan (rör deploy-känslig wrangler-config).
- RLS-grunden i övrigt (bekräftad ren i runda 1+2).

## Git workflow

- Direkt på `main`. En commit per fynd. Stil: `fix(säkerhet): …`.
- Pusha inte; deploy + migrationskörning är operatörens steg.

## Steps

### Step 1 (P1): Stäng open redirect

Lägg en delad helper `safeNext(next: string | null | undefined): string | null` i
`lib/auth/` (nära `host-routing.ts`): returnera `next` ENDAST om den börjar med `/`
men INTE `//` eller `/\`; annars `null`. Använd den på båda ställena
(`actions.ts:104`, `login/page.tsx:17`) i stället för den råa `startsWith('/')`-koll.

```ts
export function safeNext(next?: string | null): string | null {
  if (!next || !next.startsWith('/')) return null
  if (next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}
```

**Verify**: `pnpm test` (nytt test: `//evil` → null, `/\evil` → null, `/admin` → `/admin`);
`grep -rn "startsWith('/')" "apps/web/app/(auth)"` → 0 kvarvarande råa kollar för next.

### Step 2 (P2): DB-backstop för boknings-UPDATE

Ny migration (filnamnskommentar rad 1): utöka `guard_authenticated_booking_update`
(eller ny trigger) så att ÄVEN service-role-UPDATE assert:ar `new.tenant_id = old.tenant_id`
(tenant är redan immutabelt — detta gör det tvingat på DB-nivå). Rör inte de legitima
flödena (samma tenant). Detta ger en andra försvarslinje utan att blockera nuvarande
personal-actions.

**Verify**: migrationsfil rad 1 = filnamn; `pnpm typecheck` → exit 0. Notera i commit:
efter applicering, verifiera i SQL Editor att en service-role-UPDATE som ändrar
`tenant_id` nekas.

### Step 3 (P2): Härda bilduppladdning

I `lib/r2/upload.ts`: (a) ta bort `'image/svg+xml'` ur `EXT` (eller, om SVG måste
stödjas, kör en SVG-sanerare innan `put`), (b) verifiera magic bytes mot påstådd MIME
för png/jpg/webp/gif innan `put` (läs de första bytearna av `file`), (c) sätt
`Content-Disposition: attachment` på icke-bild-säkra svar / överväg `contentType` från
den verifierade typen, inte `file.type`.

**Verify**: `grep -n "svg" apps/web/lib/r2/upload.ts` → 0 (eller sanerare-anrop finns);
`pnpm test` → gröna (test: SVG avvisas; png med fel magic bytes avvisas).

### Step 4 (P2/P3): Minsta R2-utkasthärdning + dokumentera

Kortsiktigt: dokumentera i `5-Kod/docs/ops/` att storefront-utkast ligger i en publik
bucket (risk: läckt URL exponerar opublicerat innehåll), och att fullösningen
(signerade URL:er eller auth-gate:ad proxy-route för `storefront-drafts`) är en egen
ops-plan. Om enkelt: lägg utkast bakom en autentiserad Worker-route i stället för den
öppna basen — men BARA om det inte rör deploy-känslig wrangler-config (annars STOP +
rapportera som egen plan).

**Verify**: ops-notis finns och beskriver risken + fullösningsvägen.

### Step 5 (P2): Fail-closed rate-limit för login

I `lib/security/rate-limit.ts`: låt åtminstone `login`-bucketen faila STÄNGT (neka)
vid RPC-fel/exception, medan övriga buckets kan behålla fail-open (login-throttling är
det som skyddar mot credential stuffing). Gör det via en parameter eller en
per-bucket-policy — bryt inte de icke-kritiska formulärgränserna.

**Verify**: `pnpm test` (test: login-bucket vid RPC-fel → nekad; kontakt-bucket vid
RPC-fel → tillåten); `pnpm typecheck` → exit 0.

### Step 6 (P3): Rate-limit på shop-kassans nedströms-actions

Lägg `checkRateLimit` (per IP+tenant, återanvänd `LIMITS.booking`) på `confirmOrder`,
`startShopCheckout`, `startPaypalCheckout` i `app/butik/actions.ts`, och en egen låg
gräns på `cancelByToken` i `app/avboka/actions.ts`.

**Verify**: `grep -c "checkRateLimit" apps/web/app/butik/actions.ts` → ≥4;
`pnpm test` → gröna.

### Step 7: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → allt exit 0.

## Test plan

- `safeNext`-enhetstest (steg 1-fallen) — kärnan; open redirect är HIGH.
- rate-limit fail-closed-test (steg 5).
- upload-sanering (steg 3): SVG avvisas, fel magic bytes avvisas.
- Migrationens backstop verifieras av operatören i SQL Editor (ingen lokal DB-gate i CI).

## Done criteria

- [ ] `safeNext` används på båda auth-redirect-ställena; `//evil` blockeras (test grönt)
- [ ] Boknings-UPDATE-backstop-migration finns (service-role kan inte byta tenant_id)
- [ ] SVG borttagen ur upload-allowlist (eller sanerad); magic-byte-koll finns
- [ ] Login-rate-limit failar STÄNGT; övriga buckets oförändrade
- [ ] Shop-kassans nedströms-actions rate-limitade
- [ ] R2-utkastrisken dokumenterad i `5-Kod/docs/ops/`
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- `safeNext`-skärpningen bryter en legitim djuplänk-redirect som testerna kräver —
  rapportera (regeln kan behöva tillåta specifika interna paths).
- Boknings-backstop-triggern blockerar en legitim personal-action (samma tenant) —
  backa migrationen och rapportera.
- Magic-byte-verifieringen kräver läsning av hela filen i minne på Workers och slår i
  minnestaket — rapportera; kolla bara de första N bytearna.
- R2-utkasthärdningen (steg 4) skulle kräva ändring i deploy-känslig wrangler-config —
  gör bara dokumentationsdelen, rapportera resten som egen plan.

## Maintenance notes

- När media flyttas till `media.corevo.se` (planerat i `upload.ts:92`): SÄK-03 blir
  KRITISK — säkerställ att SVG-härdningen är på plats FÖRE flytten.
- Open redirect: varje ny plats som läser `?next=`/redirect-param ska gå via `safeNext`.
- Reviewer: kontrollera att login-rate-limitens fail-closed inte kan låsa ute alla
  användare permanent vid en längre DB-störning (överväg en edge/in-memory-fallback).
