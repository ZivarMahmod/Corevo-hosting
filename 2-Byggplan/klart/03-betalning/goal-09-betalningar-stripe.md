/goal

KÖR: betalningar (G09). Flöde 1 — kund betalar för TJÄNSTEN vid bokning, pengar till salongen via Stripe Connect.

KONTEXT (läs först):
- Repo: privat Frisor-sas, kod i 5-Kod/ (pnpm + Turborepo, Next.js 15, Supabase, OpenNext/Cloudflare Workers). Jobba direkt på main, `git pull` först, en commit per punkt (sekventiell körning, ensam Code).
- main har KLAR: G01–G08 + G4.5. DB live i Supabase (clylvowtowbtotrahuad).
- Sekventiell solo på main → MIGRATIONER TILLÅTNA. Numrera i sekvens, idempotent, med rollback, RLS på nya tabeller.

NAMN-FAKTA (EXAKT): private.tenant_id(); users + roles.level; bookings (start_ts/end_ts, staff_id, location_id); tenant_settings. Stripe Connect Express + DIRECT charges.

⚠️ LIVE-SPÄRR: Stripe i TEST-mode tills Zivar säger live. Ingen riktig kunddomän/DNS. Inga skarpa utbetalningar.

MODELL (spikat — bygg exakt så):
- Kund betalar FULLT belopp för tjänsten vid bokning → DIRECT charge rakt till salongens connected account.
- **application_fee = 0** (Corevo tar inget snitt på transaktionen).
- Betalning vid bokning = per-tenant toggle `tenant_settings.payments_enabled`. Av → bokning utan betalning (betala i salongen), oförändrat flöde.
- Avbokning inom tenantens regel → refund via Stripe.
- ⛔ Bygg INTE Corevos plattformsavgift här (flöde 2 = config + manuell faktura i G08).

BYGG:
1. Migration: `stripe_account_id` på tenant (tenants/tenant_settings); `payments_enabled` (bool, default false); payments-tabell (id, tenant_id, booking_id, amount, currency, status, stripe_payment_intent_id, created_at) med tenant-RLS.
2. Stripe Connect Express onboarding: Account Link-flöde — gör G07 admins Stripe-knapp skarp. Spara stripe_account_id, visa status (charges_enabled/payouts_enabled).
3. Booking-betalning: i boka-flödet, om payments_enabled → skapa PaymentIntent som DIRECT charge på salongens konto (application_fee=0). Använd G04:s `requiresPayment`-krok. Payment Element eller Checkout Session.
4. Webhook: payment_intent.succeeded/failed + charge.refunded + **account.updated** (uppdatera salongens charges_enabled/payouts_enabled) → uppdatera payment + booking-status. Idempotent (dubbel-leverans = en effekt). Connect-events bär `account`-fält → mappa till rätt tenant.
   - ⚠️ **Cloudflare Workers-runtime:** signaturverifiering kräver **rå request-body** (inte parsad). Läs raw body innan JSON-parse, annars bryter Stripe-signaturen på Workers. Verifiera Stripe-SDK mot Workers; använd fetch-baserad klient om nodklienten strular.
5. Refund-Action vid avbokning (inom tenantregel).
6. Kvitto/bekräftelse på bekräftelsesidan.
7. Onboarding-gate: salong med charges_enabled=false → visa bara "betala på plats", dölj online-knappen tills onboarding klar.

DoD (bevis krävs, Stripe test-mode):
- Tenant utan Connect → onboarding-länk funkar, charges_enabled syns efter koppling.
- payments_enabled=på → bokning tar betalning, pengar landar på salongens konto, application_fee=0 (verifierat i Stripe).
- payments_enabled=av → bokning utan betalning, flödet oförändrat.
- Avbokning → refund syns i Stripe.
- Webhook idempotent.
- RLS: tenant ser bara egna payments; ej annan tenants.
- pnpm build + lint gröna.

LÄMNA ÅT G10 (bygg INTE här, notera bara TODO): Stripe-domäner i CSP, rate-limit på webhook-endpoint, secrets-revision på Stripe-nyckeln.

Klart → rapportera KLAR med DoD-bevis och STANNA.
