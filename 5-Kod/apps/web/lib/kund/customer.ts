import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ── Customer-identity resolver (M4) ──────────────────────────────────────────
// The customer portal authenticates on auth.uid() and keys "my bookings" on
// bookings.customer_profile_id (= auth.uid()). But the durable relationship band
// — favorites + the loyalty ledger (migration 0011) — keys on customers.id,
// resolved from auth.uid() via private.current_customer_id() (tenant-scoped).
//
// A customers row is NOT guaranteed to exist for a logged-in customer:
//   · signUpCustomer (lib/kund/actions.ts) creates auth.users + public.users but
//     NO customers row;
//   · create_public_booking (migration 0009) only sets customer_profile_id;
//   · the 0011 backfill only minted rows for customers who ALREADY had bookings
//     at migration time.
// So a registered customer (or one whose only bookings post-date 0011) has no
// customers row, and private.current_customer_id() returns NULL → a favorite
// INSERT would silently fail the RLS `with check`.
//
// getOrCreateCustomerId closes that gap with an IDENTITY-LINK-ONLY upsert: it
// writes nothing but (tenant_id, auth_user_id) — never PII (full_name/email/
// phone). PII ownership stays with M6/the booking path; writing it here would
// risk clobbering owner-curated identity. The authed client is used so the row
// is created under customers_rls' own-row branch (auth_user_id = auth.uid()),
// which the policy permits without any privileged key.

export type CustomerIdResult = { id: string } | { error: string }

/**
 * Resolve the signed-in customer's customers.id for the current tenant WITHOUT
 * creating one. Returns null when no row exists yet (e.g. a registered customer
 * who has never had a booking). Read-only — safe for display paths (loyalty).
 */
export async function getCustomerId(userId: string, tenantId: string): Promise<string | null> {
  if (!userId || !tenantId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Resolve OR lazily create the signed-in customer's customers.id for the current
 * tenant. Identity-link only (tenant_id + auth_user_id) — never writes PII.
 *
 * Select-then-insert (NOT .upsert): the uniqueness guarantee is a PARTIAL unique
 * index (customers_tenant_auth_uniq … where auth_user_id is not null), which
 * PostgREST's onConflict cannot target. We instead handle the race with the
 * unique-violation code (23505): if two requests insert at once, the loser
 * re-reads the winner's row. Mutation-only — call this just before writing a
 * favorite, not on every page render.
 */
export async function getOrCreateCustomerId(
  userId: string,
  tenantId: string,
): Promise<CustomerIdResult> {
  if (!userId || !tenantId) return { error: 'Saknar identitet.' }
  const supabase = await createClient()

  const existing = await getCustomerId(userId, tenantId)
  if (existing) return { id: existing }

  const { data, error } = await supabase
    .from('customers')
    .insert({ tenant_id: tenantId, auth_user_id: userId })
    .select('id')
    .single()

  if (!error && data) return { id: data.id }

  // Lost the insert race (partial-unique violation) → the winner's row now
  // exists; re-read it. Any other error surfaces as a soft failure.
  if (error?.code === '23505') {
    const again = await getCustomerId(userId, tenantId)
    if (again) return { id: again }
  }
  return { error: 'Kunde inte koppla ditt konto. Försök igen.' }
}
