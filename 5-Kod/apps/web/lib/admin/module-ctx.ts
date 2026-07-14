import 'server-only'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, loadAdminTenantById, type AdminTenant } from '@/lib/admin/tenant'

/**
 * Dual-guard authorization fence for MODULE actions (webshop/blogg/media/offert) —
 * the ONE ctx shared between the customer's own admin (booking.corevo.se/admin/*)
 * and the super-admin kundkort (/salonger/[id]), goal-54 §1. Same trust model as
 * sidaCtx (lib/platform/guard.ts):
 *
 *   • platform_admin  → tenantId comes from the form's hidden `tenantId` field
 *     (the kundkort mounts the module tools with a tenantId prop). Missing/unknown
 *     id → null → action denies. RLS lets the read through only because of the
 *     baked platform_admin claim.
 *   • salon_admin     → tenantId is FORCED from the verified JWT; whatever the
 *     client posted in `tenantId` is IGNORED. A tampered cross-tenant id can never
 *     escalate — this branch never reads the form field at all.
 *
 * Replaces the four copy-pasted adminCtx() helpers in lib/admin/{shop,blogg,media,
 * offert}/actions.ts. Returns the same { user, tenant } shape they produced.
 */
export async function moduleCtx(
  fd: FormData,
): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  // ROLL-SEPARATION: modulerna (webshop/blogg/media/offert/kurser) ÄR systemytor —
  // alla ligger på salon_admin-nivå i lib/auth/admin-areas.ts. requirePortal('admin')
  // = nivå 6 håller därför personalen (nivå 3) ute från VARJE modul-mutation.
  const user = await requirePortal('admin') // platform_admin always passes
  if (user.platformAdmin) {
    const tenantId = String(fd.get('tenantId') ?? '').trim()
    if (!tenantId) return null
    const tenant = await loadAdminTenantById(tenantId)
    if (!tenant) return null
    return { user, tenant }
  }
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}
