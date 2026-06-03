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

export type TenantResolution =
  | { kind: 'tenant'; slug: string }
  | { kind: 'platform' }
  | { kind: 'reserved'; subdomain: string }
  | { kind: 'root' }
  | { kind: 'unknown' }

export type ResolveOptions = {
  rootDomain?: string
  reserved?: string[]
  platformHost?: string
  search?: URLSearchParams
  pathname?: string
}

const DEFAULT_ROOT = 'localhost:3000'
const DEFAULT_RESERVED = 'booking,admin,app,www,api,superadmin,kiosk,dev,odoo'
const DEFAULT_PLATFORM = 'booking.corevo.se'

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

// Single source of truth for reserved subdomains (G08): the platform slug
// validator must reject exactly the names that never resolve to a tenant here.
// Re-exported so lib/platform/slug.ts can't drift from this list. (The default
// list is the canonical one, so a module-load read here is always correct.)
export const RESERVED_SUBDOMAINS: readonly string[] = envReserved()

function stripPort(host: string): string {
  const i = host.indexOf(':')
  return i === -1 ? host : host.slice(0, i)
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

  const classify = (raw: string): TenantResolution => {
    const slug = raw.trim().toLowerCase()
    if (!slug) return { kind: 'root' }
    if (reserved.includes(slug)) {
      // booking is the platform/admin host; the rest are simply not tenants.
      return slug === 'booking' ? { kind: 'platform' } : { kind: 'reserved', subdomain: slug }
    }
    return { kind: 'tenant', slug }
  }

  // Dev fallbacks take priority: ?tenant=slug, then /t/slug.
  const qs = opts.search?.get('tenant')
  if (qs) return classify(qs)
  if (opts.pathname) {
    const m = /^\/t\/([^/]+)/.exec(opts.pathname)
    if (m && m[1]) return classify(m[1])
  }

  if (!host) return { kind: 'unknown' }
  const hostname = stripPort(host).toLowerCase()
  const root = stripPort(rootDomain).toLowerCase()
  const platform = stripPort(platformHost).toLowerCase()

  if (hostname === platform) return { kind: 'platform' }
  if (hostname === root || hostname === 'localhost' || hostname === '127.0.0.1') {
    return { kind: 'root' }
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
