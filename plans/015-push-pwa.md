# Plan 015: Push-pipeline + PWA — billigaste kanalen + adoptionsspelet

> **Executor instructions**: Följ steg för steg, verifiera varje steg. STOP-villkor
> gäller. Uppdatera statusraden i `plans/README.md` när klar.
>
> **Drift check**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/app/api/pwa 5-Kod/apps/web/public 5-Kod/supabase/functions | head`

## Status

- **Priority**: P2 (billigaste kanalen + adoption, men efter identitet + ryggrad)
- **Effort**: L
- **Risk**: MED (VAPID-nycklar, service worker, iOS-push-begränsningar)
- **Depends on**: 013 (kundsubjekt), 014 (router+outbox väljer push först), PWA-install
- **Category**: feature / infra
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Push är billigast (0 kr) och bäst för appupplevelsen — och 0% byggt idag. Adoptionsspelet
("skapa konto → digitalt klippkort, snabbare ombokning, **inga fler SMS**") hänger på att
push faktiskt funkar och att kunden lägger till PWA:n på hemskärmen. Varje kund som flyttar
till push sänker SMS-notan (se DIREKTION SMS-övergångsmodell).

## Current state

- **0% push**: ingen `push_subscriptions`-tabell, inga VAPID-nycklar, ingen web-push-kod.
- Enda PWA-artefakt: statisk **personal**-manifest `app/api/pwa/personal-manifest/route.ts`
  som explicit säger "Ingen service worker".
- Ingen `sw.js` / `app/manifest.ts` för kund-ytan.
- `send-email` edge function finns (`supabase/functions/send-email/index.ts`) = mönstret att
  spegla för uniform dispatch (plan 012).

## Scope

**In scope**:
- VAPID-nycklar (env, operatör genererar — committas ALDRIG).
- Ny migration (>=0089): `push_subscriptions`.
- Kund-PWA: `app/manifest.ts` (webbmanifest) + service worker (push + notificationclick).
- Klient: begär push-tillstånd efter konto-claim (013), prenumerera, POST till server-action.
- `supabase/functions/send-push/` edge function (web-push/VAPID — speglar send-email).
- Wire push-grenen i routern (014) + outbox-rad per push.
- `lib/gdpr/erase.ts` (nå push_subscriptions).

**Out of scope**:
- Ägar/personal-PWA (finns redan som statisk manifest) — rör inte.
- `konto.` som egen subdomän — installera från `/konto` på tenant-host räcker.

## Steps

### Step 1: VAPID-nycklar (operatörssteg)
Generera VAPID-par, lägg som Supabase-/Worker-secrets (`VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Committa aldrig privatnyckeln. Publik nyckeln
exponeras till klienten. Dokumentera i `docs/ops/`.

**Verify**: secrets satta; publik nyckel når klienten (env-check).

### Step 2: push_subscriptions
Ny tabell: `id, tenant_id, customer_id, endpoint text unique, p256dh text, auth text,
user_agent text, created_at, last_seen_at, revoked_at null`. RLS: kund äger egen; service-role
läser för sändning. Unik på `endpoint`.

**Verify**: `insert`/`select` i DEMO; kund-RLS tillåter egen, nekar annans.

### Step 3: kund-webbmanifest + service worker
`app/manifest.ts` (namn/ikoner/theme per tenant-branding om möjligt, annars Corevo-default,
`display: standalone`). Service worker med `push`-handler (visa notis) + `notificationclick`
(öppna rätt `/konto`-djuplänk). Registrera SW på kund-ytan.

**Verify**: Lighthouse/DevTools "installable"; SW registreras; test-push visar notis.

### Step 4: prenumerera efter konto-claim
Efter lyckad claim (013) / på `/konto`: fråga om push-tillstånd (vision: "kunden får välja
pushnotiser" + "uppmanas lägga till PWA på hemskärmen"). Vid ja: `pushManager.subscribe`
med publika VAPID-nyckeln, POST subscription till server-action → `push_subscriptions` +
sätt `customer_notification_prefs.push_enabled=true` (plan 014).

**Verify**: DEMO — claima kort, godkänn push ⇒ rad i `push_subscriptions` + `push_enabled=true`.

### Step 5: send-push edge function
`supabase/functions/send-push/index.ts` speglar `send-email`: tar `{customer_id, title,
body, url}`, hämtar subs, skickar web-push (VAPID). 410/404 från endpoint ⇒ sätt
`revoked_at` (städa döda subs). Degraderar tyst när VAPID saknas.

**Verify**: `supabase functions deploy send-push` (operatör); testanrop mot DEMO-sub ⇒ notis;
död endpoint ⇒ `revoked_at` satt.

### Step 6: wire routern + outbox
Routern (014) väljer push först när aktiv sub finns + `push_enabled`. Push-send skriver
outbox-rad (`chosen_channel=push, cost_ore=0`). Pilot: bokningsbekräftelse (samma kanal som
014 migrerade) provar push→e-post-fallback.

**Verify**: DEMO app-kund med sub ⇒ bekräftelse går via push, outbox visar push; ingen
sub ⇒ faller till e-post.

### Step 7: GDPR
`lib/gdpr/erase.ts` når `push_subscriptions` (radera/revoke vid erase).

**Verify**: erase DEMO-kund ⇒ subs borta.

## Done criteria

- [ ] VAPID-secrets satta + dokumenterade; privatnyckel aldrig committad
- [ ] `push_subscriptions` med RLS; döda subs städas (410/404 → revoked)
- [ ] Kund-PWA installbar; SW visar push + öppnar djuplänk
- [ ] Prenumeration efter claim skriver sub + `push_enabled`
- [ ] `send-push` deployad; routern väljer push först, fallback funkar
- [ ] Push-utskick loggas i outbox
- [ ] Erase når subs; `pnpm test && pnpm typecheck` → 0; README-statusrad uppdaterad

## STOP conditions

- VAPID-nycklar går inte att sätta som secrets → push kan inte skickas; rapportera.
- iOS kräver att PWA:n är tillagd på hemskärmen för push — dokumentera begränsningen, tvinga
  inte; e-post/SMS-fallback (014) bär de kunderna.
- SW-registrering krockar med Workers/OpenNext-assets → verifiera SW serveras som statisk asset
  på rätt scope innan push-tester.

## Maintenance notes

- Push är förutsättningen för adoptionsdashboarden (020) och den billigaste kanalen i
  SMS-övergångsmodellen — mät andelen kunder med aktiv sub över tid (ur `push_subscriptions`).
- SW-scope: en per tenant-host. Håll SW liten (Workers 3 MiB-tak gäller bundlen; SW är separat
  asset men håll den mager).
