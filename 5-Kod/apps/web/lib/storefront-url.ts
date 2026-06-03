/**
 * Public storefront URL for a tenant — ALWAYS the real public host
 * (`https://<slug>.corevo.se`, or the tenant's verified custom domain), computed
 * from tenant data. It is deliberately NOT derived from NEXT_PUBLIC_SITE_URL /
 * the request host: in dev that base is `localhost:3000`, which leaked into the
 * dashboard "Se din sida" subtext + the "Din sida, live" gold CTA (goal-17 verify
 * P1). Computing from the slug keeps the link correct in dev AND prod.
 */
const PUBLIC_ROOT = 'corevo.se'

export function tenantStorefrontUrl(
  slug?: string | null,
  customDomain?: string | null,
): string | null {
  if (customDomain) return `https://${customDomain}`
  if (slug) return `https://${slug}.${PUBLIC_ROOT}`
  return null
}

/** Bare host (no scheme) for display, e.g. "freshcut.corevo.se". */
export function tenantStorefrontHost(
  slug?: string | null,
  customDomain?: string | null,
): string | null {
  const url = tenantStorefrontUrl(slug, customDomain)
  return url ? url.replace(/^https?:\/\//, '') : null
}
