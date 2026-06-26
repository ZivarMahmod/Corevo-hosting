'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { uploadImage, uploadErrorMessage, pruneRemovedImages } from '@/lib/r2/upload'
import { mergeBranding } from '@/lib/branding/merge'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { TenantBranding } from '@corevo/ui'
import { type ActionState, GENERIC, HEX_RE } from './shared'

// ── Step 2: branding (platform edits a chosen tenant) ───────────────────────────
function hexOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  return HEX_RE.test(v) ? v : undefined
}

export async function savePlatformBranding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }

  const colorPrimary = hexOrNull(fd.get('color_primary'))
  const colorBg = hexOrNull(fd.get('color_bg'))
  const colorFg = hexOrNull(fd.get('color_fg'))
  if (colorPrimary === undefined || colorBg === undefined || colorFg === undefined)
    return { error: 'Ogiltig färgkod. Använd hex, t.ex. #1f6feb.' }
  const fontBody = String(fd.get('font_body') ?? '').trim().slice(0, 120)
  const removeLogo = String(fd.get('remove_logo') ?? '') === 'true'
  const logo = fd.get('logo')

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  // Read prev as the FULL branding shape (incl. owner storefront media + accent),
  // not M7's narrow Branding — mergeBranding must preserve every prev field.
  const prev = (existing?.branding ?? {}) as TenantBranding

  let logoUrl = prev.logo_url ?? null
  let warning: string | null = null
  if (removeLogo) logoUrl = null
  if (logo instanceof File && logo.size > 0) {
    const res = await uploadImage(logo, `tenants/${tenantId}/branding`)
    if (res.ok) logoUrl = res.url
    else warning = uploadErrorMessage(res.reason)
  }

  // M7 owns ONLY colours/font/logo. Merge them onto prev so the owner's
  // hero/gallery/about/closing/team/stats AND color_accent are never clobbered
  // (the old fresh-object upsert wiped them). Patch keys are exactly these five.
  const branding = mergeBranding(prev, {
    color_primary: colorPrimary,
    color_bg: colorBg,
    color_fg: colorFg,
    font_body: fontBody || null,
    logo_url: logoUrl,
  })

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  // FX-14: drop the previous logo object when replaced/removed. Logo-only — a
  // platform branding-save must not touch owner storefront media, and now that the
  // DB clobber is gone `prev` keeps all media so it can never appear in this set.
  await pruneRemovedImages([prev.logo_url], [branding.logo_url])

  // CRITICAL: bust the cached public bundle so branding shows immediately (M2/M3).
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, { action: 'tenant.branding', tenantId, actorId: user.id })
  return warning ? { error: warning } : { success: 'Varumärke sparat. Publika sajten uppdaterad.' }
}
