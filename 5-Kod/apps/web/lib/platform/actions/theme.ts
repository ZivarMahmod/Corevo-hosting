'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import {
  DEFAULT_STOREFRONT_THEME,
  STOREFRONT_THEMES,
  type StorefrontTheme,
} from '@/lib/tenant-data'
import { isSelectableTheme } from '@/lib/platform/theme-palettes'
import {
  cleanCopyOverride,
  layerCopy,
  materializeThemeCopy,
} from '@/components/storefront/theme-content'
import { getVerticalCopy } from '@/components/storefront/vertical-copy'
import { themeOwnsCopy } from '@/lib/platform/theme-capabilities'
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
  const copyMode = String(fd.get('copyMode') ?? '')
  if (copyMode !== 'keep' && copyMode !== 'template') {
    return { error: 'Välj om kundens nuvarande innehåll eller mallens innehåll ska användas.' }
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, vertical_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: draft, error: draftError } = await supabase
    .from('site_revisions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'draft')
    .maybeSingle()
  if (draftError) {
    await reportActionError('setTenantTheme.draft', draftError, { tenantId })
    return { error: GENERIC }
  }
  if (draft) {
    return { error: 'Kunden har ett opublicerat sidutkast. Publicera eller släng utkastet före mallbytet.' }
  }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const previousCopy = cleanCopyOverride(prev.copy)
  const currentTheme = STOREFRONT_THEMES.includes(prev.theme as StorefrontTheme)
    ? prev.theme as StorefrontTheme
    : DEFAULT_STOREFRONT_THEME
  const effectiveCopy = themeOwnsCopy(currentTheme)
    ? previousCopy
    : layerCopy(await getVerticalCopy(tenant.vertical_id ?? null), previousCopy)
  const copy = copyMode === 'keep'
    ? materializeThemeCopy(currentTheme, effectiveCopy)
    : {}
  const settings = { ...prev, theme, copy }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('setTenantTheme.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.theme',
    tenantId,
    actorId: user.id,
    meta: {
      theme,
      previous_theme: currentTheme,
      copy_mode: copyMode,
      previous_copy: previousCopy,
    },
  })
  return { success: 'Mall bytt. Publika sajten uppdaterad.' }
}
