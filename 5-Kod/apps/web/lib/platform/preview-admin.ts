'use server'

// Super-admin visual hub — SERVER actions behind the TenantPreviewFrame overlay.
//
// This is the WRITE/READ half of the v1 slot editor: it lists a tenant's editable
// slots for the active template, lists the tenant's media library for the asset
// picker, and performs an image-slot SWAP (upload → media_assets → content_slots).
// All under platformCtx() — the authed cookie client carries the platform_admin JWT
// claim, so the cross-tenant reads/writes are admitted by RLS (same fence as
// tenant-modules-admin.ts). The client (preview-slots.ts consumers) only ever calls
// these; it never imports a server-only module, so the 'use client'/'server-only'
// boundary that breaks `next build` is respected.
//
// Reads reuse the PURE skin resolver (lib/storefront/skin) so "current value" here
// matches exactly what the storefront renders. Writes reuse lib/r2/upload.ts (the
// existing G07 logo-upload helper — NO new infra, NO new cost): same BUCKET binding,
// same R2_PUBLIC_BASE_URL, same 2 MB / mime guard.

import { revalidatePath } from 'next/cache'
import { platformCtx } from './guard'
import { logPlatformAction } from './audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { uploadImage, uploadErrorMessage, deleteByPublicUrl } from '@/lib/r2/upload'
import { resolveSlots } from '@/lib/storefront/skin/resolve'
import { STOREFRONT_THEMES, DEFAULT_STOREFRONT_THEME } from '@/lib/tenant-data'
import type { Tables } from '@corevo/db'
import type {
  PreviewSlot,
  PreviewAsset,
  SlotListResult,
  AssetListResult,
  SlotSaveResult,
  TextSaveResult,
} from './preview-slots'

const GENERIC = 'Något gick fel. Försök igen.'

/** The tenant's active template = settings.theme, fenced to the known catalog keys
 *  (which 1:1 match the templates table: salvia/leander/zigge/linnea/edit). Falls
 *  back to the platform default when unset/foreign so the editor always has a target.
 *  Accepts the raw `tenant_settings.settings` jsonb. */
export async function resolveTemplateKey(settings: unknown): Promise<string> {
  const s = (settings ?? {}) as Record<string, unknown>
  const raw = typeof s.theme === 'string' ? s.theme : ''
  return (STOREFRONT_THEMES as readonly string[]).includes(raw) ? raw : DEFAULT_STOREFRONT_THEME
}

/** Coerce a content_slots.text_value (jsonb) to a display string (string or {sv}). */
function coerceText(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sv = (value as Record<string, unknown>).sv
    if (typeof sv === 'string') return sv
  }
  return null
}

/**
 * List the editable slots for a tenant on its active template, with each slot's
 * CURRENT resolved value (so the drawer shows the live image/text). Declared slots
 * come from template_slots; tenant overrides + media come from content_slots /
 * media_assets. Reuses resolveSlots() so "current" matches the storefront exactly.
 *
 * Today's prod reality: template_slots is EMPTY → this returns an empty slot list
 * (ok:true, slots:[]). The drawer then shows the honest "inga slots än" state. As
 * soon as a template is seeded (Wave A mall-import), slots appear with no code change.
 */
export async function listTenantSlots(
  tenantId: string,
  templateKey: string,
): Promise<SlotListResult> {
  if (!tenantId || !templateKey) return { ok: false, error: 'Saknar salong eller mall.' }
  const { supabase } = await platformCtx()

  const [slotsRes, contentRes, assetsRes] = await Promise.all([
    supabase
      .from('template_slots')
      .select('*')
      .eq('template_key', templateKey)
      .order('sort_order', { ascending: true }),
    supabase
      .from('content_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('template_key', templateKey),
    supabase.from('media_assets').select('*').eq('tenant_id', tenantId),
  ])

  if (slotsRes.error) return { ok: false, error: GENERIC }

  const templateSlots = (slotsRes.data ?? []) as Tables<'template_slots'>[]
  const contentSlots = (contentRes.data ?? []) as Tables<'content_slots'>[]
  const mediaAssets = (assetsRes.data ?? []) as Tables<'media_assets'>[]

  const resolved = resolveSlots(templateSlots, contentSlots, mediaAssets)
  const overrideKeys = new Set(contentSlots.map((c) => c.slot_key))

  const slots: PreviewSlot[] = templateSlots.map((ts) => {
    const r = resolved[ts.slot_key]
    const kind: PreviewSlot['kind'] =
      ts.kind === 'asset' || ts.kind === 'module' ? ts.kind : 'text'
    return {
      slotKey: ts.slot_key,
      sectionKey: ts.section_key,
      label: ts.label,
      kind,
      aspectHint: ts.aspect_hint ?? null,
      assetRole: ts.asset_role ?? null,
      sortOrder: ts.sort_order,
      hasOverride: overrideKeys.has(ts.slot_key),
      currentUrl: r && r.kind === 'asset' ? r.url : null,
      currentText: r && r.kind === 'text' ? r.text : null,
      currentAssetId: r && r.kind === 'asset' ? r.assetId : null,
    }
  })

  return { ok: true, templateKey, slots }
}

/**
 * List a tenant's media library (newest first) for the asset picker. Scoped by
 * tenant_id (platform read; RLS admits it via platform_admin). Empty today.
 */
export async function listTenantAssets(tenantId: string): Promise<AssetListResult> {
  if (!tenantId) return { ok: false, error: 'Saknar salong.' }
  const { supabase } = await platformCtx()

  const { data, error } = await supabase
    .from('media_assets')
    .select('id, url, alt, width, height, created_at')
    .eq('tenant_id', tenantId)
    .eq('type', 'image')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { ok: false, error: GENERIC }

  const assets: PreviewAsset[] = (data ?? []).map((a) => ({
    id: a.id as string,
    url: a.url as string,
    alt: (a.alt as string | null) ?? null,
    width: (a.width as number | null) ?? null,
    height: (a.height as number | null) ?? null,
    createdAt: a.created_at as string,
  }))
  return { ok: true, assets }
}

/**
 * Upsert the content_slots row that points slot `slotKey` at `assetId` for this
 * tenant+template (image swap, no new upload). Shared by the upload path (after the
 * media_assets row exists) and the "pick existing" path. Best-effort prunes the
 * PREVIOUS asset's R2 object when it is replaced AND no longer referenced — but only
 * after the row commits, never blocking. Returns the bound asset's URL.
 */
async function bindAssetToSlot(
  supabase: Awaited<ReturnType<typeof platformCtx>>['supabase'],
  userId: string,
  tenantId: string,
  templateKey: string,
  slotKey: string,
  assetId: string,
): Promise<SlotSaveResult> {
  // Fence the asset to THIS tenant (never bind another tenant's media).
  const { data: asset, error: aErr } = await supabase
    .from('media_assets')
    .select('id, url, tenant_id')
    .eq('id', assetId)
    .maybeSingle()
  if (aErr) return { ok: false, error: GENERIC }
  if (!asset || asset.tenant_id !== tenantId) return { ok: false, error: 'Okänd bild.' }

  // Capture the previously-bound asset URL (for best-effort prune of an orphan).
  const { data: prev } = await supabase
    .from('content_slots')
    .select('asset_id')
    .eq('tenant_id', tenantId)
    .eq('template_key', templateKey)
    .eq('slot_key', slotKey)
    .maybeSingle()

  const { error: wErr } = await supabase.from('content_slots').upsert(
    {
      tenant_id: tenantId,
      template_key: templateKey,
      slot_key: slotKey,
      kind: 'asset',
      asset_id: assetId,
      text_value: null,
      module_ref: null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,template_key,slot_key' },
  )
  if (wErr) return { ok: false, error: GENERIC }

  // Best-effort orphan prune: if a DIFFERENT asset was bound before and is now
  // referenced nowhere, drop its R2 object. Never throws, never blocks the save.
  const prevAssetId = (prev?.asset_id as string | null) ?? null
  if (prevAssetId && prevAssetId !== assetId) {
    const { data: stillUsed } = await supabase
      .from('content_slots')
      .select('id')
      .eq('asset_id', prevAssetId)
      .limit(1)
    if (!stillUsed || stillUsed.length === 0) {
      const { data: oldAsset } = await supabase
        .from('media_assets')
        .select('url')
        .eq('id', prevAssetId)
        .maybeSingle()
      if (oldAsset?.url) await deleteByPublicUrl(oldAsset.url as string)
    }
  }

  return { ok: true, slotKey, url: asset.url as string, assetId }
}

/**
 * IMAGE SLOT SWAP — the v1 write. Two modes via form fields:
 *   - UPLOAD: a `file` is present → upload to R2 (lib/r2/upload), insert a
 *     media_assets row, then bind it to the slot.
 *   - PICK:   no file, an `assetId` is present → bind an existing library image.
 * Then revalidate the storefront (cache-bust) + the platform detail page.
 *
 * Form fields: tenantId, templateKey, slotKey, (file | assetId), alt?
 */
export async function saveImageSlot(fd: FormData): Promise<SlotSaveResult> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const templateKey = String(fd.get('templateKey') ?? '').trim()
  const slotKey = String(fd.get('slotKey') ?? '').trim()
  if (!tenantId || !templateKey || !slotKey) {
    return { ok: false, error: 'Saknar salong, mall eller slot.' }
  }
  if (!(STOREFRONT_THEMES as readonly string[]).includes(templateKey)) {
    return { ok: false, error: 'Okänd mall.' }
  }

  // Resolve slug up front (cache-bust target) and confirm the tenant exists.
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  if (tErr || !tenant) return { ok: false, error: GENERIC }

  // Confirm the slot is actually a declared ASSET slot of this template — never let
  // an arbitrary slot_key be written, and never point a text/module slot at an image.
  const { data: slot, error: sErr } = await supabase
    .from('template_slots')
    .select('slot_key, kind')
    .eq('template_key', templateKey)
    .eq('slot_key', slotKey)
    .maybeSingle()
  if (sErr) return { ok: false, error: GENERIC }
  if (!slot) return { ok: false, error: 'Slot finns inte i mallen.' }
  if (slot.kind !== 'asset') return { ok: false, error: 'Den här slotten är inte en bild-slot.' }

  const file = fd.get('file')
  const altRaw = fd.get('alt')
  const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : null

  let result: SlotSaveResult

  if (file instanceof File && file.size > 0) {
    // UPLOAD path. Key prefix groups a tenant's slot images under one folder.
    const up = await uploadImage(file, `tenant/${tenantId}/slots`)
    if (!up.ok) return { ok: false, error: uploadErrorMessage(up.reason) }

    // Record the asset. size_bytes feeds the (future) storage-billing meter; type
    // 'image' + source 'upload' match the column defaults/expectations.
    const { data: inserted, error: iErr } = await supabase
      .from('media_assets')
      .insert({
        tenant_id: tenantId,
        r2_key: up.key,
        url: up.url,
        type: 'image',
        alt,
        size_bytes: file.size,
        source: 'upload',
      })
      .select('id')
      .single()
    if (iErr || !inserted) {
      // The object is in R2 but the row failed — best-effort clean it up so we don't
      // leak an unreferenced object.
      await deleteByPublicUrl(up.url)
      return { ok: false, error: GENERIC }
    }
    result = await bindAssetToSlot(
      supabase,
      user.id,
      tenantId,
      templateKey,
      slotKey,
      inserted.id as string,
    )
  } else {
    // PICK path — bind an existing library asset.
    const assetId = String(fd.get('assetId') ?? '').trim()
    if (!assetId) return { ok: false, error: 'Välj en bild eller ladda upp en ny.' }
    result = await bindAssetToSlot(supabase, user.id, tenantId, templateKey, slotKey, assetId)
  }

  if (!result.ok) return result

  // Bust the per-tenant storefront cache (tenant:<slug>) so the live page + the
  // preview iframe show the new image, and refresh the platform detail page.
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)

  await logPlatformAction(supabase, {
    action: 'tenant.content_slot',
    tenantId,
    actorId: user.id,
    meta: { template_key: templateKey, slot_key: slotKey, asset_id: result.assetId },
  })

  return result
}

const PREVIEW_TEXT_MAX = 5000

/**
 * TEXT SLOT WRITE (v2). Upserts the content_slots row for a declared TEXT slot.
 *   - non-empty text → upsert text_value (a PLAIN string — the skin resolver's
 *     coerceText reads a bare string directly; see resolve.test.ts).
 *   - empty/whitespace → DELETE the override row → revert to the template default.
 * Form fields: tenantId, templateKey, slotKey, text
 */
export async function saveTextSlot(fd: FormData): Promise<TextSaveResult> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const templateKey = String(fd.get('templateKey') ?? '').trim()
  const slotKey = String(fd.get('slotKey') ?? '').trim()
  if (!tenantId || !templateKey || !slotKey) {
    return { ok: false, error: 'Saknar salong, mall eller slot.' }
  }
  if (!(STOREFRONT_THEMES as readonly string[]).includes(templateKey)) {
    return { ok: false, error: 'Okänd mall.' }
  }

  const raw = fd.get('text')
  const text = typeof raw === 'string' ? raw : ''
  if (text.length > PREVIEW_TEXT_MAX) {
    return { ok: false, error: `Texten är för lång (max ${PREVIEW_TEXT_MAX} tecken).` }
  }

  // Resolve slug (cache-bust target) + confirm the tenant exists.
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  if (tErr || !tenant) return { ok: false, error: GENERIC }

  // Fence: the slot must be a DECLARED TEXT slot of this template.
  const { data: slot, error: sErr } = await supabase
    .from('template_slots')
    .select('slot_key, kind')
    .eq('template_key', templateKey)
    .eq('slot_key', slotKey)
    .maybeSingle()
  if (sErr) return { ok: false, error: GENERIC }
  if (!slot) return { ok: false, error: 'Slot finns inte i mallen.' }
  if (slot.kind !== 'text') return { ok: false, error: 'Den här slotten är inte en text-slot.' }

  const trimmed = text.trim()

  if (trimmed.length === 0) {
    // Clear → revert to the template default (delete this tenant's override row).
    const { error: dErr } = await supabase
      .from('content_slots')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('template_key', templateKey)
      .eq('slot_key', slotKey)
    if (dErr) return { ok: false, error: GENERIC }
  } else {
    const { error: wErr } = await supabase.from('content_slots').upsert(
      {
        tenant_id: tenantId,
        template_key: templateKey,
        slot_key: slotKey,
        kind: 'text',
        text_value: trimmed,
        asset_id: null,
        module_ref: null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,template_key,slot_key' },
    )
    if (wErr) return { ok: false, error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)

  await logPlatformAction(supabase, {
    action: 'tenant.content_slot',
    tenantId,
    actorId: user.id,
    meta: { template_key: templateKey, slot_key: slotKey, kind: 'text' },
  })

  return { ok: true, slotKey, text: trimmed }
}
