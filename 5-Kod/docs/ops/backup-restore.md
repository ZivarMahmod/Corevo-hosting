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
- R2-bucketen finns och innehåller kundmedia. Versionering/backup är ännu inte
  verifierad; behandla därför media som återställningskrävande kunddata, inte som
  ofarlig cache.

---

## 2. Rate-limiting

Tvålagers-försvar (goal-noten: "föredra Cloudflare-lager för auth; app-lager som
komplement").

### App-lager (BYGGT, aktivt)
- `public.check_rate_limit(p_key, p_max, p_window_secs)` (migration 0008) — Postgres-
  backad fönsterräknare i `private.rate_limit_hits`. **Detta är det enda Workers-säkra
  app-lagret**: per-isolate-minne kan inte rate-limita (varje request kan landa i en
  ny isolat). Helper: `lib/security/rate-limit.ts`.
- Inkopplat på: **login** (`signIn`, 8 försök / 5 min / IP) och publika skrivflöden.
  Login är fail-**closed** vid DB-fel så credential-stuffing-skyddet inte kan
  försvinna tyst; publika kundflöden använder dokumenterad per-route-policy.

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
  Kod: `lib/gdpr/erase.ts` + migration 0099 (kräver service-role —
  degrade-meddelande utan).
- Tenantens kunddata raderas av **en** SECURITY DEFINER-RPC med fast
  `search_path=''`: den låser exakt `(tenant_id, customer_id)`, scrubbar alla
  kundkopplade PII-band och skriver audit sist i samma transaktion. Ett audit-
  eller delstegsfel rullar tillbaka allt.
- **Retentionspolicy (medvetet val):**
  | Data | Åtgärd | Varför |
  |------|--------|--------|
  | `customers` | **Anonymiserad stub**; kontakt, hash, visningsnamn och Auth-länk nollas | Bevarar referensintegritet utan direkt PII |
  | `bookings` | **Anonymiseras** (`note` och `customer_profile_id` → null), raderas EJ | Salongen behåller schema-/besöks-/ekonomihistorik |
  | `payments` | **Behålls orört** | Bokföringslagen ~7 års retention; raden bär ingen direkt PII (kopplas via `booking_id`) |
  | `loyalty_ledger` | **Behålls** mot anonymiserad stub | Append-only poäng-/besökshistorik; schemaförbud mot PII i `note` gäller |
  | Favoriter, kundkort, kanalval, pushnycklar, medlemskap och claim | **Raderas/scrubbas** | Persondata utan redovisningsbehov |
  | Outbox | Kontakt/payload/samtycke/länkar/lease scrubbas; aktiv leverans terminaliseras | Ingen ny retry eller sen CAS får använda raderad PII |
  | Shop-/offertkontakt | Orderhuvud, presentkortsmottagare, orderradernas mottagare, ordergenererade eventanmälningar och offertsvar scrubbas; belopp/saldo/kapacitet/status/rader behålls | Skiljer direkt PII från affärs-/redovisningshistorik |
  | `public.users` + `auth.users` | Självservice: publik profil spärras/scrubbas i DB-transaktionen; Auth raderas därefter externt | Auth kan inte ingå i Postgres-transaktionen |
  | `audit_log` | Append-only rad läggs till sist | Spårbarhet — **utan namn, e-post, telefon eller fritext** |
- **Append-only-audit vs raderingsrätt:** `audit_log` kan inte skrubbas (hård
  trigger). Därför skrivs ALDRIG PII dit vid radering — raderingsposten bär bara
  pseudonymt `entity_id`, aktörs-id och slutna räknare. Behålls på rättslig grund
  (spårbarhet av administrativa åtgärder).
- **Auth-tvåfas:** full kontoradering rapporteras bara när Auth Admin-delete och
  det idempotenta cleanup-acknowledgementet är bekräftade. En service-only
  claim/fail/ack-kö med radlås + kort lease återupptar tappade svar utan dubbla
  arbetare. Vid fel stannar profilen i `gdpr_pending_auth_delete`, Auth-användaren
  bannas best-effort och tenantens direkta PII är redan borta. Aktiv cleanup
  behåller exakt tenant/customer/Auth-UUID; ack nollar alla tre identifierarna.
  Felkoder/loggar är slutna och innehåller aldrig leverantörstext eller kontaktdata.
- **Gammal JWT efter radering:** Supabase access-JWT kan leva till `exp` även när
  användaren raderats/bannats. Ett DB-triggerbackstop kräver därför en aktuell
  `public.users.status='active'`, exakt tenant/roll och — för kundrollen — exakt
  aktivt bundet kundkort innan en autentiserad bokning får skapas. Service-role-
  storefront utan `auth.uid()` är oförändrad.
- **Global identitet fail-closed:** om samma Auth UUID har fler än en exakt
  kundrelation muteras ingenting; Corevo-support måste hantera hela identiteten
  efter produktbeslut. Ingen matchning sker på e-post/telefon.
- **Orelaterade intag:** `contact_messages` och eventanmälningar saknar
  `customer_id`. Tenant-kundradering gissar därför inte identitet från kontakttext;
  de följer sina separata retention-/raderingsrutiner.

---

## 4. Notiser (e-post)

- Transport (uppdaterat i goal-14): **HTTPS → Supabase Edge Function `send-email`
  → one.com SMTP** (`lib/notifications/email.ts`) — Workers-säkert (ingen Node-SMTP).
  Degrade till no-op utan `EMAIL_RELAY_URL`/`EMAIL_RELAY_SECRET`. Detaljer +
  secrets: `docs/ops/mejl-egen-smtp.md`. (Resend borttaget.)
- Inkopplat: **bekräftelse** vid bokning (`createBooking`/`rebookBooking`),
  **avbokning** (`cancelBooking`), **kvitto** (Stripe-webhook
  `payment_intent.succeeded`, gäst-mejl parsas ur `note`), **påminnelse** (cron).
- **Reminder-cron (BYGGT handler, OPS-schemaläggning):** `app/api/cron/reminders`
  (bearer `CRON_SECRET`) → `sendDueReminders()` skickar för **live bokningar
  (pending/confirmed)** inom 30 h och använder migration 0088:s atomiska lease före
  transport samt `bookings.reminded_at` efter bekräftad leverans.
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
| `EMAIL_RELAY_URL` / `EMAIL_RELAY_SECRET` / `NOTIFICATIONS_FROM` (one.com-väg, goal-14) | **Server-only** | Worker secret |
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
