'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { StorefrontTheme } from '@/lib/tenant-data'
import { isSelectableTheme } from '@/lib/platform/theme-palettes'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Storefront-mall (settings.theme) — super-admin byter kundens mall från kundkortet.
// Merge, never clobber: settings är co-owned jsonb (copy/contact/booking/flags …), så vi
// läser prev och spread:ar `...prev` innan vi skriver theme.
export async function setTenantTheme(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }
  // Mall-byte är ett plattformsbeslut (Zivar hjälper kunden) — salon_admin har inte
  // ens kontrollen i sin studio, men staketet ska sitta server-side också.
  if (!user.platformAdmin) return { error: 'Mallen byts av Corevo — hör av dig så hjälper vi dig.' }

  const theme = String(fd.get('theme') ?? '') as StorefrontTheme
  if (!isSelectableTheme(theme)) return { error: 'Mallen ingår inte i de 12 godkända handoff-mallarna.' }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev, theme }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('setTenantTheme.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, { action: 'tenant.theme', tenantId, actorId: user.id, meta: { theme } })
  return { success: 'Mall bytt. Publika sajten uppdaterad.' }
}
