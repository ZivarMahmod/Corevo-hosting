/**
 * Public storefront URL for a tenant — ALWAYS the real public host
 * (`https://<slug>.boka.corevo.se`, or the tenant's verified custom domain), computed
 * from tenant data. It is deliberately NOT derived from NEXT_PUBLIC_SITE_URL /
 * the request host. `tenantStorefrontAppUrl` is the explicit localhost seam for
 * back-office preview links; canonical display never changes with the dev host.
 */
export const TENANT_HOST_SUFFIX = 'boka.corevo.se'
const LEGACY_TENANT_HOST_SUFFIX = 'corevo.se'

function cleanHost(value?: string | null): string | null {
  const host = value?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return host || null
}

function cleanSlug(value?: string | null): string | null {
  const slug = value?.trim().toLowerCase()
  return slug || null
}

export function tenantStorefrontUrl(
  slug?: string | null,
  customDomain?: string | null,
): string | null {
  const customHost = cleanHost(customDomain)
  if (customHost) return `https://${customHost}`
  const clean = cleanSlug(slug)
  return clean ? `https://${clean}.${TENANT_HOST_SUFFIX}` : null
}

/** Bare canonical host for display, e.g. "freshcut.boka.corevo.se". */
export function tenantStorefrontHost(
  slug?: string | null,
  customDomain?: string | null,
): string | null {
  const url = tenantStorefrontUrl(slug, customDomain)
  return url ? url.replace(/^https?:\/\//, '') : null
}

/** Accepted only while already-published `<slug>.corevo.se` links still exist. */
export function legacyTenantStorefrontHost(slug?: string | null): string | null {
  const clean = cleanSlug(slug)
  return clean ? `${clean}.${LEGACY_TENANT_HOST_SUFFIX}` : null
}

/** Canonicalizes Corevo-owned origins; verified external origins pass through unchanged. */
export function normalizeTenantStorefrontOrigin(
  slug: string,
  origin: string,
): string | null {
  const canonicalHost = tenantStorefrontHost(slug)
  const legacyHost = legacyTenantStorefrontHost(slug)
  if (!canonicalHost || !legacyHost) return null
  try {
    const parsed = new URL(origin)
    return parsed.hostname === canonicalHost || parsed.hostname === legacyHost
      ? `https://${canonicalHost}`
      : parsed.origin
  } catch {
    return null
  }
}

/**
 * Clickable back-office URL. Production stays canonical; localhost reuses the
 * middleware's existing tenant query seam because wildcard subdomains do not
 * exist on a developer machine.
 */
export function tenantStorefrontAppUrl(
  slug?: string | null,
  customDomain?: string | null,
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se',
): string | null {
  const customHost = cleanHost(customDomain)
  if (customHost) return `https://${customHost}`
  const clean = cleanSlug(slug)
  if (!clean) return null
  const root = rootDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(root)) {
    return `http://${root}/?tenant=${encodeURIComponent(clean)}`
  }
  return tenantStorefrontUrl(clean)
}
