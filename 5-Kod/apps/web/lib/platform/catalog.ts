import 'server-only'
import { platformCtx } from './guard'

// ── Integrationer ───────────────────────────────────────────────────────────────
/** How the connected-count is sourced — drives whether we show a live count + a
 *  derived status badge. null = no per-tenant backing column → no count, no badge. */
export type IntegrationCountSource = 'stripe' | 'review_link' | 'custom_domain' | null

export type Integration = {
  id: string
  name: string
  desc: string
  color: string
  letter: string
  flow: string
  countSource: IntegrationCountSource
}

// NO static `status` field here (#13): a hardcoded "Aktiv"/"Pilot" string is exactly
// the fake-live signal the ärlighetspass kills. The status badge is DERIVED at render
// from the real `connected` count (see IntegrationsGrid.statusBadge), and cards with
// no backing column get no badge at all.

/** Static integration catalog (mock SU_INTEGRATIONS) — descriptions are config. */
const INTEGRATION_CATALOG: Integration[] = [
  {
    id: 'stripe',
    name: 'Stripe Connect',
    desc: 'Betalning vid bokning + utbetalning per tenant.',
    color: '#635BFF',
    letter: 'S',
    flow: 'Flöde 1 (kund betalar företaget direkt)',
    countSource: 'stripe',
  },
  {
    id: 'google',
    name: 'Google-recensioner',
    desc: 'Recensionslänk per företag — visas i kundportal & bekräftelse.',
    color: '#EA4335',
    letter: 'G',
    flow: 'tenant_settings.review_link',
    countSource: 'review_link',
  },
  {
    id: 'sms',
    name: 'SMS (46elks)',
    desc: 'Bokningsbekräftelse + påminnelse 24 h innan.',
    color: '#1F4636',
    letter: 'S',
    flow: 'Kö via Worker · sann-kopplad toggle',
    countSource: null,
  },
  {
    id: 'mail',
    name: 'E-post (Resend)',
    desc: 'Bekräftelser, invites, lösenordsreset.',
    color: '#0A0A0A',
    letter: '@',
    flow: 'Transaktionell',
    countSource: null,
  },
  {
    id: 'domain',
    name: 'Cloudflare / Domän',
    desc: 'Subdomän kundnamn.corevo.se. Egen domän = parkerat spår.',
    color: '#F38020',
    letter: 'C',
    flow: 'tenant_domains',
    countSource: 'custom_domain',
  },
  {
    id: 'pos',
    name: 'Corevo POS',
    desc: 'Kassakoppling på plats. Guardrail aktiv.',
    color: '#B5760A',
    letter: 'P',
    flow: 'POS-guardrail på corevo.se',
    countSource: null,
  },
]

export type IntegrationWithCount = Integration & {
  /** "{connected} / {total}" live, or null when no backing column exists. */
  connected: number | null
  total: number
}

/**
 * The integration catalog with LIVE connected-tenant counts where a backing column
 * exists (RLS bypass). SMS/E-post/POS have no per-tenant backing column → connected
 * is null and the view shows an honest "—" instead of a fabricated count.
 */
export async function getPlatformIntegrations(): Promise<IntegrationWithCount[]> {
  const { supabase } = await platformCtx()
  const [totalRes, stripeRes, domainRes, settingsRes] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    // Stripe "connected" = a tenant whose Stripe account can take charges.
    supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('stripe_charges_enabled', true),
    // Custom domain "connected" = a verified tenant_domains row.
    supabase
      .from('tenant_domains')
      .select('tenant_id', { count: 'exact', head: true })
      .eq('verified', true),
    // Review-link "connected" = a tenant_settings row whose settings jsonb has a
    // non-empty google_review_url. No SQL jsonb filter for non-empty, so pull the
    // candidate rows (settings is small) and tally in JS.
    supabase.from('tenant_settings').select('settings'),
  ])

  const total = totalRes.count ?? 0
  const reviewConnected = ((settingsRes.data ?? []) as { settings: Record<string, unknown> | null }[]).filter(
    (s) => {
      const url = s.settings?.google_review_url
      return typeof url === 'string' && url.trim().length > 0
    },
  ).length

  const liveCount: Record<NonNullable<IntegrationCountSource>, number> = {
    stripe: stripeRes.count ?? 0,
    custom_domain: domainRes.count ?? 0,
    review_link: reviewConnected,
  }

  return INTEGRATION_CATALOG.map((it) => ({
    ...it,
    total,
    connected: it.countSource ? liveCount[it.countSource] : null,
  }))
}
