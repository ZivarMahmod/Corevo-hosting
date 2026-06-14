// Tenant resolution — host → slug (ADR 01 §2). Pure + dependency-free so it can
// run in middleware (edge), Server Components, and a plain Node test.
//
//   live: frisor1.corevo.se        → { tenant, frisor1 }
//   dev:  frisor1.localhost:3000   → { tenant, frisor1 }
//   dev:  ?tenant=frisor1          → { tenant, frisor1 }
//   dev:  /t/frisor1               → { tenant, frisor1 }
//   reserved (booking/admin/app/www/api/superadmin/kiosk/dev/odoo) NEVER resolve
//   to a tenant — the extra names are already used by the POS on corevo.se, so
//   reserving them lets both platforms coexist on the same apex.
//
// goal-27 — the back-office splits across THREE doors by host:
//   booking.corevo.se        → { kind: 'platform' }      (salon admin, app/(admin))
//   superbooking.corevo.se   → { kind: 'superadmin' }    (platform,    app/(platform))
//   minbooking.corevo.se     → { kind: 'staff_portal' }  (staff,       app/(personal))
// NAMING NOTE: the reserved POS label 'superadmin' (a corevo.se POS subdomain) is
// distinct from BOTH the new 'superadmin' RESOLUTION KIND and the new
// 'superbooking' host that carries it — they never collide because the host-equality
// check below fires before classify() ever sees the reserved list.

export type TenantResolution =
  | { kind: 'tenant'; slug: string }
  | { kind: 'platform' }
  | { kind: 'superadmin' }
  | { kind: 'staff_portal' }
  | { kind: 'reserved'; subdomain: string }
  | { kind: 'root' }
  | { kind: 'unknown' }

export type ResolveOptions = {
  rootDomain?: string
  reserved?: string[]
  platformHost?: string
  superadminHost?: string
  staffHost?: string
  /** goal-28 — dedicated salon-storefront branch suffix (e.g. boka.corevo.se).
   *  <slug>.<suffix> → tenant; the bare <suffix> apex → reserved (not a tenant). */
  tenantHostSuffix?: string
  search?: URLSearchParams
  pathname?: string
}

const DEFAULT_ROOT = 'localhost:3000'
// goal-27: superbooking + minbooking join the reserved list so the slug validator
// (lib/platform/slug.ts) rejects them as tenant names. The exact hosts are
// classified by host-equality below BEFORE classify() reads this list, so they
// resolve to 'superadmin'/'staff_portal', never 'reserved'.
// fix-29 — 'boka' is the salon-storefront BRANCH apex (boka.corevo.se, goal-28), never
// a tenant. Reserving it stops the slug validator (lib/platform/slug.ts) from ever
// minting a salon named 'boka'. The branch apex is also caught by host-equality in
// getTenantFromHost (so <slug>.boka.corevo.se still resolves the <slug>, not 'boka').
const DEFAULT_RESERVED =
  'booking,admin,app,www,api,superadmin,kiosk,dev,odoo,superbooking,minbooking,boka'
const DEFAULT_PLATFORM = 'booking.corevo.se'
const DEFAULT_SUPERADMIN = 'superbooking.corevo.se'
const DEFAULT_STAFF = 'minbooking.corevo.se'
// goal-28 — salon storefronts live on a DEDICATED wildcard branch so a blunt
// *.corevo.se route never has to exist (it would hijack the POS subdomains on this
// shared zone). The suffix is read from env (NEXT_PUBLIC_TENANT_HOST_SUFFIX), never
// hardcoded, so the branch can move without a code change.
const DEFAULT_TENANT_SUFFIX = 'boka.corevo.se'

// READ AT CALL TIME, not module load. On the OpenNext/Workers adapter, `vars`
// are injected into process.env per request — NOT necessarily when this module
// is first evaluated. Reading these as top-level consts made
// NEXT_PUBLIC_ROOT_DOMAIN fall back to 'localhost:3000' on the Worker, so real
// subdomains (demo.corevo.se) resolved to `unknown` → storefront 404. Resolving
// inside the function (which runs per request) sees the live vars.
const splitReserved = (v: string): string[] => v.split(',').map((s) => s.trim()).filter(Boolean)
const envRoot = (): string => process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT
const envReserved = (): string[] =>
  splitReserved(process.env.NEXT_PUBLIC_RESERVED_SUBDOMAINS ?? DEFAULT_RESERVED)
const envPlatform = (): string => process.env.NEXT_PUBLIC_PLATFORM_HOST ?? DEFAULT_PLATFORM
const envSuperadmin = (): string => process.env.NEXT_PUBLIC_SUPERADMIN_HOST ?? DEFAULT_SUPERADMIN
const envStaff = (): string => process.env.NEXT_PUBLIC_STAFF_HOST ?? DEFAULT_STAFF
const envTenantSuffix = (): string =>
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? DEFAULT_TENANT_SUFFIX

// goal-27 — back-office host names for the 3-door split, read at call time (same
// per-request env caveat as envRoot/envPlatform above). Exported so middleware can
// build cross-host redirects without re-reading process.env itself.
export const getPlatformHost = (): string => envPlatform()
export const getSuperadminHost = (): string => envSuperadmin()
export const getStaffHost = (): string => envStaff()

// Single source of truth for reserved subdomains (G08): the platform slug
// validator must reject exactly the names that never resolve to a tenant here.
// Re-exported so lib/platform/slug.ts can't drift from this list. (The default
// list is the canonical one, so a module-load read here is always correct.)
export const RESERVED_SUBDOMAINS: readonly string[] = envReserved()

function stripPort(host: string): string {
  const i = host.indexOf(':')
  return i === -1 ? host : host.slice(0, i)
}

// Dev/preview hosts where the ?tenant=/​/t/ override (and its persistence cookie)
// are honored — localhost, *.localhost, *.workers.dev, or a missing host. A real
// production host (corevo.se apex/subdomain) returns false, so the override can
// never serve a foreign tenant on a live salon/platform domain.
export function isPreviewHost(host: string | null | undefined): boolean {
  const h = host ? stripPort(host).toLowerCase() : ''
  return (
    !h ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.localhost') ||
    h.endsWith('.workers.dev')
  )
}

// goal-16 — is `host` a candidate for the custom-domain DB lookup? TRUE only for a
// real external domain (a customer's own host) that is NOT one of ours and NOT
// dev/staging noise. getTenantFromHost returns kind:'unknown' for anything outside
// our apex; this further EXCLUDES *.workers.dev (the staging worker, which is
// 'unknown' too) and IP/localhost forms so middleware doesn't fire a needless RPC
// on every preview request. Pure (mirrors getTenantFromHost's env reads).
export function isExternalHost(
  host: string | null | undefined,
  opts: { rootDomain?: string; platformHost?: string } = {},
): boolean {
  if (!host) return false
  const hostname = stripPort(host).toLowerCase()
  if (!hostname || !hostname.includes('.')) return false // bare label / not a domain
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false
  if (hostname.endsWith('.localhost') || hostname.endsWith('.workers.dev')) return false

  const root = stripPort(opts.rootDomain ?? envRoot()).toLowerCase()
  const platform = stripPort(opts.platformHost ?? envPlatform()).toLowerCase()
  if (hostname === root || hostname === platform) return false
  if (hostname.endsWith('.' + root)) return false // our own subdomains
  return true
}

export function getTenantFromHost(
  host: string | null | undefined,
  opts: ResolveOptions = {},
): TenantResolution {
  const rootDomain = opts.rootDomain ?? envRoot()
  const reserved = opts.reserved ?? envReserved()
  const platformHost = opts.platformHost ?? envPlatform()
  const superadminHost = opts.superadminHost ?? envSuperadmin()
  const staffHost = opts.staffHost ?? envStaff()
  const tenantHostSuffix = opts.tenantHostSuffix ?? envTenantSuffix()

  const classify = (raw: string): TenantResolution => {
    const slug = raw.trim().toLowerCase()
    if (!slug) return { kind: 'root' }
    if (reserved.includes(slug)) {
      // booking is the platform/admin host; the rest are simply not tenants.
      return slug === 'booking' ? { kind: 'platform' } : { kind: 'reserved', subdomain: slug }
    }
    return { kind: 'tenant', slug }
  }

  // Dev/preview overrides (?tenant=slug, /t/slug) are honored ONLY on non-production
  // hosts (see isPreviewHost). On a REAL tenant/platform host the query param must
  // NEVER override the subdomain: a stale or crafted `?tenant=` link would otherwise
  // serve another salon on this salon's domain (tenant-confusion). Production tenant
  // isolation = host only.
  if (isPreviewHost(host)) {
    const qs = opts.search?.get('tenant')
    if (qs) return classify(qs)
    if (opts.pathname) {
      const m = /^\/t\/([^/]+)/.exec(opts.pathname)
      if (m && m[1]) return classify(m[1])
    }
  }

  if (!host) return { kind: 'unknown' }
  const hostname = stripPort(host).toLowerCase()
  const root = stripPort(rootDomain).toLowerCase()
  const platform = stripPort(platformHost).toLowerCase()
  const superadmin = stripPort(superadminHost).toLowerCase()
  const staff = stripPort(staffHost).toLowerCase()

  // goal-27 — the three back-office doors are matched by EXACT host BEFORE the
  // suffix/classify path, so 'superbooking'/'minbooking' resolve to their own
  // kinds instead of falling into classify()'s reserved branch.
  if (hostname === platform) return { kind: 'platform' }
  if (hostname === superadmin) return { kind: 'superadmin' }
  if (hostname === staff) return { kind: 'staff_portal' }
  if (hostname === root || hostname === 'localhost' || hostname === '127.0.0.1') {
    return { kind: 'root' }
  }

  // goal-28 — salon storefronts on the dedicated branch <slug>.boka.corevo.se.
  // Checked BEFORE the generic rootSuffix below because <slug>.boka.corevo.se ends
  // with BOTH '.boka.corevo.se' AND '.corevo.se' — the generic path would read the
  // last label before the root ('boka') as the slug. classify() is reused so reserved
  // names can't become tenants on this branch either. The bare apex (boka.corevo.se)
  // is NOT a tenant: it's reserved so the generic path never resolves it to a 'boka'
  // tenant. POS protection is intact — this only matches the boka branch, never a
  // bare POS subdomain.
  const tenantSuffix = stripPort(tenantHostSuffix).toLowerCase()
  if (tenantSuffix) {
    const tenantSuffixDot = '.' + tenantSuffix
    if (hostname.endsWith(tenantSuffixDot)) {
      const label = hostname.slice(0, -tenantSuffixDot.length).split('.').pop() ?? ''
      return classify(label)
    }
    if (hostname === tenantSuffix) {
      return { kind: 'reserved', subdomain: tenantSuffix.split('.')[0] ?? tenantSuffix }
    }
  }

  const rootSuffix = '.' + root
  if (hostname.endsWith(rootSuffix)) {
    const label = hostname.slice(0, -rootSuffix.length).split('.').pop() ?? ''
    return classify(label)
  }

  // Dev convenience: <slug>.localhost (any port).
  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length).split('.').pop() ?? ''
    return classify(label)
  }

  return { kind: 'unknown' }
}
