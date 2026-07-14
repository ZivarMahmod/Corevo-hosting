'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from './tenant'
import { getStripe } from '@/lib/stripe/client'
import { createExpressAccount, createOnboardingLink, fetchConnectStatus } from '@/lib/stripe/connect'
import { requestOrigin } from '@/lib/url'

// Stripe Connect onboarding actions (G09 step 2), delade mellan kund-adminens
// /admin/installningar och super-admin-kundkortet /salonger/[id] (goal-54 körning 5)
// via moduleCtx-dual-guarden: platform_admin väljer tenant ur formulärets hidden
// tenantId, salon_admin tvingas ur JWT. RLS isolates tenants but is not role-aware —
// the role gate lives here; platform-adminens writes går via platform_admin-claimet.

export type StripeActionState = { error?: string; success?: string }

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
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
  const ctx = await moduleCtx(_fd)
  if (!ctx) return { error: NO_TENANT }
  const { user, tenant } = ctx

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
      // Konto-mejlen är KUNDENS: bara salon-adminens egen mejl används; platform-
      // vägen skickar null så kunden fyller i sin mejl hos Stripe (aldrig Zivars).
      accountId = await createExpressAccount(stripe, user.platformAdmin ? null : user.email)
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
  // Tillbaka till ytan man kom ifrån: kundkortet för platform-admin, annars
  // kund-adminens betalningskategori (L3 C-01: Stripe-kortet bor på egen route).
  const backPath = user.platformAdmin ? `/salonger/${tenant.id}` : '/admin/installningar/betalning'
  let url: string
  try {
    url = await createOnboardingLink(stripe, accountId, {
      refreshUrl: `${origin}${backPath}?stripe=refresh`,
      returnUrl: `${origin}${backPath}?stripe=return`,
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
  const ctx = await moduleCtx(_fd)
  if (!ctx) return { error: NO_TENANT }
  const { tenant } = ctx

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

  // goal-61 preview-parity: charges_enabled bor på cachade tenants-raden — utan
  // tag-bust ser betalnings-gaten gammal Stripe-status i upp till 300 s.
  revalidateTenant(tenant.slug)
  revalidatePath('/admin/installningar/betalning')
  revalidatePath(`/salonger/${tenant.id}`)
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
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }
  const { tenant } = ctx

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
  revalidatePath('/admin/installningar/betalning')
  revalidatePath(`/salonger/${tenant.id}`)
  return { success: enabled ? 'Onlinebetalning vid bokning: PÅ.' : 'Onlinebetalning vid bokning: AV.' }
}
