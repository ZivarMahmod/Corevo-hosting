# Plan 002: Stäng fyra säkerhetsluckor (anon-inserts, CSS-sink, cookieflaggor, loggscrub)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- 5-Kod/supabase/migrations "5-Kod/apps/web/app/(public)/layout.tsx" 5-Kod/apps/web/app/boka/layout.tsx "5-Kod/apps/web/app/avboka/[id]/page.tsx" 5-Kod/packages/auth/index.ts 5-Kod/apps/web/lib/observability`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (RLS-policyändring + cookie-beteende — båda har tydliga verifieringssteg)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Fyra bekräftade svagheter, alla defensivt underhåll före kundlansering:

1. **Anon-direktinsert förbi app-lagret.** RLS-policyerna för `contact_messages`
   och `offert_requests` har `with check (true)` för anon. Den publika anon-nyckeln
   ligger i klientbundlen, så vem som helst kan POSTa rader med valfritt `tenant_id`
   direkt mot PostgREST — förbi honeypot, rate-limit och tenant-resolutionen i
   `lib/storefront/{kontakt,offert}/intake.ts`. Resultat: spam/lagrings-DoS rakt in
   i salongernas inkorgar.
2. **Osanerad CSS-sink.** Tre layouter injicerar `settings.customOverride.css` rått i
   `<style dangerouslySetInnerHTML>`. Skrivvägen är död (ingen action skriver fältet),
   men ligger något i fältet exekveras det i varje besökares webbläsare (lagrad XSS
   via `</style><script>`). Död skrivväg + levande sink = ta bort sinken.
3. **Cookieflaggor implicita.** `cookieOptions()` i `packages/auth/index.ts` sätter
   bara `domain`. `secure`/`sameSite` förlitar sig på bibliotekets defaults, och
   kommentaren föreslår `AUTH_COOKIE_DOMAIN=.corevo.se` — vilket skulle skicka
   super-admin-sessionen till varje tenant-storefront. Gör flaggorna explicita och
   dokumentera footgunen.
4. **Ostrubbad felmetadata.** `captureException` i `lib/observability` loggar rått
   `Error.message` + full stack; `redact()` maskerar bara context-NYCKLAR. Ett kastat
   fel med interpolerad användardata loggas oredigerat.

## Current state

Repo: pnpm-monorepo i `5-Kod/`. Kommandon körs från `5-Kod/`. Kodkommentarer på svenska.
Migrationer: numrerade filer i `5-Kod/supabase/migrations/`, högsta idag är
`0080_site_revisions.sql`. **Repokonvention: varje migrationsfil börjar med en
kommentarrad med filnamnet** (operatören klistrar in dem i Supabase SQL Editor och
behöver se vilken flik som är vilken), t.ex. `-- 0083_anon_insert_hardening.sql`.
Migrationer appliceras INTE av dig — de läggs i repot och operatören kör dem.

### 2a. Anon-insert-policyerna

`5-Kod/supabase/migrations/0057_claude_design_platform_gaps.sql:102-123` — tabellen +
policyn (kolumner: `id`, `tenant_id uuid not null references tenants(id)`, `name`,
`email`, …):

```sql
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  ...
-- rad 120-123:
  for insert with check (true);
```

`5-Kod/supabase/migrations/0033_offert_module.sql:105-171` — samma mönster:

```sql
grant insert on public.offert_requests to anon, authenticated;   -- rad 156
...
  for insert to anon
  with check (true);                                             -- rad 170-171
```

App-lagrets riktiga insert-väg: `5-Kod/apps/web/lib/storefront/kontakt/intake.ts`
och `5-Kod/apps/web/lib/storefront/offert/intake.ts` (server-side, resolver tenant
själva — läs båda innan du skriver migrationen så du vet vilken klient de använder;
använder de service-rollen påverkas de inte alls av skärpt anon-policy).

### 2b. CSS-sinken (tre filer, identiskt mönster)

`5-Kod/apps/web/app/(public)/layout.tsx:74` + `:214-218`:

```tsx
  const overrideCss = settings.customOverride?.css
  ...
      {overrideCss ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-tenant="${tenant.id}"]{${overrideCss}}`,
          }}
```

`5-Kod/apps/web/app/boka/layout.tsx:32` + `:46-49` — samma.
`5-Kod/apps/web/app/avboka/[id]/page.tsx:62-64` — samma (enradsvariant).

Datakällan: `5-Kod/apps/web/lib/tenant-data.ts:77` (`customOverride: CustomOverride | null`)
och `:151` (`customOverride: hasCss ? override : null`). Skrivvägen är borttagen —
`lib/platform/tenants.ts:129` beskriver den som "phantom Nivå-3-branch".

### 2c. Cookieflaggorna

`5-Kod/packages/auth/index.ts:28-32`:

```ts
function cookieOptions() {
  return {
    ...(AUTH_COOKIE_DOMAIN ? { domain: AUTH_COOKIE_DOMAIN } : {}),
  }
}
```

Kontext: filen är märkt "FROZEN contract (G02)" — ändringen här är minimal och
additiv (flaggor, inte kontrakt). Kommentaren på rad 13 ("Session shared across
*.corevo.se subdomains") är historisk — sedan goal-27 är cookien host-locked per
dörr och `AUTH_COOKIE_DOMAIN` är tom i prod. OBS: `@supabase/ssr` (0.10.3) skriver
över `maxAge` med sina defaults (dokumenterat i filens kommentar rad 16-21) — men
`secure` och `sameSite` överlever spread:en.

### 2d. Loggscrubben

`5-Kod/apps/web/lib/observability/index.ts` — `captureException` gör
`log('error', message, { ...context, stack })`; `redact()` maskerar bara nycklar som
matchar secret-regexen. Läs hela filen innan ändring.

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | alla gröna          |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope**:
- `5-Kod/supabase/migrations/0083_anon_insert_hardening.sql` (skapa — 0081/0082 är
  TAGNA av goal-71 tenant_member_permissions; använd nästa lediga, verifiera med `ls`)
- `5-Kod/apps/web/app/(public)/layout.tsx`
- `5-Kod/apps/web/app/boka/layout.tsx`
- `5-Kod/apps/web/app/avboka/[id]/page.tsx`
- `5-Kod/apps/web/lib/tenant-data.ts` (endast om sink-borttagningen gör
  `customOverride`-fältet helt oanvänt — grep först)
- `5-Kod/packages/auth/index.ts`
- `5-Kod/apps/web/lib/observability/index.ts` (+ dess testfil)

**Out of scope**:
- `lib/storefront/kontakt/intake.ts`, `lib/storefront/offert/intake.ts` — läses för
  förståelse, ändras inte.
- Alla befintliga migrationsfiler — appliceras aldrig om, skärpningen är en NY migration.
- Auth-flödet i övrigt (login/actions) — bara cookie-flaggorna.
- `join_loyalty_club`-granten (0057:313) — den är en SECURITY DEFINER-funktion med
  egen validering, inte samma klass av problem.

## Git workflow

- Direkt på `main` (repots konvention). En commit per steg.
- Commit-stil: `fix(säkerhet): …` / `chore(db): …`.
- Pusha inte; deploy och migrationskörning är operatörens steg.

## Steps

### Step 1: Migration som skärper anon-insert-policyerna

Skapa `5-Kod/supabase/migrations/0083_anon_insert_hardening.sql`. Första raden ska
vara `-- 0083_anon_insert_hardening.sql`. Innehåll: DROP + CREATE av de två
insert-policyerna så att `with check` kräver att `tenant_id` pekar på en existerande
AKTIV tenant (kolla i migration 0004/0057 hur "aktiv tenant" uttrycks — det finns en
statuskolumn eller `deleted_at`; matcha den befintliga publika läspolicyn
`tenants_public_read`):

```sql
-- 0083_anon_insert_hardening.sql
-- Anon-inserts till kontakt/offert måste referera en existerande aktiv tenant.
-- with check (true) lät vem som helst med anon-nyckeln POSTa mot valfritt tenant_id.
drop policy if exists contact_messages_public_insert on public.contact_messages;
create policy contact_messages_public_insert on public.contact_messages
  for insert with check (
    exists (select 1 from public.tenants t where t.id = tenant_id /* + samma aktiv-villkor som tenants_public_read */)
  );
-- motsvarande för offert_requests (behåll "to anon"-formen från 0033)
```

Läs policyernas EXAKTA namn i 0057/0033 först (`grep -n "create policy" …`).
Verifiera också att intake-vägarna använder service-klienten (då opåverkade) —
använder de anon-klienten måste villkoret täcka deras insert (de sätter alltid ett
riktigt tenant_id, så EXISTS-villkoret passerar ändå).

**Verify**: filen finns, rad 1 = `-- 0083_anon_insert_hardening.sql`, och
`grep -c "with check (true)" 5-Kod/supabase/migrations/0083_anon_insert_hardening.sql` → 0.
(Notera i PR/commit-text att migrationen ska köras i Supabase SQL Editor av operatören.)

### Step 2: Ta bort CSS-sinken i tre filer

I `app/(public)/layout.tsx`, `app/boka/layout.tsx`, `app/avboka/[id]/page.tsx`:
ta bort `const overrideCss = …`-raden och hela `{overrideCss ? (<style …/>) : null}`-blocket.
Grep sedan efter kvarvarande användning av `customOverride` i `apps/web/` — om
`lib/tenant-data.ts` är enda kvarvarande konsumenten, lämna datalagret orört (fältet
kan återuppstå med sanering senare) men lägg en kommentar vid fältet:
`// OBS: render-sinken borttagen (plan 002) — återinför ALDRIG utan CSS-sanering.`

**Verify**: `grep -rn "overrideCss" 5-Kod/apps/web/app/` → 0 träffar;
`pnpm typecheck` → exit 0; `pnpm build` → exit 0.

### Step 3: Explicita cookieflaggor

I `packages/auth/index.ts`, uppdatera `cookieOptions()`:

```ts
function cookieOptions() {
  return {
    // Explicit i stället för biblioteks-default. secure endast där https finns —
    // localhost-dev kör http och en secure-cookie skulle aldrig sättas där.
    ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
    sameSite: 'lax' as const,
    ...(AUTH_COOKIE_DOMAIN ? { domain: AUTH_COOKIE_DOMAIN } : {}),
  }
}
```

Uppdatera även den stale kommentaren på rad 13-14: cookien är host-locked per dörr
sedan goal-27; skriv explicit att `AUTH_COOKIE_DOMAIN` ALDRIG får sättas till
`.corevo.se` (super-admin-sessionen skulle läcka till varje tenant-subdomän).

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → gröna. Manuell rök om dev-server
finns: logga in på `http://localhost:3111` → inloggning fungerar (secure-flaggan får
inte gälla i dev).

### Step 4: Scrubba captureException-payloaden

I `lib/observability/index.ts`: trunkera `message` (t.ex. 500 tecken), kör
värde-scrub (inte bara nyckel-scrub) på message + context-värden för uppenbara
PII-mönster (e-post, telefonnummer) med enkla regexer, och utelämna `stack` när
`process.env.NODE_ENV === 'production'`. Följ filens befintliga stil; utöka
befintlig testfil med fall: e-post i message → maskad; stack i prod → utelämnad.

**Verify**: `pnpm --filter web exec vitest run lib/observability` → gröna.

### Step 5: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → allt exit 0.

## Test plan

- Ny/utökad test för `observability` (steg 4-fallen).
- Migrationen kan inte integrationstestas här (ingen lokal DB-gate i CI ännu) —
  verifieringen är statisk (grep) + operatörens körning. Notera i commit-texten:
  efter applicering, verifiera i SQL Editor att
  `insert into contact_messages (tenant_id, name) values ('00000000-0000-0000-0000-000000000000','x')`
  som anon NEKAS.
- Befintliga sviter får inte brytas: `pnpm test` grönt är gaten.

## Done criteria

- [ ] `0083_anon_insert_hardening.sql` finns, rad 1 är filnamnskommentaren, inga `with check (true)`
- [ ] `grep -rn "overrideCss" 5-Kod/apps/web/app/` → 0 träffar
- [ ] `grep -n "secure" 5-Kod/packages/auth/index.ts` → minst 1 träff i `cookieOptions`
- [ ] Observability-tester för scrub finns och är gröna
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → exit 0
- [ ] Inga filer utanför in-scope ändrade (`git status`)
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- Policynamnen i 0057/0033 matchar inte det du hittar med grep — rapportera i stället
  för att gissa.
- `lib/storefront/kontakt/intake.ts` eller `offert/intake.ts` visar sig använda
  ANON-klienten OCH sätta tenant_id på ett sätt EXISTS-villkoret inte täcker.
- Sink-borttagningen bryter typecheck på ett sätt som kräver ändringar utanför
  in-scope-listan.
- Inloggning i dev slutar fungera efter steg 3 (cookie sätts inte) — backa steget
  och rapportera.

## Maintenance notes

- Om custom-CSS-funktionen någonsin återupplivas: kräver CSS-parser/whitelist +
  escapening av `<` och `}` innan injektion — aldrig rå interpolation.
- Om en framtida bransch-modul vill ha anon-inserts till ny tabell: kopiera
  EXISTS-mönstret från 0081, aldrig `with check (true)`.
- Granskare: kontrollera att steg 1 behåller `to anon`-formen för offert (0033) så
  authenticated-flödet inte påverkas.
