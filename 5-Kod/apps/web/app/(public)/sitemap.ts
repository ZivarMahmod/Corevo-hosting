import type { MetadataRoute } from 'next'
import { currentTenant } from '@/lib/tenant-data'
import { requestOrigin } from '@/lib/url'

// Host-resolved, per-tenant sitemap. MUST be dynamic: it serves on every host
// (incl. booking.corevo.se and unknown subdomains). A static evaluation would
// bake one tenant's host into every response.
export const dynamic = 'force-dynamic'

/** Public storefront routes every active tenant exposes (sections, not routes,
 *  for team/gallery — so only these four pages exist). */
const PUBLIC_PATHS = ['', '/tjanster', '/om', '/kontakt'] as const

/**
 * Per-tenant sitemap. Off-tenant hosts (platform/reserved/root/unknown →
 * currentTenant() null) get an EMPTY sitemap — booking.corevo.se is the
 * back-office and must not advertise storefront URLs. Absolute URLs come from
 * requestOrigin() so each tenant's sitemap points at its own subdomain.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const bundle = await currentTenant()
  if (!bundle) return []
  const origin = await requestOrigin()
  const lastModified = bundle.tenant.updated_at ?? bundle.tenant.created_at ?? new Date()
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path || '/'}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
