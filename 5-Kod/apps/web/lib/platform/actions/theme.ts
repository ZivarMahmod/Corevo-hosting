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
import type { Json } from '@corevo/db'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Storefront-mall (settings.theme) — super-admin byter kundens mall från kundkortet.
// Merge, never clobber: settings är co-owned jsonb (copy/contact/booking/flags …).
// RPC:n CAS-kontrollerar det state som copy beräknades från och mergar bara theme/copy.
export async function setTenantTheme(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }
  // Mall-byte är ett plattformsbeslut (Zivar hjälper kunden) — salon_admin har inte
  // ens kontrollen i sin studio, men staketet ska sitta server-side också.
  if (!user.platformAdmin) return { error: 'Mallen byts av Corevo — hör av dig så hjälper vi dig.' }

  const theme = String(fd.get('theme') ?? '') as StorefrontTheme
  const copyMode = String(fd.get('copyMode') ?? '')
  if (copyMode !== 'keep' && copyMode !== 'template') {
    return { error: 'Välj om kundens nuvarande innehåll eller mallens innehåll ska användas.' }
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('slug, vertical_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (tenantError) {
    await reportActionError('setTenantTheme.tenant', tenantError, { tenantId })
    return { error: GENERIC }
  }
  if (!tenant) return { error: 'Okänd kund.' }
  if (!isSelectableTheme(theme) && !(tenant.slug === 'freshcut' && theme === 'freshcut')) {
    return { error: 'Mallen är inte tillgänglig för den här kunden.' }
  }

  const { data: existing, error: settingsError } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (settingsError) {
    await reportActionError('setTenantTheme.settings', settingsError, { tenantId })
    return { error: GENERIC }
  }
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

  const { error } = await supabase.rpc('switch_tenant_theme', {
    p_tenant: tenantId,
    p_expected_settings: prev as Json,
    p_expected_vertical: tenant.vertical_id,
    p_theme: theme,
    p_copy: copy as Json,
  })
  if (error) {
    if (error.code === '55000' && error.message.includes('site_theme_draft_exists')) {
      return { error: 'Kunden har ett opublicerat sidutkast. Publicera eller släng utkastet före mallbytet.' }
    }
    if (
      error.code === '40001'
      && (
        error.message.includes('site_theme_settings_conflict')
        || error.message.includes('site_theme_tenant_conflict')
      )
    ) {
      return { error: 'Kundens sidinställningar ändrades samtidigt. Ladda om och försök igen.' }
    }
    await reportActionError('setTenantTheme.atomic', error, { tenantId })
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
