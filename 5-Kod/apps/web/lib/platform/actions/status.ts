'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Step 6: launch / suspend ────────────────────────────────────────────────────
export async function setTenantStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const status = String(fd.get('status') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  // 'deleted' = soft delete: flip tenants.status (NEVER .delete() — keep the history).
  if (status !== 'active' && status !== 'suspended' && status !== 'deleted')
    return { error: 'Ogiltig status.' }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update({ status })
    .eq('id', tenantId)
    .select('slug')
    .single()
  if (error || !tenant) {
    await reportActionError('setTenantStatus.update', error, { tenantId, status })
    return { error: GENERIC }
  }

  // CRITICAL: the public bundle is tag-cached (getTenantBySlug, revalidate:300).
  // Without busting the tag a suspend stays live up to 5 min — DoD would "fail".
  revalidateTenant(tenant.slug)
  revalidatePath('/platform')
  revalidatePath('/salonger')
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action:
      status === 'deleted'
        ? 'tenant.delete'
        : status === 'suspended'
          ? 'tenant.suspend'
          : 'tenant.activate',
    tenantId,
    actorId: user.id,
    meta: { status },
  })
  return {
    success:
      status === 'deleted'
        ? 'Kunden är borttagen — publika sajten och admin blockeras.'
        : status === 'suspended'
          ? 'Kunden är pausad — publika sajten blockeras.'
          : 'Kunden är aktiv igen — publika sajten öppen.',
  }
}
