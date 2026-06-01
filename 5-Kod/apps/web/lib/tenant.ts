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

const ENV_ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
const ENV_RESERVED = (
  process.env.NEXT_PUBLIC_RESERVED_SUBDOMAINS ??
  'booking,admin,app,www,api,superadmin,kiosk,dev,odoo'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ENV_PLATFORM = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? 'booking.corevo.se'

// Single source of truth for reserved subdomains (G08): the platform slug
// validator must reject exactly the names that never resolve to a tenant here.
// Re-exported so lib/platform/slug.ts can't drift from this list.
export const RESERVED_SUBDOMAINS: readonly string[] = ENV_RESERVED

function stripPort(host: string): string {
  const i = host.indexOf(':')
  return i === -1 ? host : host.slice(0, i)
}

export function getTenantFromHost(
  host: string | null | undefined,
  opts: ResolveOptions = {},
): TenantResolution {
  const rootDomain = opts.rootDomain ?? ENV_ROOT
  const reserved = opts.reserved ?? ENV_RESERVED
  const platformHost = opts.platformHost ?? ENV_PLATFORM

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
