'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { STOREFRONT_THEMES, type StorefrontTheme } from '@/lib/tenant-data'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Storefront-mall (settings.theme) — super-admin byter kundens mall från kundkortet.
// Merge, never clobber: settings är co-owned jsonb (copy/contact/booking/flags …), så vi
// läser prev och spread:ar `...prev` innan vi skriver theme. Nolla även `look`: en satt
// render-bron-look överrider temat i publika rendern, så ett mall-byte ska landa på temat.
export async function setTenantTheme(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }
  // Mall-byte är ett plattformsbeslut (Zivar hjälper kunden) — salon_admin har inte
  // ens kontrollen i sin studio, men staketet ska sitta server-side också.
  if (!user.platformAdmin) return { error: 'Mallen byts av Corevo — hör av dig så hjälper vi dig.' }

  const theme = String(fd.get('theme') ?? '') as StorefrontTheme
  if (!STOREFRONT_THEMES.includes(theme)) return { error: 'Okänd mall.' }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev, theme, look: null }

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
