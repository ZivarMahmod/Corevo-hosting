import 'server-only'
import type Stripe from 'stripe'

// Stripe Connect Express onboarding (G09 step 2). Each salong gets its OWN Express
// connected account; kund-betalningar är DIRECT charges rakt på det kontot
// (application_fee = 0 → Corevo tar inget snitt här). Account state (charges/payouts)
// speglas till tenants.* av account.updated-webhooken och refreshStripeStatus.

export type ConnectStatus = {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

/** Create an Express connected account for a salong; returns the acct_… id. */
export async function createExpressAccount(
  stripe: Stripe,
  email: string | null,
): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'SE',
    email: email ?? undefined,
    // Direct charges on the connected account → card_payments + transfers.
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
  return account.id
}

/** Account Link for hosted onboarding; returns the URL to redirect the admin to. */
export async function createOnboardingLink(
  stripe: Stripe,
  accountId: string,
  opts: { refreshUrl: string; returnUrl: string },
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: opts.refreshUrl,
    return_url: opts.returnUrl,
    type: 'account_onboarding',
  })
  return link.url
}

/** Live account capability snapshot (charges/payouts/details_submitted). */
export async function fetchConnectStatus(
  stripe: Stripe,
  accountId: string,
): Promise<ConnectStatus> {
  const a = await stripe.accounts.retrieve(accountId)
  return {
    chargesEnabled: a.charges_enabled ?? false,
    payoutsEnabled: a.payouts_enabled ?? false,
    detailsSubmitted: a.details_submitted ?? false,
  }
}
