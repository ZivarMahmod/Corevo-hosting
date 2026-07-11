import 'server-only'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CurrentUser } from '@/lib/auth/session'
import { cleanTerminology, type Terminology } from '@/lib/platform/verticals-shared'

export type AdminTenant = {
  id: string
  slug: string
  name: string
  /** IANA tz of the tenant's primary location (display + range bucketing). */
  timeZone: string
  /** Primary location id — new services/staff/working_hours are pinned to it. */
  locationId: string | null
  /** This tenant's bransch (verticals.key), or null when unset → terminology = {}. */
  verticalId: string | null
  /** Bransch label overlay (verticals.terminology). Empty for the 'generell' bransch
   *  or an unset vertical; admin label surfaces resolve through it via resolveTerm. */
  terminology: Terminology
}

const FALLBACK_TZ = 'Europe/Stockholm'

/**
 * Resolve the logged-in admin's own tenant (id + slug + name + primary tz).
 * tenant_id comes from the verified JWT (session), NEVER from client input;
 * RLS additionally fences the tenants/locations reads to this tenant. The slug
 * is what the public site caches under (`tenant:<slug>`), so admin saves use it
 * to invalidate the public cache — see {@link revalidateTenant}.
 */
export async function getAdminTenant(user: CurrentUser): Promise<AdminTenant | null> {
  if (!user.tenantId) return null
  return loadAdminTenantById(user.tenantId)
}

/**
 * Load an AdminTenant by EXPLICIT id. Only call this after the caller's right to
 * touch this tenant is established: getAdminTenant (JWT-forced id) and moduleCtx's
 * platform_admin branch (cross-tenant by role) are the two legitimate callers.
 * For a salon admin the RLS fence would empty the read anyway; for a platform
 * admin the baked platform_admin claim grants the cross-tenant read.
 */
export async function loadAdminTenantById(tenantId: string): Promise<AdminTenant | null> {
  const supabase = await createClient()
  const [{ data: tenant }, { data: loc }] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, slug, name, status, vertical_id')
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('locations')
      .select('id, timezone')
      .eq('tenant_id', tenantId)
      .eq('is_primary', true)
      .maybeSingle(),
  ])
  if (!tenant) return null
  // Soft-deleted tenant → no admin context, so every downstream admin action denies.
  if (tenant.status === 'deleted') return null

  // Bransch terminology overlay (verticals.terminology) → admin label surfaces.
  // Separate read (NOT an embedded join) on purpose: a verticals RLS/shape change
  // can then never null the tenant read and lock the admin out; on any miss the
  // overlay simply stays {}. verticals_read is SELECT-open to authenticated, so the
  // salon admin can read it.
  let terminology: Terminology = {}
  if (tenant.vertical_id) {
    const { data: vertical } = await supabase
      .from('verticals')
      .select('terminology')
      .eq('key', tenant.vertical_id)
      .maybeSingle()
    terminology = cleanTerminology(vertical?.terminology)
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    timeZone: loc?.timezone ?? FALLBACK_TZ,
    locationId: loc?.id ?? null,
    verticalId: tenant.vertical_id ?? null,
    terminology,
  }
}

/**
 * Invalidate the public M2/M3 cache for a tenant. The data layer tags both
 * `getTenantBySlug` and `getServices` with `tenant:<slug>` (lib/tenant-data.ts),
 * so one call refreshes branding, tenant name AND the services list on the
 * public site immediately after an admin save.
 */
export function revalidateTenant(slug: string): void {
  revalidateTag(`tenant:${slug.trim().toLowerCase()}`)
}

/**
 * Absolute URL of a tenant's PUBLIC storefront, e.g. `https://demo.corevo.se`.
 * The back-office lives on `booking.corevo.se`, so we build the storefront origin
 * from the tenant slug + the configured root domain (NEXT_PUBLIC_ROOT_DOMAIN).
 * On localhost there is no wildcard subdomain, so we fall back to `?tenant=<slug>`
 * which the middleware already understands (lib/tenant.ts). Used by the "Se din
 * sida"-links (dashboard + branding) and the branding preview button.
 */
export function storefrontUrl(slug: string): string {
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').trim()
  const s = slug.trim().toLowerCase()
  // localhost (with optional :port) → no real subdomains; use the ?tenant= seam.
  if (/^localhost(:\d+)?$/.test(root) || root.startsWith('127.0.0.1')) {
    return `http://${root}/?tenant=${encodeURIComponent(s)}`
  }
  return `https://${s}.${root.replace(/:\d+$/, '')}`
}
