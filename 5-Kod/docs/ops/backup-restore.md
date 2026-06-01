# Corevo — Drift & härdning (G10)

Operativ referens för säkerhet, backup och compliance. Skriven mot produktion på
**Cloudflare Workers (OpenNext)** + **Supabase (Postgres/Auth)** + **Stripe Connect**
+ **R2**. Kod-delarna av G10 är klara och verifierade; det som kräver molnkonsoll /
secrets är märkt **OPS** nedan.

---

## 1. Backup & återställning

### Supabase (Postgres)
- **Dagliga automatiska backuper** ingår i Supabase-projektet (Pro+). Verifiera i
  Dashboard → Database → Backups att schemat är aktivt och att retentionen räcker
  (minst 7 dagar; helst PITR).
- **Point-in-Time Recovery (PITR)** rekommenderas före produktion: Dashboard →
  Database → Backups → enable PITR. Ger återställning till valfri sekund inom
  retention­fönstret (skydd mot felaktig migration / massradering).
- **Restore-rutin:** Dashboard → Backups → välj punkt → Restore. Testa restore till
  ett **branch/staging-projekt** minst en gång innan skarp drift, så rutinen är känd.
- **Migrationer** är källan till sanning för schemat (`supabase/migrations/000*.sql`).
  En full miljö kan återskapas från migrationer + en data-restore.

### R2 (logotyper / media)
- Aktivera **Object versioning** på R2-bucketen (när bucketen skapas — se memory:
  R2 är ännu ej aktiverad på kontot). Versionering ger återställning av
  överskrivna/raderade objekt.
- R2-objekt är icke-kritiska (branding); en förlust faller tillbaka på
  standard-tema. Ingen separat backup-pipeline behövs utöver versioning.

---

## 2. Rate-limiting

Tvålagers-försvar (goal-noten: "föredra Cloudflare-lager för auth; app-lager som
komplement").

### App-lager (BYGGT, aktivt)
- `public.check_rate_limit(p_key, p_max, p_window_secs)` (migration 0008) — Postgres-
  backad fönsterräknare i `private.rate_limit_hits`. **Detta är det enda Workers-säkra
  app-lagret**: per-isolate-minne kan inte rate-limita (varje request kan landa i en
  ny isolat). Helper: `lib/security/rate-limit.ts`.
- Inkopplat på: **login** (`signIn`, 8 försök / 5 min / IP) och **publik bokning**
  (`createBooking`, 12 / 5 min / IP+tenant). Fail-**open** vid DB-fel (en trasig
  räknare får aldrig låsa ute riktiga kunder).

### Cloudflare WAF (PRIMÄRT, **OPS — ej applicerat**)
> ⛔ Får INTE appliceras live ännu: HANDOFF spärrar all live CF-DNS/route/config
> till **G11 + Zivars ja** (POS-risk). Dokumenterat här, aktiveras i G11.

Skapa i Cloudflare Dashboard → Security → WAF → Rate limiting rules:
- **Auth:** matcha `http.request.uri.path eq "/login"` **och** method `POST` →
  10 requests / 1 min / IP → action *Block* (eller Managed Challenge).
- **Webhook-skydd:** `/api/stripe/webhook` är signaturverifierad; lägg ev. en mild
  rate-limit (100/min) som DoS-broms, ej funktionell gate.
- **Reminder-cron:** `/api/cron/reminders` skyddas av `CRON_SECRET` (bearer) — håll
  den oåtkomlig utan secret; WAF-regel valfri.

---

## 3. GDPR

### Export (BYGGT)
- Självservice: kund → `/konto/profil` → "Exportera mina uppgifter" →
  `GET /api/gdpr/export` (auth via session). Returnerar **all** kunddata (profil +
  bokningar + betalningar) som nedladdningsbar JSON. Kod: `lib/gdpr/data.ts`.

### Radering / "rätten att bli glömd" (BYGGT)
- Självservice: kund → `/konto/profil` → skriv `RADERA` → `eraseMyAccount`.
  Kod: `lib/gdpr/erase.ts` (kräver service-role — degrade-meddelande utan).
- **Retentionspolicy (medvetet val):**
  | Data | Åtgärd | Varför |
  |------|--------|--------|
  | `bookings` | **Anonymiseras** (note → null, `customer_profile_id` → null), raderas EJ | Salongen behåller intakt schema/historik; persondata borta |
  | `payments` | **Behålls orört** | Bokföringslagen ~7 års retention; raden bär ingen direkt PII (kopplas via `booking_id`) |
  | `users` + `auth.users` | **Raderas** (cascade) | Tar bort namn/e-post/telefon |
  | `audit_log` | Append-only rad läggs till | Spårbarhet — **utan PII** (endast user-id + antal) |
- **Append-only-audit vs raderingsrätt:** `audit_log` kan inte skrubbas (hård
  trigger). Därför skrivs ALDRIG PII dit vid radering — raderingsposten bär bara
  `entity_id` (user-id) och en bokningsräknare. Behålls på rättslig grund
  (spårbarhet av administrativa åtgärder).
- **Admin-väg:** `eraseCustomerData` / `collectCustomerData` är service-role-anropbara
  och redo att kopplas till en framtida kundadmin-vy (ingen sådan vy finns denna
  våg — guest-kunder rider på `note`, registrerade ligger i `users`).
- **Känd begränsning (på protokoll):** radering matchar på `customer_profile_id`.
  Rena gästbokningar (endast `note`-sömmen, ingen profil) under samma e-post nås
  alltså INTE av självservice-raderingen denna våg. När en `customers`-tabell byggs
  bör erase även skrubba note-matchande gästbokningar.

---

## 4. Notiser (e-post)

- Transport: **Resend över fetch** (`lib/notifications/email.ts`) — Workers-säkert
  (ingen Node-SMTP). Degrade till no-op utan `RESEND_API_KEY`.
- Inkopplat: **bekräftelse** vid bokning (`createBooking`/`rebookBooking`),
  **avbokning** (`cancelBooking`), **kvitto** (Stripe-webhook
  `payment_intent.succeeded`, gäst-mejl parsas ur `note`), **påminnelse** (cron).
- **Reminder-cron (BYGGT handler, OPS-schemaläggning):** `app/api/cron/reminders`
  (bearer `CRON_SECRET`) → `sendDueReminders()` skickar för **live bokningar
  (pending/confirmed)** inom 24 h och stämplar `bookings.reminded_at` (idempotent).
  OBS: on-site-bokningar ligger `pending` tills personalen bekräftar — därför inte
  enbart `confirmed` i filtret. Schemalägg via **Cloudflare
  Cron Trigger** (t.ex. var 30:e min) som gör `GET` mot endpointen med
  `Authorization: Bearer <CRON_SECRET>`, eller via pg_cron.

---

## 5. Observability

- Strukturerad loggning: `lib/observability` → JSON till Workers-loggen (Logpush om
  aktiverat). Hemlighets-nycklar redigeras bort automatiskt i log-fält.
- Felrapportering: `captureException` POSTar ett minimalt **Sentry-envelope** via
  fetch om `SENTRY_DSN` är satt; annars bara logg. Inkopplat i Stripe-webhookens
  felvägar. (Sentry-leverans = deploy-tid-verifiering, kräver riktig DSN.)
- `audit_log` används konsekvent för administrativa åtgärder (plattform: `lib/platform/audit.ts`;
  GDPR-radering: `lib/gdpr/erase.ts`).

---

## 6. Secrets-hygien

| Variabel | Sida | Var den sätts |
|----------|------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Klient (publik, OK) | build/env |
| `NEXT_PUBLIC_*` (site/tenant/domain) | Klient (publik, OK) | build/env |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Worker secret |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **Server-only** | Worker secret |
| `RESEND_API_KEY` / `NOTIFICATIONS_FROM` | **Server-only** | Worker secret |
| `SENTRY_DSN` | Server-only | Worker secret |
| `CRON_SECRET` | **Server-only** | Worker secret |

- Server-only moduler (`lib/platform/service.ts`, `lib/stripe/client.ts`,
  `lib/gdpr/erase.ts`, m.fl.) importerar `server-only` → bygget faller om de råkar
  dras in i en klientbundle.
- **Verifierat (G10):** `next build` följt av skanning av `.next/static` — inga
  server-secret-namn och **inget `service_role`-JWT** i klientbundlen. Endast anon-
  nyckeln (publik) inlineas, vilket är korrekt.
- Sätt Worker-secrets med `wrangler secret put <NAMN>` (aldrig i `.env` som checkas in).

---

## 7. Säkerhets-advisors (Supabase) — granskning

Körd via MCP `get_advisors(security)`. Inga **nya** fynd från G10. Befintliga WARN:s
genomgångna:

- **3× SECURITY DEFINER booking-RPC:er** (`create_public_booking`,
  `get_busy_intervals`, `get_public_booking`) — den DEFINER-yta HANDOFF flaggade för
  G10-granskning. **Slutsats: avsiktlig & härdad.** Den publika bokningen körs som
  `anon` via dessa; var och en pinnar `search_path=''`, fullkvalificerar objekt,
  tenant-scopar internt och läcker ingen kund-PII. Ingen åtgärd.
- **`check_rate_limit` (ny, DEFINER)** — avsiktlig: måste skriva `private`-tabellen
  från anon. `search_path=''`, fail-open, EXECUTE endast till anon/authenticated.
- **`extension_in_public` (btree_gist)** — låg risk; krävs för EXCLUDE-constraintet.
  Flytt till eget schema är kosmetiskt; lämnas.
- **`auth_leaked_password_protection` (av)** — medvetet uppskjutet (HANDOFF: 2FA blir
  det riktiga skyddet). Slå på i Dashboard → Auth före skarp produktion om 2FA glider.

---

## 8. Säkerhetsheaders

- Satta i `next.config.ts` `headers()` (täcker alla routes, rör ej frusna
  middleware). **Verifierat i G10** via `next start` + curl: CSP, HSTS,
  X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy,
  Permissions-Policy, X-DNS-Prefetch-Control — alla närvarande.
- CSP tillåter Stripe (js/api/checkout/hooks) + Supabase (projekt-URL + `*.supabase.co`
  + `wss:`). `'unsafe-inline'` för style/script (Next utan nonce) — dokumenterad
  avvägning.
- **Deploy-tid-verifiering:** att OpenNext emitterar `next.config`-headers på Workers-
  runtimen är inte verifierbart lokalt (EPERM-spärr på Workers-bundlen). Kontrollera
  responsheaders efter deploy.
```
