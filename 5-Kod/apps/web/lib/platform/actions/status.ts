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

  let tenant: { slug: string } | null = null
  let transitioned = true
  if (status === 'active') {
    const { data: publishData, error: publishError } = await supabase.rpc(
      'publish_tenant' as never,
      { p_tenant: tenantId } as never,
    )
    if (publishError) {
      await reportActionError('setTenantStatus.publish', publishError, { tenantId, status })
      if (
        publishError.code === '55000'
        || publishError.message.includes('tenant_not_ready')
      ) {
        return {
          error:
            'Kunden är inte redo att publiceras. Slutför punkterna under Publiceringskontroll.',
        }
      }
      return { error: GENERIC }
    }
    transitioned =
      (publishData as unknown as { transitioned?: unknown } | null)?.transitioned === true
    const tenantRead = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .maybeSingle()
    tenant = tenantRead.data
  } else {
    const update = await supabase
      .from('tenants')
      .update({ status })
      .eq('id', tenantId)
      .select('slug')
      .single()
    tenant = update.data
    if (update.error) {
      await reportActionError('setTenantStatus.update', update.error, { tenantId, status })
      return { error: GENERIC }
    }
  }
  if (!tenant) {
    await reportActionError('setTenantStatus.reconcile', new Error('tenant_not_found'), {
      tenantId,
      status,
    })
    return { error: GENERIC }
  }

  // CRITICAL: the public bundle is tag-cached (getTenantBySlug, revalidate:300).
  // Without busting the tag a suspend stays live up to 5 min — DoD would "fail".
  revalidateTenant(tenant.slug)
  revalidatePath('/platform')
  revalidatePath('/kunder')
  revalidatePath(`/kunder/${tenantId}`)
  if (transitioned) {
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
  }
  return {
    success:
      status === 'deleted'
        ? 'Kunden är borttagen — publika sajten och admin blockeras.'
        : status === 'suspended'
          ? 'Kunden är pausad — publika sajten blockeras.'
          : transitioned
            ? 'Kunden är aktiv — publika sajten är öppen.'
            : 'Kunden är redan aktiv.',
  }
}
