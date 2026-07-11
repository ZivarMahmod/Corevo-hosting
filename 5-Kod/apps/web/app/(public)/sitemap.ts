import type { MetadataRoute } from 'next'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { requestOrigin } from '@/lib/url'

// Host-resolved, per-tenant sitemap. MUST be dynamic: it serves on every host
// (incl. booking.corevo.se and unknown subdomains). A static evaluation would
// bake one tenant's host into every response.
export const dynamic = 'force-dynamic'

/** Core storefront routes every active tenant exposes. */
const PUBLIC_PATHS = ['', '/tjanster', '/om', '/kontakt'] as const

/** Module pages — included ONLY when the tenant's module is live (goal-54 körning 2,
 *  S11: the commercial pages were invisible to search engines). */
const MODULE_PATHS: readonly { module: string; path: string }[] = [
  { module: 'shop', path: '/shop' },
  { module: 'blogg', path: '/blogg' },
  { module: 'offert', path: '/offert' },
  { module: 'presentkort', path: '/presentkort' },
]

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
  const states = await getTenantModuleStates(bundle.tenant.id, bundle.tenant.slug)
  const paths: string[] = [
    ...PUBLIC_PATHS,
    ...MODULE_PATHS.filter((m) => isModuleLive(states, m.module)).map((m) => m.path),
  ]
  return paths.map((path) => ({
    url: `${origin}${path || '/'}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
