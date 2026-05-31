// Tenant DATA layer (G03) — DB-backed, cached resolution of a tenant + its
// theme settings + services, read via the anonymous public client.
//
// CRITICAL (ADR 01 §2 / migration 0004): the `anon` role has NO tenant_id claim,
// so RLS does NOT isolate one tenant from another. Every query here filters by
// the resolved tenant_id/slug in the app. RLS is only defense-in-depth.
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { createPublicClient } from '@/lib/supabase/public'
import { getTenantFromHost } from '@/lib/tenant'

export type Tenant = Tables<'tenants'>
export type Service = Tables<'services'>
type TenantSettingsRow = Tables<'tenant_settings'>

export type LayoutConfig = { nav_variant?: string; hero_variant?: string }
export type CustomOverride = { css?: string }

export type TenantSettings = {
  branding: TenantBranding
  layout: LayoutConfig
  /** non-null only when an actual css override string is present (nivå 3). */
  customOverride: CustomOverride | null
  paymentMode: string
}

export type TenantBundle = { tenant: Tenant; settings: TenantSettings }

function parseSettings(row: TenantSettingsRow | null): TenantSettings {
  const branding = (row?.branding ?? {}) as TenantBranding
  const raw = (row?.settings ?? {}) as Record<string, unknown>
  const layout = (raw.layout ?? {}) as LayoutConfig
  const override = (raw.custom_override ?? null) as CustomOverride | null
  const hasCss = !!override && typeof override.css === 'string' && override.css.trim().length > 0
  return {
    branding,
    layout,
    customOverride: hasCss ? override : null,
    paymentMode: row?.payment_mode ?? 'on_site',
  }
}

/**
 * Resolve an active tenant + its settings by slug. Cached per-slug
 * (slug is in keyParts → no cross-tenant cache bleed) and tagged for revalidation.
 */
export async function getTenantBySlug(slug: string): Promise<TenantBundle | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<TenantBundle | null> => {
      const supabase = createPublicClient()
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', norm)
        .eq('status', 'active')
        .maybeSingle()
      if (error || !tenant) return null
      const { data: settingsRow } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id) // app-layer scope
        .maybeSingle()
      return { tenant, settings: parseSettings(settingsRow ?? null) }
    },
    ['tenant-by-slug', norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/** Active services for a tenant, cheapest first. Always scoped by tenant_id. */
export async function getServices(tenantId: string, slug: string): Promise<Service[]> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<Service[]> => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('active', true)
        .order('price_cents', { ascending: true })
      if (error || !data) return []
      return data
    },
    ['services-by-tenant', tenantId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/**
 * Resolve the current request's tenant from the Host header (dev: subdomain on
 * localhost, e.g. frisor1.localhost:3000). Returns null for root/platform/
 * reserved/unknown hosts. Reads headers() → never cached; delegates to the
 * cached getTenantBySlug for the data.
 */
export async function currentTenant(): Promise<TenantBundle | null> {
  const h = await headers()
  // Prefer the slug the middleware already resolved (covers subdomain, ?tenant=
  // and /t/<slug> uniformly — the latter two are the workers.dev preview path).
  const headerSlug = h.get('x-corevo-tenant-slug')
  if (headerSlug) return getTenantBySlug(headerSlug)
  // Fallback: direct host parse (e.g. if middleware did not run for this path).
  const res = getTenantFromHost(h.get('host'))
  if (res.kind !== 'tenant') return null
  return getTenantBySlug(res.slug)
}
