import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { canAccessAdminArea, type AdminArea } from '@/lib/auth/admin-areas'

export type OperationalRole = 'manager' | 'staff'

export type MemberPermissions = {
  operationalRole: OperationalRole
  canViewAllCalendars: boolean
  canManageCustomers: boolean
  canEditSite: boolean
  canViewDailyMetrics: boolean
}

export const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = {
  operationalRole: 'staff',
  canViewAllCalendars: false,
  canManageCustomers: false,
  canEditSite: false,
  canViewDailyMetrics: false,
}

export function memberGrantsArea(area: AdminArea, permissions: MemberPermissions): boolean {
  if (area === 'kunder') {
    return permissions.operationalRole === 'manager' || permissions.canManageCustomers
  }
  if (area === 'tjanster' || area === 'scheman') return permissions.operationalRole === 'manager'
  if (area === 'sida') return permissions.canEditSite
  if (area === 'statistik') return permissions.canViewDailyMetrics
  return false
}

export async function getMemberPermissions(params: {
  tenantId: string
  staffId: string
}): Promise<MemberPermissions> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_member_permissions')
    .select(
      'operational_role, can_view_all_calendars, can_manage_customers, can_edit_site, can_view_daily_metrics',
    )
    .eq('tenant_id', params.tenantId)
    .eq('staff_id', params.staffId)
    .maybeSingle()

  if (!data) return DEFAULT_MEMBER_PERMISSIONS
  return {
    operationalRole: data.operational_role === 'manager' ? 'manager' : 'staff',
    canViewAllCalendars: data.can_view_all_calendars,
    canManageCustomers: data.can_manage_customers,
    canEditSite: data.can_edit_site,
    canViewDailyMetrics: data.can_view_daily_metrics,
  }
}

export async function listTenantMemberPermissions(tenantId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_member_permissions')
    .select(
      'staff_id, operational_role, can_view_all_calendars, can_manage_customers, can_edit_site, can_view_daily_metrics',
    )
    .eq('tenant_id', tenantId)

  return new Map(
    (data ?? []).map((row) => [
      row.staff_id,
      {
        operationalRole: row.operational_role === 'manager' ? 'manager' : 'staff',
        canViewAllCalendars: row.can_view_all_calendars,
        canManageCustomers: row.can_manage_customers,
        canEditSite: row.can_edit_site,
        canViewDailyMetrics: row.can_view_daily_metrics,
      } satisfies MemberPermissions,
    ]),
  )
}

export async function hasAdminAreaPermission(
  area: AdminArea,
  user: {
    roleLevel: number
    platformAdmin?: boolean
    tenantId: string | null
    staffId: string | null
  },
): Promise<boolean> {
  if (canAccessAdminArea(area, user)) return true
  if (user.roleLevel !== 3 || !user.tenantId || !user.staffId) return false
  return memberGrantsArea(
    area,
    await getMemberPermissions({ tenantId: user.tenantId, staffId: user.staffId }),
  )
}
