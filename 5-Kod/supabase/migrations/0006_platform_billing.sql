-- ============================================================================
-- 0006 — Platform billing model on tenant_settings (G08 / M7, FLÖDE 2).
--
-- Adds the manual-invoicing inputs the platform admin sets per tenant. Corevo
-- bills each salong manually (no Stripe coupling in M7); these columns are the
-- read-model the "faktureringsunderlag" view computes from:
--
--   billing_model = 'per_booking'  → fee = COUNT(completed bookings in month)
--                                          × per_booking_fee_cents
--   billing_model = 'flat_monthly' → fee = flat_monthly_fee_cents
--   setup_fee_cents                → one-time startavgift (shown on tenant detail,
--                                    NOT part of the monthly underlag)
--
-- All amounts in öre (int), mirroring services.price_cents / service_fee_value.
-- Re-runnable: ADD COLUMN IF NOT EXISTS (the inline CHECK rides the same clause,
-- so a re-run is a no-op once the column exists).
-- Scope note (G08 goal): the goal's "skapa ingen migration" rule targets the
-- missing-table case (audit_log / tenant_domains — both already present). Build
-- step 3 explicitly authorizes this column migration on the existing table.
-- ============================================================================

alter table public.tenant_settings
  add column if not exists billing_model text not null default 'per_booking'
    check (billing_model in ('per_booking', 'flat_monthly'));

alter table public.tenant_settings
  add column if not exists setup_fee_cents int not null default 0;

alter table public.tenant_settings
  add column if not exists per_booking_fee_cents int not null default 0;

alter table public.tenant_settings
  add column if not exists flat_monthly_fee_cents int not null default 0;
