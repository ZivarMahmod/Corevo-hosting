# Auth-invite-kedjan — app-ägd (2026-07-01)

## Vad som ändrades och varför

Onboarding-buggen "Auth-verifieringsmail funkar ej" hade två rotorsaker:

1. **Appen saknade en confirm-endpoint.** Supabase-invitens länk hade ingenstans att landa — det fanns ingen route som växlar mejl-länkens engångstoken till en session, och ingen sida där den inbjudne väljer lösenord.
2. **Mejlet skickades av Supabase Auths egen mailer** (dashboard-SMTP + mallar + Site URL/redirect-allowlist) — en helt separat, okonfigurerad leveransväg vid sidan av appens bevisade bokningsmejl-relay.

Fixen gör kedjan **helt app-ägd** — ingen Supabase-dashboard-konfig (SMTP, mallar, redirect-allowlist) behövs längre:

```
createTenant / inviteStaff
  → generateLink({type:'invite'})        (skapar auth-user, INGET Supabase-mejl)
  → lib/auth/invite.ts bygger länk till  https://<dörr-host>/auth/confirm?token_hash=…
  → mejlet skickas via EGNA relayn       (samma som bokningsbekräftelser → one.com SMTP)
  → /auth/confirm kör verifyOtp()        (session-cookies sätts server-side)
  → /uppdatera-losenord                  (välj lösenord → rätt portal-hem per roll)
```

- **Ägar-invite** (onboarding-studio) → länken pekar på `booking.corevo.se` (kund-admin-dörren).
- **Personal-invite** (admin → medarbetare) → länken pekar på `minbooking.corevo.se`.
- **Lösenords-reset** (super-admin, Kunder-vyn) → genererad länk pekar nu på vår `/auth/confirm` (token_hash-flödet) istället för Supabase `action_link` (vars tokens hamnade i URL-fragmentet = osynliga för servern → sessionen sattes aldrig).
- Misslyckas mejlutskicket raderas den nyskapade auth-användaren (best-effort) så ett omförsök med samma e-post inte stupar på "kontot finns redan". Invite-fel loggas nu via `reportActionError('createTenant.invite')` (telemetri saknades helt förr).

## Filer

| Del | Fil |
|---|---|
| Invite-modul (generateLink + mejl) | `apps/web/lib/auth/invite.ts` |
| Token→session-endpoint | `apps/web/app/auth/confirm/route.ts` |
| Välj-lösenord-sida | `apps/web/app/(auth)/uppdatera-losenord/` |
| Server-action `updatePassword` | `apps/web/app/(auth)/actions.ts` |
| Dörr-släpp (`/auth`, `/uppdatera-losenord` på alla back-office-hostar) | `apps/web/lib/auth/host-routing.ts` |

## Miljöberoenden (inga nya)

- `SUPABASE_SERVICE_ROLE_KEY` — som förr (generateLink är admin-API).
- `EMAIL_RELAY_URL` + `EMAIL_RELAY_SECRET` — samma relay som bokningsmejlen; är den satt i prod funkar invite-mejlen på köpet. Osatt (dev/CI) → mejlet skippas och confirm-länken loggas i worker-loggen så flödet kan testas ändå.

## Zivars live-verifiering (lägg i 6-Testing när det ska köras)

1. Onboarda en testsalong med din egen e-post som ägare → mejl "Aktivera ditt konto hos <salong>" ska landa (avsändare = samma som bokningsbekräftelser).
2. Klicka knappen → hamna på `booking.corevo.se/uppdatera-losenord` med kontot aktiverat → välj lösenord → landa i `/admin`.
3. Provocera fel: klicka länken IGEN (förbrukad token) → `/login` med "Länken är ogiltig eller har gått ut".
4. Bjud in en medarbetare från kund-admin → samma flöde men mot `minbooking.corevo.se` → landa i `/personal`.
5. Kunder-vyn → lösenords-reset → kopiera länken, öppna i inkognito → välj nytt lösenord.

## Kvarvarande känd lucka ("live direkt i CF")

Domän-auto-attach vid onboarding är fortfarande vilande tills dessa fyra sätts som Worker-secrets/vars: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID`, `DOMAIN_AUTOATTACH_ENABLED="true"` (`lib/cloudflare/worker-domains.ts`). Tills dess: `node scripts/add-domain.mjs <slug>` (attachar live + committar routen i `wrangler.jsonc`).
