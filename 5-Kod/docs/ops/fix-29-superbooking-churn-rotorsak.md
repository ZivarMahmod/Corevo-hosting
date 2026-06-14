# fix-29 — superbooking "client-side exception" + login-churn: rotorsak

**Datum:** 2026-06-14 · **Status:** krascen EJ reproducerad; deleted-tenant AVFÄRDAD;
defensiv kod-härdning deployad; trolig rotorsak (stale cookie) **väntar Zivars
bekräftelse på den webbläsare som kraschade**.

## TL;DR
Det är **inte** ett server-/render-fel och **inte** den raderade anchor-tenanten
(dashboarden renderar felfritt med den, 0 console-fel — reproducerat live).
Den faktiska "client-side exception" gick **inte** att reproducera (ren webbläsare +
färsk super_admin → allt rent). **Trolig** (ej bevisad) orsak = **gammalt
webbläsar-tillstånd**, samma klass som [demo.corevo.se "403"] (stale Chrome-profil,
ej servern).

⚠️ Obevisat: jag fann INGET bevis att workern någonsin satt
`AUTH_COOKIE_DOMAIN=.corevo.se` (saknas i secrets, vars OCH wrangler.jsonc
git-historik — bara i `.env.example`/docs). Churn-reproduktionen nedan byggde på en
INJICERAD `.corevo.se`-cookie. Orsaken är därför trolig men kräver Zivars
bekräftelse. **Riktig verifiering:** Zivar öppnar superbooking på den webbläsare som
kraschade UTAN att rensa först (testar self-healen); kvarstår det → rensa
webbplatsdata / privat fönster.

## Bevis (reproducerat 2026-06-14)
- Inloggad super_admin på LIVE `superbooking.corevo.se` → **plattform-dashboarden
  renderar helt korrekt**, 0 console-fel, även med:
  - anchor-tenant `corevo-system` = `deleted` (PortalShell hoppar över `getTenantById`
    för `platform_admin` → tenant laddas aldrig → ingen krasch). **Suspect (a) avfärdad.**
  - tom DB (0 aktiva salonger) — alla KPI/metrics är null-säkra (`?? 0` / `?? []`).
- `AUTH_COOKIE_DOMAIN` är INTE satt på workern (varken `vars` eller `secret`) → cookies
  är host-låsta. I G12/G13 var defaulten `.corevo.se` (delad över subdomäner) — så en
  webbläsare som loggade in FÖRE goal-27 bär kvar den breda cookien.
- **Reproduktion av churn:** injicerade en `.corevo.se`-scopead `sb-<ref>-auth-token`
  (+ chunkar) med skräpvärde i en ren inloggad session → reload → **studsade direkt ut
  till `/login`**. Två cookies med samma namn (host-låst + `.corevo.se`) → servern läser
  den ogiltiga → sessionen ser utloggad ut → bounce. Det är "loggar ut hela tiden".
- Den minifierade "Application error: a client-side exception" har ingen graceful UI för
  att det saknades en `global-error`-boundary (route-`error.tsx` täcker bara sidan, inte
  layouten/hydrering). Ett stale JS-bundle (hydrerings-mismatch) ger samma skärm.

## Kod-härdning (denna fix — INGEN ändring i `packages/auth`, frozen)
1. `app/global-error.tsx` — graceful sista-utvägs-boundary (ersätter rot-layouten vid
   okänt klient-fel). Visar lugn "Ladda om" + tips att rensa webbplatsdata. Gör den
   nakna "client-side exception"-skärmen omöjlig.
2. `app/(auth)/login/LoginForm.tsx` — self-heal: rensar den gamla `.corevo.se`-scopeade
   `sb-<ref>-auth-token` (+ chunkar) vid mount på `/login`. Bryter churn-loopen
   automatiskt (cookien är non-HttpOnly → JS kan radera den). Host-låsta cookien
   (giltig session) är host-scopead och rörs ej. No-op om legacy-cookien saknas.
3. `components/realtime/RealtimeBookings.tsx` — try/catch: en trasig cookie i
   webbläsar-klienten kan aldrig fälla sidan.

## Manuell remediation (om en användare ändå fastnar)
Logga ut → rensa webbplatsdata för `corevo.se` (eller privat fönster) → logga in igen.
Self-healen ovan ska göra detta onödigt från och med denna deploy.

## Vad som INTE gjordes (avsiktligt)
- `AUTH_COOKIE_DOMAIN` återställs INTE till `.corevo.se` — det skulle bryta goal-27:s
  dörr-isolering (host-låsta cookies är designen).
- `packages/auth` (frozen G02), POS/root, DAL-fence: orörda.
