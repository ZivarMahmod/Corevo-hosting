import 'server-only'
import { platformCtx } from './guard'
import { tenantStorefrontHost } from '@/lib/storefront-url'

// Goal 76 — every tenant's canonical wildcard host + the fixed infra hosts.
// Distinct from
// lib/platform/domains.ts (that reads tenant_domains = customer-OWNED external
// domains). Every tenant host rides the committed *.boka.corevo.se route; no
// per-tenant Cloudflare object exists or is required.

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').toLowerCase()
const FIXED_HOSTS = ['booking', 'superbooking', 'minbooking', 'mina'].map((h) => `${h}.${ROOT}`)

export type DomainStatus = 'live' | 'cert_pending' | 'managed'
export type DomainRow = {
  slug: string
  name: string
  domain: string
  tenantStatus: string
  status: DomainStatus
}
export type DomainOverview = {
  rows: DomainRow[]
  fixedHosts: string[]
  /** True when the Cloudflare Worker-Domains read is available (token provisioned). */
  cfConfigured: boolean
  /** Set if a configured CF read failed (surface it, don't pretend everything is live). */
  cfError: string | null
}

export async function getDomainOverview(): Promise<DomainOverview> {
  const { supabase } = await platformCtx()
  const { data } = await supabase
    .from('tenants')
    .select('slug, name, status')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  const tenants = (data ?? []) as { slug: string; name: string; status: string }[]

  const rows: DomainRow[] = tenants.map((t) => ({
    slug: t.slug,
    name: t.name,
    domain: tenantStorefrontHost(t.slug) ?? t.slug,
    tenantStatus: t.status,
    status: 'managed',
  }))

  return { rows, fixedHosts: FIXED_HOSTS, cfConfigured: false, cfError: null }
}
