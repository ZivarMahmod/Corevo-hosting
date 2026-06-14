# goal-27 — Admin-split: 3 dörrar (superbooking / booking / minbooking)
Thinking: 🔴 (auth-grind/routing, flera filer, nytt flöde — rollback obligatorisk + Zivar-OK före middleware-ändring & deploy)

## Mål
Tre separata inloggnings-"dörrar", host-baserat:
- **`superbooking.corevo.se`** → super/plattform-admin (Zivar). Route-grupp `app/(platform)`.
- **`booking.corevo.se`** → salong-admin. Route-grupp `app/(admin)` (`/admin`).
- **`minbooking.corevo.se`** → personal/anställda (loggar in → ser sina egna scheman). Route-grupp `app/(personal)` (`/personal`).

Per-host login, **host-låsta cookies**, ingen ändring i den frysta auth-koden.

## Lägeskoppling
`1-Planering/04-hosting-onboarding/00-plan-bokningslage.md`. Den planerade "dela plattform-/salong-admin" från HANDOFF, nu utökad med personal-dörren. Föregår Goal A (boknings-läge) + Goal B (admin-kontroll bor på superbooking). Scoping denna session: LIGHT vs HEAVY → **LIGHT**.

## Kontext (as-built, verifierat 2026-06-14)
- Host klassas i `lib/tenant.ts` → `getTenantFromHost()` → `kind`. Idag: `booking.corevo.se = 'platform'` och serverar super_admin + salon_admin + personal **tillsammans** = problemet. `corevo.se` apex = `'root'` (POS, **separat system — RÖR EJ**).
- Route-grupper redan separerade: `app/(platform)/*` (dashboard på `/` via rewrite; + `/salonger /fakturering /kunder /roller /installningar /drift-och-logg /integrationer /personal-plattform`), `app/(admin)/*` (`/admin/*`), `app/(personal)/*` (`/personal/*`), `app/(auth)` = `/login`.
- Roll→hem: `lib/auth/roles.ts` `portalHomeFor`: platform_admin→`/`, salon_admin→`/admin`, staff→`/personal`.
- Befintlig grind ("step-4b") i `middleware.ts` bouncar redan platform_admin av `/admin`+`/personal`. **Generalisera till 3-host-grind.**
- Cookies: `AUTH_COOKIE_DOMAIN` UNSET → **host-låsta cookies**. RÄTT för splitten — behåll. `packages/auth/index.ts` = **FRYST (G02), RÖR EJ.**
- wrangler custom_domains idag: `booking.corevo.se` + `freshcut.corevo.se`. Zivar har redan lagt `superbooking.corevo.se` i CF-dashboarden. **`minbooking.corevo.se` måste också läggas (Zivar ops, samma steg).**
- Superadmin = `zivar.mahmod@corevo.se` (`platform_admin:true`).

## Berörda filer
- `5-Kod/apps/web/lib/tenant.ts` — host-klasser för superbooking + minbooking (ur env), behåll booking. Lägg båda i reserved.
- `5-Kod/apps/web/middleware.ts` — 3-host-grind (se Steg). **KÄNSLIGASTE filen.**
- `5-Kod/apps/web/lib/auth/roles.ts` (+ `roles.test.ts`) — host-medveten post-login.
- `5-Kod/apps/web/wrangler.jsonc` — routes superbooking + minbooking + env-host-namn + reserved.
- `5-Kod/apps/web/acceptans/` (E2E) — 3-host-grind-förväntningar.

## Steg (handlingar — bekräfta prefix-listorna mot faktiska route-grupperna)
1. `lib/tenant.ts`: host-klass `superadmin` för `NEXT_PUBLIC_SUPERADMIN_HOST` (superbooking) och `staff_portal` för `NEXT_PUBLIC_STAFF_HOST` (minbooking). Härled prefix-listorna ur `app/(platform)`, `app/(admin)`, `app/(personal)` (nedan = förväntad baslinje).
2. `middleware.ts` 3-host-grind (kring befintlig step-4b):
   - **PLATFORM_PREFIXES** (`app/(platform)`): `/platform,/salonger,/fakturering,/kunder,/roller,/installningar,/drift-och-logg,/integrationer,/personal-plattform` (+ `/`-rewriten).
   - **SALON_ADMIN_PREFIXES** (`app/(admin)`): `/admin`.
   - **STAFF_PREFIXES** (`app/(personal)`): `/personal`.
   - Host `superadmin` (superbooking): tillåt ENBART PLATFORM_PREFIXES + `/login`,`/ingen-atkomst`,`/api`,statiska. Annat → bounce.
   - Host `platform` (booking): tillåt ENBART SALON_ADMIN_PREFIXES + auth. PLATFORM_PREFIXES → redirect superbooking; STAFF_PREFIXES → redirect minbooking.
   - Host `staff_portal` (minbooking): tillåt ENBART STAFF_PREFIXES + auth. Annat → redirect rätt host.
   - **`/`-rewriten** till plattform-dashboard gatas till superbooking. På booking `/` → salong-entry (login/`/admin`); på minbooking `/` → `/personal` (el. login).
   - Inloggad-fel-host → redirect till rätt host per roll (`portalHomeFor`-host). Edge: host-låsta cookies → ingen session på andra hosten → logga in där. Acceptabelt v1, dokumentera.
   - Behåll DAL-fence (`requirePlatformAdmin`/`requirePortal`) — rör ej DAL.
3. `lib/auth/roles.ts`: per-host login funkar via host-låsta cookies (super→superbooking→`/`; salon_admin→booking→`/admin`; staff→minbooking→`/personal`). Post-login-redirect **relativ**. Uppdatera `roles.test.ts`.
4. `wrangler.jsonc`: **deklarera ALLA custom_domains här så deployen skapar dem (då slutar de försvinna):** `booking.corevo.se`, `freshcut.corevo.se`, `superbooking.corevo.se`, `minbooking.corevo.se`, `salongzorbar.corevo.se`. `vars`: `NEXT_PUBLIC_SUPERADMIN_HOST=superbooking.corevo.se`, `NEXT_PUBLIC_STAFF_HOST=minbooking.corevo.se`, lägg `superbooking`+`minbooking` i `NEXT_PUBLIC_RESERVED_SUBDOMAINS`. (Framtida tenant-subdomäner: överväg en wildcard-route `*.corevo.se` istället för en rad per salong — separat ops-task.)

## Verifiering
**Bygg via `C:\tmp\kod`** (ö-sökväg kraschar opennext).
- [ ] typecheck 0 · lint 0 · vitest grönt (+ nya 3-host-grind-tester).
- [ ] opennext build PASS, grep-guard ren.
- [ ] (efter gatad deploy + Zivar-OK) Live:
  - [ ] `superbooking.corevo.se` → login → `zivar.mahmod@corevo.se` → plattform-dashboard, 0 console-fel. `/admin` + `/personal` → bounce.
  - [ ] `booking.corevo.se` → login → salon_admin → `/admin`. `/salonger` → redirect superbooking. `/personal` → redirect minbooking.
  - [ ] `minbooking.corevo.se` → login → staff → `/personal` (eget schema). Plattform/admin-routes → redirect.
  - [ ] `corevo.se` POS 200, ORÖRD.

## Anti-patterns
- Sätt **ALDRIG** `AUTH_COOKIE_DOMAIN=.corevo.se` (slår ihop sessions = upphäver splitten).
- Rör EJ `packages/auth/index.ts` (FRYST G02), auth-klienterna eller DAL.
- Rör EJ `corevo.se` (POS) / `kind:'root'`.
- Hårdkoda inte host-namn — env.
- Ingen autonom prod-deploy (gatad).

## Rollback (OBLIGATORISK — 🔴)
`git revert <commit>` + `wrangler rollback <prev-worker-id> --config 5-Kod/apps/web/wrangler.jsonc` + ta bort superbooking+minbooking-routes. Inga DB-ändringar. POS orörd.

## Domäner — varför de försvann + fix
`superbooking` + `salongzorbar` lades till för hand i CF-dashboarden men INTE i `wrangler.jsonc` → en deploy reconcilade till configen (bara `booking`+`freshcut`) och **rensade dem**. Fix: alla domäner i `wrangler.jsonc` (steg 4) → deployen skapar dem durabelt. **Ingen manuell CF-åtgärd behövs** — handlägg dem INTE i dashboarden (de ryker vid nästa deploy).

## Zivar-OK krävs
Middleware = auth-grind. Code: bekräfta plan kort INNAN middleware-ändring; deploy ENBART efter Zivars uttryckliga OK.
