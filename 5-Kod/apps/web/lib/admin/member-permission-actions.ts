'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminArea } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type MemberPermissionActionState = { success?: string; error?: string }

export async function saveMemberPermissions(
  _previous: MemberPermissionActionState,
  formData: FormData,
): Promise<MemberPermissionActionState> {
  await requireAdminArea('installningar')
  const staffId = String(formData.get('staff_id') ?? '').trim()
  const operationalRole = String(formData.get('operational_role') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(staffId)) return { error: 'Ogiltig medarbetare.' }
  if (operationalRole !== 'manager' && operationalRole !== 'staff') {
    return { error: 'Ogiltig roll.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_tenant_member_permissions', {
    p_staff: staffId,
    p_operational_role: operationalRole,
    p_can_view_all_calendars: formData.get('can_view_all_calendars') === 'true',
    p_can_manage_customers: formData.get('can_manage_customers') === 'true',
    p_can_edit_site: formData.get('can_edit_site') === 'true',
    p_can_view_daily_metrics: formData.get('can_view_daily_metrics') === 'true',
  })
  if (error) return { error: 'Behörigheten kunde inte sparas.' }

  revalidatePath('/admin/installningar')
  return { success: 'Behörigheten är sparad.' }
}
