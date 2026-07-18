# Plan 011: Snabba upp admin/sajt — döda auth-nätverksrundorna (getClaims) + realtime-last

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/lib/supabase/middleware.ts 5-Kod/apps/web/lib/auth/session.ts 5-Kod/apps/web/middleware.ts 5-Kod/packages/auth`

## Status

- **Priority**: P1 (upplevd långsamhet — Zivars klagomål: admin är inte snabb)
- **Effort**: M
- **Risk**: MED (auth-gaten byts — får inte tappa session/refresh)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `6cdd690`, 2026-07-17
- **Grund**: pg_stat_statements 2026-07-17 — app-queries är snabba/sällan; DB är EJ flaskhalsen.
  Latensen = auth-round-trips (verifierat i PERF-audit runda 1).

## Why this matters

Databasen är inte flaskhalsen (pg_stat_statements: appens SELECTs är < 5ms mean och
syns inte i toppen). Den upplevda långsamheten är auth-lagret: varje autentiserad
sidladdning betalar **minst två seriella `supabase.auth.getUser()`-anrop** —
middleware-grinden + DAL:ens identitetsläsning — och `getUser()` går varje gång till
Supabase Auth-servern (GoTrue `/user`) för att validera token över nätet (~100-200ms
styck) INNAN render börjar. På Cloudflare Workers räknas varje subrequest mot
CPU/subrequest-budgeten. Byt till lokal JWT-verifiering (`getClaims()`) så
auth-grinden blir ~0ms i stället för en nätverksrunda.

## Current state

Repo: `5-Kod/`, app `apps/web`. Kommandon från `5-Kod/`.

- `lib/supabase/middleware.ts:36` — `const { data } = await supabase.auth.getUser()`
  i `updateSession`, körs på VARJE matchande request (matcher i `middleware.ts` = allt
  utom statiska assets).
- `lib/auth/session.ts:36` — `getUser()` igen i DAL via `requireAdminArea`/`requirePortal`.
- `lib/gdpr/data.ts:29` — en tredje `getUser()`.
- `packages/auth/index.ts` — Supabase-klientfabrikerna (FROZEN G02). `getClaims()` finns
  i `@supabase/supabase-js` 2.106.2 och verifierar JWT LOKALT när projektet har
  **asymmetriska signeringsnycklar** aktiverade (annars faller den tillbaka på ett
  nätverksanrop och vinsten uteblir).

**Extern förutsättning (operatörssteg):** aktivera **JWT Signing Keys (asymmetriska)**
i Supabase-dashboard → Auth → Signing Keys. Utan dem verifierar `getClaims()` inte
lokalt. Dokumentera i `docs/ops/`.

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected |
|-----------|--------------------------|----------|
| Typecheck | `pnpm typecheck`         | exit 0   |
| Tests     | `pnpm test`              | gröna    |
| Build     | `pnpm build`             | exit 0   |
| Rök       | `pnpm --filter web dev` (port 3111) → logga in → navigera admin | snabbare, session håller |

## Scope

**In scope**:
- `5-Kod/apps/web/lib/supabase/middleware.ts` (getClaims i grinden)
- `5-Kod/apps/web/lib/auth/session.ts` (getClaims + återanvänd, ingen andra GoTrue-runda)
- `5-Kod/apps/web/lib/gdpr/data.ts` (getClaims där ägarskap räcker)
- `5-Kod/docs/ops/` (signing-keys-notis)

**Out of scope**:
- `packages/auth/index.ts` — FROZEN-kontraktet; lägg getClaims-användning i konsumenterna, inte i fabriken.
- Byte av session/refresh-strategi — `getUser()` gör token-refresh; behåll EN plats
  (middleware) som fortfarande kan refresha, byt bara de REDUNDANTA verifieringarna.
- Worker-bundle-optimering (egen plan — se maintenance).

## Steps

### Step 1: Verifiera lokal verifiering är möjlig

Bekräfta i dashboard att asymmetriska signing keys är på (annars STOP — getClaims
faller tillbaka på nätverk och planen ger ingen vinst). Dokumentera i ops.

### Step 2: middleware-grinden → getClaims

I `lib/supabase/middleware.ts`: byt `getUser()` mot `getClaims()` för själva
auth-grinden (finns claim = inloggad). BEHÅLL logiken som gör token-refresh om den
sker här (getClaims refreshar inte — om middleware är refresh-punkten, kör en billig
refresh-check separat). Läs `@supabase/ssr`-mönstret innan.

**Verify**: `pnpm typecheck` → 0; dev-rök: inloggning + navigering funkar, ingen utloggnings-loop.

### Step 3: DAL → återanvänd claims, ingen andra runda

I `lib/auth/session.ts`: byt DAL:ens `getUser()` mot `getClaims()` (tenant_id +
role-level finns REDAN i JWT via `custom_access_token_hook` — migr 0071). Ingen andra
GoTrue-runda behövs för att veta tenant/roll.

**Verify**: `grep -n "getUser\|getClaims" apps/web/lib/auth/session.ts` → getClaims; `pnpm test` → gröna.

### Step 4: gdpr/data.ts

Samma där ägar-uid räcker (getClaims ger `sub`).

**Verify**: `pnpm typecheck` → 0.

### Step 5: Full verifiering + latensmätning

**Verify**: `pnpm test && pnpm typecheck && pnpm build` → 0. Dev-rök: mät tid till
admin-sidan renderar före/efter (nätverksfliken: färre `/auth/v1/user`-anrop).

## Done criteria

- [ ] `grep -rn "auth.getUser()" apps/web/lib/supabase/middleware.ts apps/web/lib/auth/session.ts` → 0 (eller motiverad kvarvarande refresh-punkt)
- [ ] Signing-keys-förutsättningen dokumenterad i `docs/ops/`
- [ ] Session håller över navigering (ingen utloggnings-loop) — dev-rök
- [ ] `pnpm test && pnpm typecheck && pnpm build` → exit 0
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- Asymmetriska signing keys går inte att aktivera → getClaims verifierar inte lokalt;
  rapportera (planen är då inte värd att köra).
- Efter bytet loggas användare ut vid navigering (token-refresh tappades) → backa
  middleware-steget, behåll getUser DÄR (refresh-punkten), byt bara DAL-rundan.

## Maintenance notes

- Andra flaskhalsen är Worker-bundle/cold-start (18 MiB rå, ~3 MiB gz mot taket) — egen
  plan: code-splitting + lazy-load tunga admin-komponenter.
- Realtime pollar WAL:en tungt (1,26M anrop i pg_stat_statements). Bara `bookings`
  publiceras. Om last blir ett problem: överväg Broadcast-modellen (trigger→channel)
  i stället för postgres_changes. Se plan 012.
- Reviewer: säkerställ att EXAKT en plats fortfarande kan refresha token, och att
  ingen skyddad yta nu bara läser en overifierad claim (getClaims verifierar signatur —
  det är poängen; men bekräfta att fallbacken inte tyst blev nätverksfri-utan-verifiering).
