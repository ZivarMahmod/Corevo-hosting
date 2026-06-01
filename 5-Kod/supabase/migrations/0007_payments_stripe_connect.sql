-- ============================================================================
-- 0007 — Payments via Stripe Connect (G09, FLÖDE 1).
--
-- Kund betalar FULLT belopp för tjänsten vid bokning → DIRECT charge rakt till
-- salongens connected account. application_fee = 0 (Corevo tar inget snitt här;
-- plattformsavgiften = FLÖDE 2, manuell faktura i G08).
--
-- Befintligt sedan 0001 (ÅTERANVÄNDS, skapas inte om):
--   · tenants.stripe_account_id          — connected account-id
--   · public.payments(id, tenant_id, booking_id, stripe_payment_intent_id,
--                     amount_cents, currency, status, created_at, updated_at)
--     + tenant-RLS (0002: payments_rls, authenticated, tenant_id-scoped).
--
-- Denna migration lägger till:
--   1. tenant_settings.payments_enabled   — master-toggle (default false ⇒ alla
--      nuvarande salonger = oförändrat flöde, ingen betalning vid bokning).
--   2. tenants.stripe_charges_enabled / stripe_payouts_enabled /
--      stripe_details_submitted — Connect-kontots status (sätts av account.updated-
--      webhooken). Onboarding-gate: charges_enabled=false ⇒ dölj online-knappen.
--   3. payments.stripe_checkout_session_id — Checkout Session-id (känt vid create;
--      PI-id är null tills betalningen sker → kan inte vara idempotens-nyckel).
--   4. UNIQUE(payments.booking_id)         — idempotens: en bokning = en payment-rad.
--      Webhook gör state-set UPDATE per booking_id → dubbel-leverans = en effekt.
--   5. get_public_booking-RPC utökad: returnerar payments_enabled,
--      stripe_charges_enabled och payment_status (för kvitto/gate på bekräftelse-
--      sidan, som körs som anon → RPC:n är SECURITY DEFINER och läser dem säkert).
--
-- EFFEKTIV CHARGE-GATE (app-lagret): payments_enabled AND stripe_charges_enabled.
-- payment_mode (0001) lämnas orörd — den styr kund-facing copy, INTE charge-beslutet.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS, guarded unique index, drop+create RPC.
-- ROLLBACK längst ned (kommenterad).
-- ============================================================================

-- ── 1. Master-toggle: betalning vid bokning (per salong, default av) ──
alter table public.tenant_settings
  add column if not exists payments_enabled boolean not null default false;

-- ── 2. Connected account-status på tenants (sätts av account.updated) ──
alter table public.tenants
  add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.tenants
  add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.tenants
  add column if not exists stripe_details_submitted boolean not null default false;

-- ── 3. Checkout Session-id på payments (idempotens-/spårningsnyckel) ──
alter table public.payments
  add column if not exists stripe_checkout_session_id text;

-- ── 4. En payment-rad per bokning (idempotens-grund för webhooken) ──
-- payments skrivs först av G09 (tom tabell live) → tryggt att unik-tvinga nu.
create unique index if not exists payments_booking_id_key on public.payments (booking_id);

-- ── 5. Utöka get_public_booking: gate-flaggor + payment_status för kvitto ──
-- Returtypen ändras → CREATE OR REPLACE räcker inte, måste DROP först.
drop function if exists public.get_public_booking(uuid);
create function public.get_public_booking(p_id uuid)
returns table (
  id                     uuid,
  status                 text,
  start_ts               timestamptz,
  end_ts                 timestamptz,
  price_cents            int,
  service_name           text,
  staff_title            text,
  location_name          text,
  location_timezone      text,
  payment_mode           text,
  tenant_name            text,
  tenant_slug            text,
  payments_enabled       boolean,
  stripe_charges_enabled boolean,
  payment_status         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.start_ts, b.end_ts, b.price_cents,
         s.name, st.title, l.name, l.timezone,
         coalesce(ts.payment_mode, 'on_site'), t.name, t.slug,
         coalesce(ts.payments_enabled, false),
         coalesce(t.stripe_charges_enabled, false),
         pm.status
    from public.bookings b
    join public.services s        on s.id = b.service_id
    join public.staff st          on st.id = b.staff_id
    join public.tenants t         on t.id = b.tenant_id
    left join public.locations l        on l.id = b.location_id
    left join public.tenant_settings ts on ts.tenant_id = b.tenant_id
    left join public.payments pm        on pm.booking_id = b.id
   where b.id = p_id
$$;
revoke execute on function public.get_public_booking(uuid) from public;
grant  execute on function public.get_public_booking(uuid) to anon, authenticated;

-- ============================================================================
-- ROLLBACK (kör manuellt vid behov):
--   drop function if exists public.get_public_booking(uuid);
--   -- (återskapa 0005-versionen av get_public_booking från 0005-migrationen)
--   drop index  if exists public.payments_booking_id_key;
--   alter table public.payments       drop column if exists stripe_checkout_session_id;
--   alter table public.tenants        drop column if exists stripe_details_submitted;
--   alter table public.tenants        drop column if exists stripe_payouts_enabled;
--   alter table public.tenants        drop column if exists stripe_charges_enabled;
--   alter table public.tenant_settings drop column if exists payments_enabled;
-- ============================================================================
