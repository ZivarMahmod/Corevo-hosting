# Plan 001: Laga tre bekräftade buggar i betal-/notisrälsen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/lib/payments/settle.ts 5-Kod/apps/web/app/api/cron/pending-expiry/route.ts 5-Kod/apps/web/lib/notifications/reminders.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Tre verifierade buggar i pengarnas och notisernas väg:

1. **PayPal-köpta presentkort levereras aldrig.** Stripe-vägen och gratis-vägen
   mejlar presentkortskoden efter betalning, men PayPal-vägen (`settleShopOrderPaid`)
   gör det inte — kunden betalar, kortet utfärdas i DB, mejlet med koden uteblir.
2. **Utgångna webshop-reservationer sveps aldrig.** `prune_expired_shop_reserves()`
   finns i DB men anropas bara lazy inuti nästa `reserve_shop_order` — på en
   lågtrafikplattform hålls `reserved_qty` (lager + kursplatser) långt förbi
   30-min-TTL:n och kurser visas felaktigt fullbokade.
3. **Påminnelsestämpeln är inte compare-and-set.** Två överlappande cron-körningar
   kan båda läsa samma ostämplade bokningar och skicka dubbla påminnelser.

## Current state

Repo: pnpm-monorepo i `5-Kod/`. App: `5-Kod/apps/web` (Next.js App Router på
Cloudflare Workers via OpenNext, Supabase Postgres). Alla kommandon körs från `5-Kod/`.
Kodkommentarer skrivs på svenska i denna kodbas — matcha det.

### Fil 1: `5-Kod/apps/web/lib/payments/settle.ts` (74 rader)

Enda vägen som markerar en PayPal-order betald. Slutet av `settleShopOrderPaid`
(rad 64–73) ser ut så här idag:

```ts
  await admin
    .from('payments')
    .update({ status: 'succeeded' })
    .eq('order_id', args.orderId)
    .eq('tenant_id', order.tenant_id)
    .neq('status', 'refunded') // en sen re-leverans får ALDRIG återuppliva en refund

  // Committar lagret (stock_committed-latch → exakt en gång) + status pending/paid.
  await admin.rpc('mark_shop_order_paid', { p_order_id: args.orderId })
  return { ok: true }
```

`mark_shop_order_paid` (migration 0042) utfärdar orderns presentkort (rad med kod +
saldo i `gift_cards`), men leveransmejlet skickas av en separat funktion:

`5-Kod/apps/web/lib/notifications/gift.ts:52`:

```ts
export async function deliverIssuedGiftCards(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  orderId: string,
): Promise<void> {
```

Funktionen är idempotent (villkorat UPDATE på `emailed_at` — mejlar aldrig dubbelt).
Den anropas idag från exakt två ställen: `5-Kod/apps/web/app/api/stripe/webhook/route.ts`
(efter betald Stripe-order) och `5-Kod/apps/web/app/butik/actions.ts` (icke-betal-vägen).
PayPal-vägen saknar anropet.

### Fil 2: `5-Kod/apps/web/app/api/cron/pending-expiry/route.ts`

Cron-rutt (anropas var 15:e minut av `.github/workflows/cron-booking.yml`, skyddad
av `CRON_SECRET`-bearer). Rad 39 idag:

```ts
  const { data, error } = await admin.rpc('expire_abandoned_pending_bookings', { p_ttl_min: 30 })
```

DB-funktionen som saknar schemaläggning: `public.prune_expired_shop_reserves()`
(definierad i `supabase/migrations/0042_shop_purchase_rail.sql:125`, ersatt i
`0059_cart_line_kinds.sql:566`) — `returns integer` (antal frigjorda ordrar),
`security definer`, tar inga argument. Den gatar själv på `expires_at < now()` och
rör aldrig committade ordrar, så det är säkert att anropa den hur ofta som helst.

### Fil 3: `5-Kod/apps/web/lib/notifications/reminders.ts`

Urvalet filtrerar `reminded_at is null`, men stämpeln (ca rad 142) skrivs utan villkor:

```ts
    // Stamp regardless of transport result — degrade means "don't retry forever".
    await admin.from('bookings').update({ reminded_at: now.toISOString() }).eq('id', b.id)
    sent++
```

Två parallella körningar kan alltså båda passera urvalet och båda skicka.

## Commands you will need

| Purpose   | Command (från `5-Kod/`)        | Expected on success |
|-----------|--------------------------------|---------------------|
| Install   | `pnpm install`                 | exit 0              |
| Typecheck | `pnpm typecheck`               | exit 0              |
| Tests     | `pnpm test`                    | alla gröna          |
| Fokuserat | `pnpm --filter web exec vitest run lib/notifications` | alla gröna |
| Lint      | `pnpm lint`                    | exit 0              |

## Scope

**In scope** (enda filer du får ändra, plus ev. nya testfiler bredvid dem):
- `5-Kod/apps/web/lib/payments/settle.ts`
- `5-Kod/apps/web/app/api/cron/pending-expiry/route.ts`
- `5-Kod/apps/web/lib/notifications/reminders.ts`
- Nya/befintliga testfiler för ovanstående (t.ex. `lib/payments/settle.test.ts`)

**Out of scope** (rör INTE):
- `5-Kod/apps/web/app/api/stripe/webhook/route.ts` — Stripe-vägen fungerar redan.
- `supabase/migrations/**` — ingen DB-ändring behövs; funktionerna finns.
- `.github/workflows/cron-booking.yml` — schemat är oförändrat.
- `lib/notifications/gift.ts` — används som den är.

## Git workflow

- Jobba direkt på `main` (repots konvention — inga feature-branches).
- En commit per steg, conventional commits på svenska, t.ex.
  `fix(betalning): leverera presentkort även via PayPal-vägen`.
- Pusha inte och deploya inte — deploy sker via repots egen v*-taggpipeline av operatören.

## Steps

### Step 1: Leverera presentkort i PayPal-vägen

I `5-Kod/apps/web/lib/payments/settle.ts`: importera `deliverIssuedGiftCards` från
`@/lib/notifications/gift` och anropa den efter `mark_shop_order_paid`, före `return`:

```ts
  await admin.rpc('mark_shop_order_paid', { p_order_id: args.orderId })
  // Leverera orderns presentkort (idempotent — villkorat UPDATE på emailed_at).
  // Stripe-vägen och gratis-vägen gör redan detta; PayPal-vägen saknade det.
  await deliverIssuedGiftCards(admin, order.tenant_id, args.orderId)
  return { ok: true }
```

**Verify**: `pnpm typecheck` → exit 0, och
`grep -n "deliverIssuedGiftCards" apps/web/lib/payments/settle.ts` → 2 träffar (import + anrop).

### Step 2: Svep utgångna webshop-reservationer i cron-rutten

I `5-Kod/apps/web/app/api/cron/pending-expiry/route.ts`: efter det befintliga
`expire_abandoned_pending_bookings`-anropet, lägg till ett anrop till
`prune_expired_shop_reserves` (inga argument). Fel får inte fälla bokningssvepet —
följ ruttens befintliga felhanteringsmönster (läs hela filen först). Inkludera
resultatet (antal frigjorda) i ruttens JSON-svar/logg så körningar går att följa.

```ts
  const { data: pruned, error: pruneError } = await admin.rpc('prune_expired_shop_reserves')
```

**Verify**: `pnpm typecheck` → exit 0, och
`grep -n "prune_expired_shop_reserves" apps/web/app/api/cron/pending-expiry/route.ts` → minst 1 träff.

### Step 3: Gör påminnelsestämpeln till compare-and-set

I `5-Kod/apps/web/lib/notifications/reminders.ts`: lägg `.is('reminded_at', null)`
på stämpel-UPDATE:n och räkna `sent` bara när en rad faktiskt claimades. Med
supabase-js: kedja `.select('id')` på UPDATE:n och kolla att svaret innehåller rader.

```ts
    const { data: claimed } = await admin
      .from('bookings')
      .update({ reminded_at: now.toISOString() })
      .eq('id', b.id)
      .is('reminded_at', null) // CAS: bara den körning som claimar raden räknar den
      .select('id')
    if (claimed && claimed.length > 0) sent++
```

OBS: detta stänger dubbelräkningen i statistiken men inte dubbel-SÄNDNINGEN helt
(mejlet skickas före stämpeln). Om du vill stänga även den: claima raden FÖRE
sändning istället (UPDATE → om claimad, skicka). Välj före-sändning-claim om
omgivande kod gör det enkelt; annars räcker CAS-stämpeln — dokumentera valet i en
kodkommentar.

**Verify**: `pnpm --filter web exec vitest run lib/notifications` → gröna, och
`grep -n "is('reminded_at', null)" apps/web/lib/notifications/reminders.ts` → 1 träff (utöver urvalet).

### Step 4: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint` → allt exit 0.

## Test plan

- `lib/payments/settle.test.ts` (skapa om den inte finns; följ mönstret i närliggande
  `*.test.ts`-filer under `lib/`, mocka supabase-klienten som befintliga tester gör):
  - betald order → `deliverIssuedGiftCards` anropas med `(admin, order.tenant_id, orderId)`
  - redan betald order (`payment_status === 'paid'`) → ingen leverans, ingen RPC
  - beloppsmismatch → ingen leverans
- `lib/notifications/reminders`-testet: en rad som redan stämplats mellan urval och
  stämpel → `sent` ökar inte.

## Done criteria

- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm test` exit 0; nya tester för presentkortsleveransen finns och är gröna
- [ ] `grep -c "deliverIssuedGiftCards" 5-Kod/apps/web/lib/payments/settle.ts` ≥ 2
- [ ] `grep -c "prune_expired_shop_reserves" 5-Kod/apps/web/app/api/cron/pending-expiry/route.ts` ≥ 1
- [ ] Inga filer utanför in-scope ändrade (`git status`)
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- Excerpten i "Current state" matchar inte koden (drift sedan `6cdd690`).
- `deliverIssuedGiftCards`-signaturen skiljer sig från excerpten (tre parametrar).
- `prune_expired_shop_reserves` kräver argument (då har DB-schemat driftat — rapportera).
- Ett verifieringssteg failar två gånger efter rimligt fixförsök.

## Maintenance notes

- Om en riktig PayPal-integration per tenant byggs (payments-tabellen får
  provider-kolumn, se kommentaren i `settle.ts:59-63`), håll leveranssteget kvar i
  `settleShopOrderPaid` — det ska vara betalvägs-oberoende.
- Om cron flyttas från GitHub Actions (se plan 005) följer prune-svepet med gratis —
  det bor i rutten, inte i schemaläggaren.
- Granskare: kontrollera att presentkortsleveransen sker EFTER `mark_shop_order_paid`
  (kortet måste existera innan mejl).
