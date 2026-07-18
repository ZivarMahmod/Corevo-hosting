# Plan 004: Självservice-lösenordsåterställning för alla tre inloggningsdörrar

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- "5-Kod/apps/web/app/(auth)" 5-Kod/packages/auth`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (auth-flöde; host-split-arkitekturen måste respekteras)
- **Depends on**: none
- **Category**: bug / lanseringsgrind ("driftas utan handpåläggning")
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Det finns ingen "Glömt lösenord"-väg någonstans: `resetPasswordForEmail` förekommer
inte i kodbasen och LoginForm saknar länken. Enda återställningsvägen är att en
plattformsadmin manuellt genererar en recovery-länk
(`lib/platform/actions/people.ts:32`, `auth.admin.generateLink` type `recovery`)
och kopierar den till användaren. Varje glömt ägar-/personal-lösenord blir alltså
ett supportärende hos operatören — oförenligt med målet att kunder driftas utan
handpåläggning.

## Current state

Repo: pnpm-monorepo i `5-Kod/`, kommandon från `5-Kod/`. Kodkommentarer på svenska.

**Arkitektur du MÅSTE respektera** (host-split, goal-27): tre inloggningsdörrar på
olika hosts — `superbooking.corevo.se` (plattform), `booking.corevo.se`
(tenant-admin), `minbooking.corevo.se` (slutkund) — plus tenant-storefronts på
övriga subdomäner. Auth-cookien är host-locked per dörr. Host-logiken bor i
`5-Kod/apps/web/lib/auth/host-routing.ts`. Recovery-länken i mejlet måste alltså
peka tillbaka på SAMMA host som begäran kom ifrån — en hårdkodad redirect-URL är fel.

Relevanta filer:

- `5-Kod/apps/web/app/(auth)/login/LoginForm.tsx` (64 rader) — klientformulär,
  `useActionState` mot `signIn` från `../actions`. Formulärets slut idag:

```tsx
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Loggar in…' : 'Logga in'}
      </button>
    </form>
```

- `5-Kod/apps/web/app/(auth)/actions.ts` — server actions för auth (`signIn` m.fl.).
  Läs hela filen: mönstret här (klienter, felhantering, redirects) är mallen för de
  nya actions.
- `5-Kod/apps/web/app/(auth)/` innehåller idag: `actions.ts`, `ingen-atkomst/`,
  `layout.tsx`, `login/`, `valkommen/`. `valkommen/AcceptInviteForm.tsx` är
  inbjudningsflödet — det SÄTTER redan lösenord efter en verifieringslänk och är
  närmaste befintliga mönster för "sätt nytt lösenord efter mejl-länk". Läs den.
- Supabase-klienter: `5-Kod/packages/auth/index.ts` (`createServerSupabase`,
  `createBrowserSupabase`). `resetPasswordForEmail` finns på
  `supabase.auth.resetPasswordForEmail(email, { redirectTo })` i supabase-js 2.x.

**Manuellt operatörssteg som planen ska dokumentera, inte utföra**: Supabase
Auth kräver att varje redirect-URL är vitlistad (Dashboard → Auth → URL
Configuration → Redirect URLs). De tre dörr-hostarnas
`https://<host>/login/aterstall` måste läggas till där. Dokumentera i
`5-Kod/docs/ops/` (det finns en ops-mapp — lägg en kort notis eller utöka
befintlig auth-relaterad fil).

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | alla gröna          |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |
| Dev-rök   | `pnpm --filter web dev` (port 3111) | flödet klickbart lokalt |

## Scope

**In scope**:
- `5-Kod/apps/web/app/(auth)/login/LoginForm.tsx` (länk)
- `5-Kod/apps/web/app/(auth)/glomt/page.tsx` + formulärkomponent (skapa)
- `5-Kod/apps/web/app/(auth)/login/aterstall/page.tsx` + formulär (skapa — route
  under login/ eller (auth)/ efter befintligt mönster; håll URL:en
  `/login/aterstall` eller `/aterstall`, konsekvent med `glomt`-valet)
- `5-Kod/apps/web/app/(auth)/actions.ts` (två nya server actions)
- `5-Kod/docs/ops/` (redirect-URL-notis)

**Out of scope**:
- `lib/platform/actions/people.ts` — admin-recovery-vägen behålls som fallback.
- `packages/auth/index.ts` — inga kontraktsändringar (FROZEN G02).
- Mejlmallen — Supabase Auths inbyggda recovery-mejl används som den är
  (mall-anpassning är en Dashboard-fråga, notera i ops-notisen).
- 2FA/step-up — planerat separat enligt HANDOFF.

## Git workflow

- Direkt på `main`. En commit per steg. Stil: `feat(auth): självservice lösenordsåterställning`.
- Pusha inte; deploy är operatörens steg (och redirect-URL:erna måste vitlistas
  FÖRE deploy för att flödet ska fungera live).

## Steps

### Step 1: Server action `requestPasswordReset`

I `app/(auth)/actions.ts`: ny action som tar e-post ur FormData, härleder aktuell
origin från request-headers (App Router: `headers()` → `host` + protokoll; se hur
befintlig kod i repot läser host — grep `headers()` under `app/(auth)`/`lib/auth`)
och kallar:

```ts
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${origin}/login/aterstall`,
})
```

**Svara alltid samma sak** oavsett om e-posten finns (ingen user-enumeration):
"Om kontot finns skickar vi en återställningslänk." Följ `signIn`-actionens
state-mönster (`SignInState`-stil).

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Glömt-sidan

`app/(auth)/glomt/page.tsx` + klientformulär i samma stil som `LoginForm.tsx`
(samma CSS-klasser: `auth-form`, `auth-field`, `btn-primary`, `auth-error`):
e-postfält + skicka-knapp + alltid-samma-bekräftelsetext efter submit.

**Verify**: `pnpm build` → exit 0.

### Step 3: Återställningssidan

`/login/aterstall`: när användaren klickar mejl-länken landar hen här med en
recovery-session (Supabase sätter den via länken — verifiera mot
`valkommen/AcceptInviteForm.tsx` hur invitationsflödet hanterar samma sak och
följ det mönstret exakt, inklusive ev. code-exchange). Formulär: nytt lösenord ×2,
server action som kallar `supabase.auth.updateUser({ password })`, därefter
redirect till `/login` med bekräftelse. Felfall: ogiltig/utgången länk → tydligt
fel + länk till `/glomt`.

**Verify**: `pnpm typecheck && pnpm build` → exit 0.

### Step 4: Länken i LoginForm

Under lösenordsfältet i `LoginForm.tsx`: `<a href="/glomt" className="auth-sub">Glömt lösenord?</a>`
(eller närmast motsvarande befintlig länkklass).

**Verify**: `grep -n "glomt" "5-Kod/apps/web/app/(auth)/login/LoginForm.tsx"` → 1 träff.

### Step 5: Ops-notis + lokal rök

Skriv/utöka en fil under `5-Kod/docs/ops/` med: de tre redirect-URL:erna som ska
vitlistas i Supabase Dashboard, och att recovery-mejlmallen kan varumärkas där.
Kör lokal rök: `pnpm --filter web dev`, gå till `/login` → "Glömt lösenord?" →
skicka → bekräftelsetext visas (mejl kommer inte lokalt utan Supabase-koppling —
UI-flödet räcker som rök).

**Verify**: dev-servern svarar 200 på `/glomt`; `pnpm test && pnpm lint` → exit 0.

## Test plan

- Action-test för `requestPasswordReset`: (a) välformad e-post → supabase-klientens
  `resetPasswordForEmail` kallas med redirectTo som slutar på `/login/aterstall`;
  (b) svaret är identiskt för okänd e-post (ingen enumeration). Mocka
  supabase-klienten som befintliga actions-tester i `app/(auth)`/`lib/` gör.
- Uppdateringsaction: lösenord < minimilängd → fel; mismatch mellan fälten → fel.

## Done criteria

- [ ] `/glomt` och `/login/aterstall` byggs och renderar formulär
- [ ] `grep -rn "resetPasswordForEmail" 5-Kod/apps/web/` → ≥1 träff (i actions)
- [ ] LoginForm länkar till `/glomt`
- [ ] Actions-tester gröna, ingen user-enumeration (samma svar oavsett konto)
- [ ] Ops-notis med redirect-URL:er finns under `5-Kod/docs/ops/`
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- `valkommen/AcceptInviteForm.tsx` visar ett code-exchange-mönster som kräver en
  route-handler (t.ex. `/auth/callback`) som inte finns — rapportera i stället för
  att uppfinna en callback-arkitektur.
- Host-härledningen visar sig opålitlig bakom Cloudflare (fel origin i
  `redirectTo`) — rapportera; lösningen kan behöva `lib/auth/host-routing.ts`-hjälp
  och den filen är känslig.
- `signIn`-actionens mönster matchar inte beskrivningen (drift).

## Maintenance notes

- När 2FA byggs (planerad step-up enligt HANDOFF) måste återställningsflödet
  omprövas (recovery + 2FA-reset är en egen attackyta).
- Reviewer: kontrollera no-enumeration-svaret och att redirectTo alltid härleds
  från requestens host — aldrig hårdkodad dörr.
- Admin-recovery-vägen (`people.ts`) finns kvar som fallback; ta inte bort den.
