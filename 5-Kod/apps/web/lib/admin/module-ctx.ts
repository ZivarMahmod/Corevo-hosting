import 'server-only'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import {
  getAdminTenant,
  loadAdminTenantById,
  requireActiveTenantMutation,
  type AdminTenant,
} from '@/lib/admin/tenant'
import { getAdminModuleStates } from '@/lib/admin/modules'
import { hasOrganizationScope } from '@/lib/admin/location-context'
import {
  isModuleLive,
  type ModuleKey,
  type TenantModuleStates,
} from '@/lib/tenant-modules'

/**
 * Dual-guard authorization fence for MODULE actions (webshop/blogg/media/offert) —
 * the ONE ctx shared between the customer's own admin (booking.corevo.se/admin/*)
 * and the super-admin kundkort (/kunder/[id]), goal-54 §1. Same trust model as
 * sidaCtx (lib/platform/guard.ts):
 *
 *   • platform operator → tenantId comes from the form's hidden `tenantId` field
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
  moduleKey?: ModuleKey,
): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  // ROLL-SEPARATION: modulerna (webshop/blogg/media/offert/kurser) ÄR systemytor —
  // alla ligger på salon_admin-nivå i lib/auth/admin-areas.ts. requirePortal('admin')
  // = nivå 6 håller därför personalen (nivå 3) ute från VARJE modul-mutation.
  const user = await requirePortal('admin') // platform_admin always passes
  let tenant: AdminTenant | null
  if (user.platformAdmin || (user.partnerAdmin && user.partnerId)) {
    const tenantId = String(fd.get('tenantId') ?? '').trim()
    if (!tenantId) return null
    tenant = await loadAdminTenantById(tenantId)
  } else {
    tenant = await getAdminTenant(user)
  }
  if (!tenant) return null
  await requireActiveTenantMutation(user, tenant.id)

  if (moduleKey) {
    const adminStates = await getAdminModuleStates(tenant.id)
    const states = Object.fromEntries(
      Object.entries(adminStates).map(([key, row]) => [key, row.state]),
    ) as TenantModuleStates
    if (!isModuleLive(states, moduleKey)) return null
  }

  return { user, tenant }
}

/** Tenant context for organization-wide mutations; operators keep their RLS-scoped tenant path. */
export async function organizationOwnerCtx(
  fd: FormData,
): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return null
  if (ctx.user.platformAdmin || (ctx.user.partnerAdmin && ctx.user.partnerId)) return ctx
  return (await hasOrganizationScope(ctx.user.id)) ? ctx : null
}
