'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from './tenant'
import { revalidateTenant } from './tenant'
import { getStripe } from '@/lib/stripe/client'
import { createExpressAccount, createOnboardingLink, fetchConnectStatus } from '@/lib/stripe/connect'
import { requestOrigin } from '@/lib/url'

// Stripe Connect onboarding actions for the salongsadmin (G09 step 2). The role
// gate lives here (RLS isolates tenants but is not role-aware). Stripe writes to
// tenants.stripe_* go through the authed client — tenants_rls lets an admin update
// their OWN tenant row.

export type StripeActionState = { error?: string; success?: string }

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'
const NO_STRIPE = 'Stripe är inte konfigurerat ännu. Kontakta Corevo.'

/**
 * Start (or resume) Express onboarding: ensure the tenant has a connected account,
 * then redirect to a fresh Account Link. Redirect throws, so the {error} return is
 * only hit on the failure paths.
 */
export async function startStripeOnboarding(
  _prev: StripeActionState,
  _fd: FormData,
): Promise<StripeActionState> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: NO_TENANT }

  const stripe = getStripe()
  if (!stripe) return { error: NO_STRIPE }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('tenants')
    .select('stripe_account_id')
    .eq('id', tenant.id)
    .maybeSingle()

  let accountId = row?.stripe_account_id ?? null
  if (!accountId) {
    try {
      accountId = await createExpressAccount(stripe, user.email)
    } catch {
      return { error: 'Kunde inte skapa Stripe-konto. Försök igen.' }
    }
    const { error } = await supabase
      .from('tenants')
      .update({ stripe_account_id: accountId })
      .eq('id', tenant.id)
    if (error) return { error: GENERIC }
  }

  const origin = await requestOrigin()
  let url: string
  try {
    url = await createOnboardingLink(stripe, accountId, {
      refreshUrl: `${origin}/admin/installningar?stripe=refresh`,
      returnUrl: `${origin}/admin/installningar?stripe=return`,
    })
  } catch {
    return { error: 'Kunde inte skapa onboarding-länk. Försök igen.' }
  }
  redirect(url)
}

/** Re-fetch the connected account's capabilities and mirror them onto tenants.*. */
export async function refreshStripeStatus(
  _prev: StripeActionState,
  _fd: FormData,
): Promise<StripeActionState> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: NO_TENANT }

  const stripe = getStripe()
  if (!stripe) return { error: NO_STRIPE }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('tenants')
    .select('stripe_account_id')
    .eq('id', tenant.id)
    .maybeSingle()
  if (!row?.stripe_account_id) return { error: 'Ingen Stripe-koppling ännu.' }

  let status
  try {
    status = await fetchConnectStatus(stripe, row.stripe_account_id)
  } catch {
    return { error: 'Kunde inte hämta Stripe-status. Försök igen.' }
  }

  const { error } = await supabase
    .from('tenants')
    .update({
      stripe_charges_enabled: status.chargesEnabled,
      stripe_payouts_enabled: status.payoutsEnabled,
      stripe_details_submitted: status.detailsSubmitted,
    })
    .eq('id', tenant.id)
  if (error) return { error: GENERIC }

  revalidatePath('/admin/installningar')
  return {
    success: status.chargesEnabled
      ? 'Stripe aktiv — kortbetalning möjlig.'
      : 'Status uppdaterad. Onboarding ännu inte klar.',
  }
}

/**
 * Master-toggle for taking payment at booking (tenant_settings.payments_enabled).
 * Cannot be turned on until the connected account has charges_enabled — otherwise
 * the booking flow would offer an "online" button that Stripe would reject.
 */
export async function setPaymentsEnabled(
  _prev: StripeActionState,
  fd: FormData,
): Promise<StripeActionState> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: NO_TENANT }

  const enabled = String(fd.get('payments_enabled') ?? '') === 'true'
  const supabase = await createClient()

  if (enabled) {
    const { data: row } = await supabase
      .from('tenants')
      .select('stripe_charges_enabled')
      .eq('id', tenant.id)
      .maybeSingle()
    if (!row?.stripe_charges_enabled) {
      return { error: 'Slutför Stripe-onboarding först — kortbetalning är inte aktiv ännu.' }
    }
  }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenant.id, payments_enabled: enabled }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  revalidateTenant(tenant.slug)
  revalidatePath('/admin/installningar')
  return { success: enabled ? 'Onlinebetalning vid bokning: PÅ.' : 'Onlinebetalning vid bokning: AV.' }
}
