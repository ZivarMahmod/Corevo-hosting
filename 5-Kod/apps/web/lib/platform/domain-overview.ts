import 'server-only'
import { platformCtx } from './guard'
import {
  listWorkerDomains,
  workerDomainsConfigured,
  subdomainFor,
} from '@/lib/cloudflare/worker-domains'

// goal-32 F3 — read for the super-admin "Domäner" overview: every salon's
// <slug>.corevo.se + its status, plus the 3 fixed infra hosts. Distinct from
// lib/platform/domains.ts (that reads tenant_domains = customer-OWNED external
// domains). Source = DB (active tenants) ∪ Cloudflare (Worker Domains, when the
// instant-attach token is provisioned). NEVER fakes a status: without a CF token we
// can't read CF, so the row is 'managed' (it rides every deploy via the generator —
// live-HTTP truth is the check_domains guard's job, not this view's).

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').toLowerCase()
const FIXED_HOSTS = ['booking', 'superbooking', 'minbooking'].map((h) => `${h}.${ROOT}`)

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

  // Read CF state ONLY when the token is provisioned. Without it the domain is still
  // DB-driven (it rides every deploy), so the honest status is 'managed', not 'live'.
  const cfConfigured = workerDomainsConfigured()
  let attached = new Set<string>()
  let cfError: string | null = null
  if (cfConfigured) {
    const res = await listWorkerDomains()
    if (res.ok) attached = new Set(res.data.map((d) => d.hostname.toLowerCase()))
    else cfError = res.error
  }

  const rows: DomainRow[] = tenants.map((t) => {
    const domain = subdomainFor(t.slug)
    let status: DomainStatus = 'managed'
    if (cfConfigured && !cfError) status = attached.has(domain) ? 'live' : 'cert_pending'
    return { slug: t.slug, name: t.name, domain, tenantStatus: t.status, status }
  })

  return { rows, fixedHosts: FIXED_HOSTS, cfConfigured, cfError }
}
