import 'server-only'
import { platformCtx } from './guard'

// goal-23: tenant_domains read + domain-validation helpers for the DomänPanel write
// path. Pure helpers (normalize/validate/reserved) are exported for unit tests; the
// read uses the platform RLS-bypass (platform_admin sees every tenant's domains).

export type TenantDomainRow = {
  id: string
  domain: string
  verified: boolean
  isPrimary: boolean
  createdAt: string
}

/** corevo.se itself + every *.corevo.se — the platform zone, never a customer domain. */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').toLowerCase()
// A pragmatic hostname check: 1+ dot-separated labels (a–z, 0–9, hyphen, no leading/
// trailing hyphen) + a 2+ char alpha TLD. Not a full RFC validator — enough to reject
// junk before it reaches Cloudflare (CF is the real authority on acceptance).
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

/** lowercase + strip protocol, path/query, and a trailing FQDN dot. (www./subdomains
 *  are kept — they are legitimately distinct hostnames.) */
export function normalizeDomain(raw: string): string {
  let d = String(raw ?? '').trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '') // protocol
  d = d.replace(/\/.*$/, '') // path/query
  d = d.replace(/\.$/, '') // trailing dot (FQDN form)
  return d
}

export function isValidDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain)
}

/** corevo.se or any *.corevo.se is reserved — tenants run there via the platform, not
 *  as a customer custom hostname (anti-pattern: never provision the platform zone). */
export function isReservedDomain(domain: string): boolean {
  return domain === ROOT_DOMAIN || domain.endsWith(`.${ROOT_DOMAIN}`)
}

/** Validate a raw domain entry end-to-end. Returns the normalized domain or an error. */
export function validateDomainInput(raw: string): { domain?: string; error?: string } {
  const domain = normalizeDomain(raw)
  if (!domain) return { error: 'Ange en domän.' }
  if (!isValidDomain(domain)) return { error: 'Ogiltigt domänformat (t.ex. boka.salongnamn.se).' }
  if (isReservedDomain(domain))
    return { error: `${ROOT_DOMAIN}-domäner hanteras av plattformen och kan inte läggas till här.` }
  return { domain }
}

/** All custom domains for a tenant (platform read, RLS-bypass). Newest first. */
export async function listTenantDomains(tenantId: string): Promise<TenantDomainRow[]> {
  const { supabase } = await platformCtx()
  const { data } = await supabase
    .from('tenant_domains')
    .select('id, domain, verified, is_primary, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as {
    id: string
    domain: string
    verified: boolean
    is_primary: boolean
    created_at: string
  }[]).map((r) => ({
    id: r.id,
    domain: r.domain,
    verified: r.verified,
    isPrimary: r.is_primary,
    createdAt: r.created_at,
  }))
}
