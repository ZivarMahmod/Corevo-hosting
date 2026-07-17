# Plan 007: Stäng fyra UX/CRUD-luckor i ägaradmin (kontaktinkorg, GDPR-radera, skapa kund, bekräftelsemönster)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- "5-Kod/apps/web/app/(admin)/admin/kunder" 5-Kod/apps/web/lib/admin/kontakt 5-Kod/apps/web/components/platform/ContactInboxCard.tsx 5-Kod/apps/web/lib/gdpr 5-Kod/apps/web/components/kund/CancelButton.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (GDPR-radering är irreversibel — kräver ägar-guard + tvåstegsbekräftelse)
- **Depends on**: none
- **Category**: bug / tech-debt (CRUD-asymmetri)
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Corevos CRUD-UX är genomgående mogen (nästan varje entitet har create/edit/delete
bakom ett tvåstegs-"arm"-mönster). Men fyra verifierade asymmetrier finns i
ägar-adminytan:

1. **Kontaktmeddelanden har ingen inkorg i ägaradmin** — bara plattforms-superadmin
   kan läsa/arkivera dem. Kunder skriver, ägaren ser aldrig.
2. **GDPR-radera kunddata utlovas i UI men leder till en återvändsgränd** —
   maskineriet finns (`eraseCustomerData`), men bara kopplat till kundens
   självbetjäning, inte ägarens admin. Ägaren kan inte uppfylla en art.17-begäran.
3. **Ingen "skapa kund" i admin** — front-desk måste skapa en bokning först för att
   få in en stamkund (CRUD minus create).
4. **Kvarvarande `window.confirm`** i kundportalens avboknings-knapp bryter husets
   annars enhetliga tvåstegs-bekräftelsemönster.

## Current state

Repo: pnpm-monorepo i `5-Kod/`, app `apps/web`. Kommandon från `5-Kod/`. Svenska
kodkommentarer. Server actions returnerar en `ActionState` (`state.success`/`state.error`)
och UI:t använder `useActionState` + pending — matcha det.

### 1. Kontaktinkorgen (finns för plattform, saknas för ägare)

- Publika formuläret skapar rader: `components/storefront/kontakt/ContactForm.tsx`
  → `submitContactMessage`.
- Läsvägen finns redan och RLS tillåter salongsadmin:
  `lib/admin/kontakt/data.ts:15` — `listContactMessages(tenantId)`.
- Statusändring finns redan: `setContactMessageStatus` (new/read/archived).
- Men inkorgs-UI:t renderas ENBART i plattformsytan:
  `components/platform/ContactInboxCard.tsx` monterad i
  `app/(platform)/salonger/[id]/page.tsx:588`.
- **Verifierat**: det finns ingen `app/(admin)/admin/kontakt/`-mapp (jämför att
  `app/(admin)/admin/offerter/page.tsx` finns — offerter har ägaryta, kontakt inte).

### 2. GDPR-radera (dead-end)

- `components/admin/SettingsV2.tsx:177` — FAROZON länkar "Radera kunddata …
  Anonymisering kräver extra bekräftelse → Öppna /admin/kunder".
- `app/(admin)/admin/kunder/[id]/page.tsx` renderar `CustomerNoteEditor`,
  `CustomerFlags` (Dölj = soft), `CustomerPrivacyForm`, `CustomerContactCard`,
  `CustomerExport` — INGEN anonymisera/radera-kontroll.
- Backend finns: `lib/gdpr/erase.ts:29` — `eraseCustomerData`, idag bara kopplad till
  självbetjäning `eraseMyAccount` (`lib/gdpr/actions.ts:23`).
- `CustomerFlags.tsx:10` säger uttryckligen "GDPR-radering är en ANNAN väg".

### 3. Skapa kund

- `app/(admin)/admin/kunder/page.tsx` — listar/söker/exporterar, ingen "Ny kund".
- **Verifierat**: `lib/admin/actions.ts` har `setCustomerPrivacy/Hidden/SelfBook`,
  `saveCustomerNote`, `saveCustomerContact` — men INGEN `createCustomer`. Kunder
  skapas bara via `signUpCustomer` (självreg) eller `createWalkIn`
  (`lib/personal/actions.ts`, via bokning).

### 4. window.confirm

- `components/kund/CancelButton.tsx:18` — `if (!window.confirm('Vill du avboka den här tiden?'))`.
  Enda kvarvarande `window.confirm`; `MediaLibrary.tsx:251` + `PresentkortAdmin.tsx:160`
  dokumenterar att de ERSATTE det med tvåstegs-arm — följ deras mönster.

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | gröna               |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope**:
- `5-Kod/apps/web/app/(admin)/admin/kontakt/page.tsx` (skapa)
- `5-Kod/apps/web/app/(admin)/admin/kunder/page.tsx` (Ny kund-knapp/form)
- `5-Kod/apps/web/app/(admin)/admin/kunder/[id]/page.tsx` (GDPR-farozon)
- `5-Kod/apps/web/lib/admin/actions.ts` (ny `createCustomer` + admin-`eraseCustomer`)
- `5-Kod/apps/web/components/kund/CancelButton.tsx` (byt window.confirm)
- Nav: filen som listar admin-navposter (grep `nav-items` under `components/` — lägg
  Kontakt om inkorgen ska synas i menyn)
- Testfiler bredvid ovanstående

**Out of scope**:
- `components/platform/ContactInboxCard.tsx` — återanvänds, ändras inte (eller
  extrahera delad presentational-komponent om nödvändigt — men bryt inte plattformsytan).
- `lib/gdpr/erase.ts` — återanvänds som den är; wrappa, ändra inte kärnan.
- Self-signup/walk-in-vägarna — orörda.
- Soft-delete "Dölj" (`setCustomerHidden`) — behålls (radering är en ANNAN sak).

## Git workflow

- Direkt på `main`. En commit per lucka. Stil: `feat(admin): …` / `fix(admin): …`.
- Pusha inte; deploy är operatörens steg.

## Steps

### Step 1: Ägarens kontaktinkorg

Skapa `app/(admin)/admin/kontakt/page.tsx`: hämta `listContactMessages(tenant.id)`
(tenant resolvas som i andra admin-sidor — kopiera mönstret från
`app/(admin)/admin/offerter/page.tsx`), rendera inkorgen med new/read/archived-status
via `setContactMessageStatus`. Återanvänd `ContactInboxCard` om den är
tenant-agnostisk; är den plattformskopplad, extrahera den presentationella delen till
en delad komponent utan att ändra plattformsbeteendet. Lägg "Kontakt" i admin-navet
om övriga inkorgar (offerter) ligger där.

**Verify**: `pnpm build` → exit 0; sidan finns;
`grep -rn "listContactMessages" "apps/web/app/(admin)"` → 1 träff.

### Step 2: GDPR-radera i kundkortets farozon

Ny admin-action i `lib/admin/actions.ts`: `eraseCustomerData`-wrapper med (a)
ägarbehörighetskontroll via samma adminCtx/adminvakt som övriga actions i filen, (b)
tvåstegsbekräftelse i UI. Montera i `app/(admin)/admin/kunder/[id]/page.tsx` som en
FAROZON-sektion (samma tvåstegs-arm som `PresentkortAdmin.tsx`/`MediaLibrary.tsx`).
Uppdatera länken i `SettingsV2.tsx:177` så den pekar rätt (nu blir den sann).

**Verify**: `grep -rn "eraseCustomerData" "apps/web/lib/admin/actions.ts"` → 1 träff;
`pnpm typecheck` → exit 0. Test: action utan ägarbehörighet → nekas.

### Step 3: Skapa kund i admin

`createCustomer`-action i `lib/admin/actions.ts` (namn krav, kontakt valfri;
återanvänd valideringen från walk-in-vägen i `lib/personal/actions.ts`; tvinga
tenant ur JWT som övriga admin-actions). "Ny kund"-knapp + minimalt formulär i
`app/(admin)/admin/kunder/page.tsx`.

**Verify**: `grep -rn "createCustomer" apps/web/lib/admin/actions.ts` → 1 träff;
`pnpm test` → gröna (nytt test: skapar customer-rad med tenant ur JWT, inte ur formdata).

### Step 4: Byt window.confirm mot tvåstegs-arm

I `components/kund/CancelButton.tsx`: ersätt `window.confirm` med inline
tvåstegs-bekräftelse ("Avboka" → "Säker? Avboka") som `PresentkortAdmin.tsx:160`.

**Verify**: `grep -rn "window.confirm" apps/web/` → 0 träffar; `pnpm typecheck` → exit 0.

### Step 5: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → allt exit 0.

## Test plan

- `createCustomer`-test: tenant tas ur JWT (inte formData); tomt namn → fel.
- `eraseCustomerData`-admin-wrapper-test: utan ägarbehörighet → nekas; med → anropar
  `eraseCustomerData` för rätt customer_id + tenant.
- Kontaktinkorg: om page-render-tester finns under `app/(admin)`, följ mönstret.

## Done criteria

- [ ] `app/(admin)/admin/kontakt/page.tsx` finns och läser tenantens meddelanden
- [ ] Kundkortets farozon har en fungerande GDPR-radera bakom ägar-guard + tvåstegsbekräftelse
- [ ] `admin/kunder` har "Ny kund"; `createCustomer` tvingar tenant ur JWT
- [ ] `grep -rn "window.confirm" 5-Kod/apps/web/` → 0 träffar
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- `eraseCustomerData` visar sig ta andra parametrar än ett customer_id + tenant, eller
  gör antaganden om self-service-kontext (auth.uid) som inte gäller i admin — rapportera.
- `ContactInboxCard` är så plattformskopplad att återanvändning kräver ändringar i
  plattformsytan — rapportera i stället för att röra `(platform)`.
- Walk-in-valideringen går inte att återanvända utan att dra in bokningsberoenden —
  rapportera; `createCustomer` ska vara fristående.

## Maintenance notes

- När kundportalen v2 (designpaket 05, Codex arbetar där) landar kan avboknings-UX:en
  i `CancelButton` ersättas helt — håll bekräftelsen konsekvent med den.
- GDPR-raderingen bör logga i audit (samma audit-spår som andra destruktiva
  admin-actions) — verifiera att wrappern gör det.
- Reviewer: kontrollera att `createCustomer` ALDRIG tar tenant_id ur formData
  (mass-assignment-risk) och att GDPR-raderingen är ägar-guardad.
