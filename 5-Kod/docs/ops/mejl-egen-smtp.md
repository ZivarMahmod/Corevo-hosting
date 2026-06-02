# Mejl via egen SMTP (one.com) — ops-referens

**Goal:** 14 (mejl egen SMTP). **Status:** mekanism KOD-KLAR + Edge Function deployad. Live-leverans gated på Zivars one.com-konto + secrets (nedan).

## Arkitektur

```
Worker (Cloudflare, OpenNext)
  └─ lib/notifications/email.ts  →  HTTPS POST {from,to,subject,html,replyTo?}
                                    header: x-relay-secret: <EMAIL_RELAY_SECRET>
        ↓ EMAIL_RELAY_URL
Supabase Edge Function "send-email" (Deno + nodemailer)
        ↓ SMTP 465 (implicit TLS), auth = bokning@corevo.se
one.com SMTP (send.one.com)  →  kundens inkorg
```

- Klassisk SMTP (nodemailer) går INTE på Cloudflare Workers → Edge Function är reläet. Workern pratar bara HTTPS.
- **Resend är borttaget.** Ingen Resend-kod kvar.
- **Graceful no-op:** saknas `EMAIL_RELAY_URL` ELLER `EMAIL_RELAY_SECRET` på Workern → `sendEmail` loggar `email.skipped` och returnerar `{ok:false, skipped:true}` (kastar aldrig, blockerar aldrig en bokning). Saknas SMTP-secrets på Edge Function → funktionen svarar `503 smtp_not_configured`.
- **Per-salong:** From-namn = salongens namn (adress kvar `bokning@corevo.se`), Reply-To = `settings.contact.email` (utelämnas om tom — svar går då till From, förfalskas aldrig), mall får salongens accentfärg/logga + temats tagline som slogan. Faller tillbaka på Corevo-guld + monogram när data saknas.

## Edge Function

- Namn: `send-email` · projekt `clylvowtowbtotrahuad` · **deployad (v1, ACTIVE), `verify_jwt=false`**.
- URL: `https://clylvowtowbtotrahuad.supabase.co/functions/v1/send-email`
- Källa: `5-Kod/supabase/functions/send-email/{index.ts,deno.json}`
- Auth = delad hemlighet i header `x-relay-secret` (INTE Supabase-JWT, därav `verify_jwt=false`). **Fail-closed:** är `EMAIL_RELAY_SECRET` osatt/fel → `401`. Verifierat live: POST utan/fel secret → 401, GET → 405.
- Redeploy efter kodändring (CLI): `supabase functions deploy send-email --no-verify-jwt --project-ref clylvowtowbtotrahuad` (eller via Supabase MCP `deploy_edge_function`, `verify_jwt:false`).

## Secrets — vad sätts var

### 1) Edge Function-secrets (Supabase)

Sätt via CLI eller Dashboard → Edge Functions → **Manage secrets**.

| Namn | Värde | Not |
|---|---|---|
| `SMTP_HOSTNAME` | `send.one.com` | one.com utgående |
| `SMTP_PORT` | `465` | implicit TLS (`secure:true`) |
| `SMTP_USERNAME` | `bokning@corevo.se` | one.com-kontots inlogg |
| `SMTP_PASSWORD` | `<one.com-lösenord>` | hemligt |
| `EMAIL_RELAY_SECRET` | `<slumpad delad hemlighet>` | MÅSTE matcha Workerns värde |

CLI:
```bash
supabase secrets set --project-ref clylvowtowbtotrahuad \
  SMTP_HOSTNAME=send.one.com \
  SMTP_PORT=465 \
  SMTP_USERNAME=bokning@corevo.se \
  SMTP_PASSWORD='<one.com-lösenord>' \
  EMAIL_RELAY_SECRET='<slumpad-hemlighet>'
```

### 2) Worker-secrets/vars (Cloudflare, `bokningsplatformen`)

| Namn | Värde | Typ | Not |
|---|---|---|---|
| `EMAIL_RELAY_URL` | `https://clylvowtowbtotrahuad.supabase.co/functions/v1/send-email` | secret/var | funktionens URL |
| `EMAIL_RELAY_SECRET` | `<samma som Edge Function>` | **secret** | måste matcha exakt |
| `NOTIFICATIONS_FROM` | `Corevo <bokning@corevo.se>` | var | adressdelen återanvänds som From-adress; display-namnet byts per salong |

CLI (från `5-Kod/apps/web`):
```bash
npx wrangler secret put EMAIL_RELAY_SECRET   # klistra samma hemlighet
npx wrangler secret put EMAIL_RELAY_URL       # eller lägg som var i wrangler.jsonc
# NOTIFICATIONS_FROM kan ligga som "vars" i wrangler.jsonc (ej hemligt)
```

## ⚠️ DNS / deliverability (one.com)

`bokning@corevo.se` skickas via one.com. För att inte hamna i skräpposten måste **corevo.se:s SPF + DKIM tillåta one.com**. Sätt one.coms SPF-include + aktivera DKIM för domänen i one.com-panelen. From-ADRESSEN hålls konstant (`bokning@corevo.se`) just för att SPF/DKIM ska aligna — bara display-namnet varierar per salong. Saknas detta fungerar sändningen men deliverability degraderar tyst.

## Live-testmejl (efter att secrets är satta)

**A. Direkt mot reläet (snabbast):**
```bash
curl -i -X POST "https://clylvowtowbtotrahuad.supabase.co/functions/v1/send-email" \
  -H "content-type: application/json" \
  -H "x-relay-secret: <EMAIL_RELAY_SECRET>" \
  -d '{"from":"\"Frisör Demo\" <bokning@corevo.se>","to":"<din@mejl.se>","subject":"Testmejl Corevo","html":"<p>Hej från one.com-reläet 👋</p>","replyTo":"salong@exempel.se"}'
```
Förväntat: `200 {"ok":true,"id":"<messageId>"}` och mejlet landar (kolla From-namn + att "svara" går till `replyTo`).

**B. End-to-end via Workern:** gör en riktig bokning på `demo.corevo.se/boka` med din egen mejl → bekräftelsemejlet ska komma från salongens namn, ha accentfärg/logga, och Reply-To = salongens kontaktmejl.

Felsökning: Edge Function-loggar i Supabase Dashboard → Edge Functions → send-email → Logs. `401` = fel/saknad `x-relay-secret`. `503 smtp_not_configured` = SMTP-secrets saknas. `502 smtp_send_failed` = one.com nekade (kontrollera lösen/host/port).

## Worker-deploy (pending-owner — kräver elevad terminal)

Kodändringen (E2–E4) är committad men **Workern är ej live-deployad denna session** (production-deploy kräver Zivars godkännande/elevad terminal). OpenNext-bundlen är dock verifierad byggbar (ASCII-väg, `worker.js` skapad). Deploya så här:

```powershell
robocopy "C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod" "C:\tmp\kod" /E /PURGE /XD node_modules .next .open-next .git /XF .env.local
pnpm --dir C:\tmp\kod --filter @corevo/web run deploy
```
(ASCII-väg pga ö-bug i mappnamnet; `/PURGE` MÅSTE vara med annars hänger raderade filer kvar och bygget bryts.)

Tills Workern är deployad + secrets satta är hela mejlvägen en graceful no-op — bokningar fungerar oförändrat.
