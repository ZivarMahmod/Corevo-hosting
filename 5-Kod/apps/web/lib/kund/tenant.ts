import 'server-only'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'

export type KundTenant = { id: string; slug: string }

/**
 * Resolve the request's tenant (id + slug) from the middleware-set
 * `x-corevo-tenant-slug` header. Tenant identity is ALWAYS server-resolved —
 * never taken from the client (mirrors the booking flow's getTenantContext).
 * Returns null on root/platform/reserved/unknown hosts.
 */
export async function currentKundTenant(): Promise<KundTenant | null> {
  const h = await headers()
  const slug = h.get('x-corevo-tenant-slug')
  if (!slug) return null
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  return data ? { id: data.id, slug: data.slug } : null
}
