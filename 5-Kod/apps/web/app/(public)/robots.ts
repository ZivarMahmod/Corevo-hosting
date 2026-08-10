import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { currentTenant } from '@/lib/tenant-data'
import { storefrontExperienceFromHeader } from '@/lib/storefront/experience'
import { requestOrigin } from '@/lib/url'

// Host-resolved, per-tenant robots. MUST be dynamic for the same reason as the
// sitemap: it serves on every host and the rules + sitemap URL are host-specific.
export const dynamic = 'force-dynamic'

/**
 * Per-tenant robots.txt.
 *  - On a real tenant storefront: allow crawling, point at the tenant's sitemap,
 *    but keep the customer account area (/konto) out of the index.
 *  - Off-tenant (platform/reserved/root/unknown → currentTenant() null):
 *    disallow everything — the back-office (booking.corevo.se) is not public.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const experience = storefrontExperienceFromHeader(
    (await headers()).get('x-corevo-storefront-experience'),
  )
  if (experience === 'freshcut-motiontest') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  const bundle = await currentTenant()
  if (!bundle) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  const origin = await requestOrigin()
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/konto', '/api/'] }],
    sitemap: `${origin}/sitemap.xml`,
  }
}
