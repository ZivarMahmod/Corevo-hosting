'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

/**
 * Per-tenant edit-toggle (Task 3): platform admin turns the SITE EDITOR (sajtbyggaren)
 * on/off for a CHOSEN salon by writing tenant_settings.settings.sajtbyggare_enabled.
 * Default OFF lives in the reader (tenantSiteEditorEnabled), not here. MERGE-prev,
 * never clobber the co-owned settings jsonb (theme/booking/copy/contact …). Deliberately
 * NOT gated on the deploy-wide env flag, so a tenant can be pre-enabled even while the
 * kill-switch is off; the env flag still fences the actual editor surface at render time.
 */
export async function setSajtbyggareEnabled(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }
  const enabled = String(fd.get('enabled') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  // MERGE prev settings (B1/§3 settings-krock guard) — read, spread ...prev, write OUR key.
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev, sajtbyggare_enabled: enabled }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('setSajtbyggareEnabled.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  // The flag gates an admin surface, not the public bundle — but bust the tenant cache
  // anyway (cheap, and the editor reads through the same path), plus the detail page.
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.sajtbyggare',
    tenantId,
    actorId: user.id,
    meta: { enabled },
  })
  return {
    success: enabled
      ? 'Sajtbyggaren aktiverad för salongen.'
      : 'Sajtbyggaren avstängd för salongen.',
  }
}
