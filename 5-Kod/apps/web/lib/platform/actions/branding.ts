'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { uploadImage, uploadErrorMessage, pruneRemovedImages } from '@/lib/r2/upload'
import { mergeBranding } from '@/lib/branding/merge'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { TenantBranding } from '@corevo/ui'
import { type ActionState, GENERIC, HEX_RE } from './shared'
import { reportActionError } from './observe'
import { recordMediaAsset } from './media-record'

// ── Step 2: branding (platform edits a chosen tenant) ───────────────────────────
function hexOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  return HEX_RE.test(v) ? v : undefined
}

export async function savePlatformBranding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const colorPrimary = hexOrNull(fd.get('color_primary'))
  const colorBg = hexOrNull(fd.get('color_bg'))
  const colorFg = hexOrNull(fd.get('color_fg'))
  const colorAccent = hexOrNull(fd.get('color_accent'))
  if (
    colorPrimary === undefined ||
    colorBg === undefined ||
    colorFg === undefined ||
    colorAccent === undefined
  )
    return { error: 'Ogiltig färgkod. Använd hex, t.ex. #1f6feb.' }
  const fontBody = String(fd.get('font_body') ?? '').trim().slice(0, 120)
  const fontDisplay = String(fd.get('font_display') ?? '').trim().slice(0, 120)
  const removeLogo = String(fd.get('remove_logo') ?? '') === 'true'
  const logo = fd.get('logo')

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

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
  let uploadedLogo: { file: File; url: string; key: string } | null = null
  if (logo instanceof File && logo.size > 0) {
    const res = await uploadImage(logo, `tenants/${tenantId}/branding`)
    if (res.ok) {
      logoUrl = res.url
      uploadedLogo = { file: logo, url: res.url, key: res.key }
    } else warning = uploadErrorMessage(res.reason)
  }

  // M7 owns ONLY colours (primary/bg/fg/accent) + font + logo. Merge them onto prev so
  // the owner's hero/gallery/about/closing/team/stats are never clobbered (the old
  // fresh-object upsert wiped them). accent = CTA-färg; null = falla tillbaka på default.
  const branding = mergeBranding(prev, {
    color_primary: colorPrimary,
    color_bg: colorBg,
    color_fg: colorFg,
    color_accent: colorAccent,
    font_body: fontBody || null,
    font_display: fontDisplay || null,
    logo_url: logoUrl,
  })

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('savePlatformBranding.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  // FX-14: drop the previous logo object when replaced/removed. Logo-only — a
  // platform branding-save must not touch owner storefront media, and now that the
  // DB clobber is gone `prev` keeps all media so it can never appear in this set.
  await pruneRemovedImages([prev.logo_url], [branding.logo_url])

  // A9: gör loggan synlig i kundens Bildbibliotek (best-effort, fäller aldrig save).
  if (uploadedLogo) {
    await recordMediaAsset(supabase, tenantId, uploadedLogo.file, uploadedLogo, 'branding')
  }

  // CRITICAL: bust the cached public bundle so branding shows immediately (M2/M3).
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, { action: 'tenant.branding', tenantId, actorId: user.id })
  return warning ? { error: warning } : { success: 'Varumärke sparat. Publika sajten uppdaterad.' }
}
