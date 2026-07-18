'use server'

import { revalidatePath } from 'next/cache'
import { revalidateTenantById } from '@/lib/admin/tenant'
import { uploadImage, uploadErrorMessage } from '@/lib/r2/upload'
import { siteRevisionCtx } from '../guard'
import { logPlatformAction, type PlatformAuditAction } from '../audit'
import { readSiteMap, sanitizeSiteSnapshot, siteSnapshotAsJson, type SiteSnapshot } from '../site-revisions'
import { reportActionError } from './observe'
import { recordMediaAsset } from './media-record'
import { GENERIC } from './shared'
import { geocodeAddress } from './geocode'
import { verifiedMapForAddress } from '@/lib/storefront/address-map'

export type SiteRevisionActionState = {
  error?: string
  success?: string
  conflict?: boolean
  revisionId?: string
  lockVersion?: number
  url?: string
  snapshot?: SiteSnapshot
}

/** Upload media for the draft editor without touching live branding. The R2 object
 * is registered in the tenant media library, then its URL only enters the revision
 * snapshot when the customer explicitly saves the draft. */
export async function uploadSiteDraftImage(fd: FormData): Promise<SiteRevisionActionState> {
  const { user, supabase, tenantId } = await siteRevisionCtx({
    tenantId: String(fd.get('tenantId') ?? ''),
  })
  if (!tenantId) return { error: GENERIC }
  const image = fd.get('image')
  if (!(image instanceof File) || image.size === 0) return { error: 'Välj en bild att ladda upp.' }

  const uploaded = await uploadImage(image, `tenants/${tenantId}/storefront-drafts`)
  if (!uploaded.ok) return { error: uploadErrorMessage(uploaded.reason) }

  await recordMediaAsset(supabase, tenantId, image, uploaded, 'sajtbyggare')
  await logPlatformAction(supabase, {
    action: 'tenant.site_draft_image_upload',
    tenantId,
    actorId: user.id,
    meta: { content_type: image.type, size_bytes: image.size },
  })
  return { success: 'Bilden är uppladdad till utkastet.', url: uploaded.url }
}

type RevisionResultRow = { revision_id: string; lock_version: number; snapshot?: unknown }
type RevisionError = { code?: string; message?: string }

function refreshEditors(tenantId: string): void {
  revalidatePath('/admin/sida')
  revalidatePath('/admin/sida/redigera')
  revalidatePath(`/salonger/${tenantId}`)
}

function mappedError(error: RevisionError): SiteRevisionActionState {
  if (error.code === '40001' || error.message?.includes('site_revision_conflict')) {
    return {
      error: 'Utkastet har ändrats i en annan session. Ladda om och försök igen.',
      conflict: true,
    }
  }
  if (error.code === '42501') return { error: 'Du saknar behörighet för den här sidan.' }
  if (error.code === 'P0002') return { error: 'Utkastet eller versionen kunde inte hittas.' }
  return { error: GENERIC }
}

function firstRow(data: RevisionResultRow[] | null): RevisionResultRow | null {
  return Array.isArray(data) && data.length > 0 ? data[0]! : null
}

async function snapshotWithCurrentMap(
  supabase: Awaited<ReturnType<typeof siteRevisionCtx>>['supabase'],
  tenantId: string,
  snapshot: SiteSnapshot,
): Promise<SiteSnapshot> {
  const address = snapshot.location.address
  if (!address) {
    return snapshot.settings.map === null
      ? snapshot
      : { ...snapshot, settings: { ...snapshot.settings, map: null } }
  }

  const [draftResult, locationResult, settingsResult] = await Promise.all([
    supabase
      .from('site_revisions')
      .select('snapshot')
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .maybeSingle(),
    supabase
      .from('locations')
      .select('address')
      .eq('tenant_id', tenantId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('tenant_settings')
      .select('settings')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ])

  const previousDraft = draftResult.data
    ? sanitizeSiteSnapshot(draftResult.data.snapshot)
    : null
  const reusableMap = previousDraft?.location.address === address
    && verifiedMapForAddress(previousDraft.settings.map, address)
    ? previousDraft.settings.map
    : null
  const liveAddress = String(locationResult.data?.address ?? '').trim() || null
  const liveSettings = settingsResult.data?.settings
  const rawLiveMap = liveSettings && typeof liveSettings === 'object' && !Array.isArray(liveSettings)
    ? readSiteMap((liveSettings as Record<string, unknown>).map)
    : null
  const liveMap = verifiedMapForAddress(rawLiveMap, address) ? rawLiveMap : null
  const geocoded = reusableMap || (liveAddress === address ? liveMap : null)
    ? null
    : await geocodeAddress(address)
  const map = reusableMap
    ?? (liveAddress === address ? liveMap : null)
    ?? (geocoded ? { ...geocoded, q: address } : null)

  return map === snapshot.settings.map
    ? snapshot
    : { ...snapshot, settings: { ...snapshot.settings, map } }
}

async function finishRevision(
  args: {
    tenantId: string
    actorId: string
    action: PlatformAuditAction
    data: RevisionResultRow[] | null
    supabase: Parameters<typeof logPlatformAction>[0]
    success: string
    bustPublicCache?: boolean
    resolvedSnapshot?: SiteSnapshot
  },
): Promise<SiteRevisionActionState> {
  const row = firstRow(args.data)
  if (!row) return { error: GENERIC }
  const snapshot = args.resolvedSnapshot
    ?? (row.snapshot === undefined ? undefined : sanitizeSiteSnapshot(row.snapshot))
  if (row.snapshot !== undefined && !snapshot) return { error: GENERIC }
  await logPlatformAction(args.supabase, {
    action: args.action,
    tenantId: args.tenantId,
    actorId: args.actorId,
    entityId: row.revision_id,
    meta: { lock_version: row.lock_version },
  })
  if (args.bustPublicCache) await revalidateTenantById(args.supabase, args.tenantId)
  refreshEditors(args.tenantId)
  return {
    success: args.success,
    revisionId: row.revision_id,
    lockVersion: row.lock_version,
    ...(snapshot ? { snapshot } : {}),
  }
}

export async function saveSiteDraft(input: {
  tenantId: string
  snapshot: SiteSnapshot
  expectedLockVersion?: number | null
}): Promise<SiteRevisionActionState> {
  const { user, supabase, tenantId } = await siteRevisionCtx(input)
  const cleanSnapshot = sanitizeSiteSnapshot(input.snapshot)
  if (!tenantId || !cleanSnapshot) return { error: GENERIC }
  const snapshot = await snapshotWithCurrentMap(supabase, tenantId, cleanSnapshot)
  const { data, error } = await supabase.rpc('save_site_draft', {
    p_tenant: tenantId,
    p_snapshot: siteSnapshotAsJson(snapshot),
    p_expected_lock_version: input.expectedLockVersion ?? undefined,
  })
  if (error) {
    await reportActionError('saveSiteDraft', error, { tenantId })
    return mappedError(error)
  }
  return finishRevision({
    tenantId, actorId: user.id, action: 'tenant.site_draft_save', data, supabase,
    success: 'Utkastet är sparat.', resolvedSnapshot: snapshot,
  })
}

export async function publishSiteDraft(input: {
  tenantId: string
  expectedLockVersion: number
}): Promise<SiteRevisionActionState> {
  const { user, supabase, tenantId } = await siteRevisionCtx(input)
  if (!tenantId || !Number.isSafeInteger(input.expectedLockVersion)) return { error: GENERIC }
  const { data, error } = await supabase.rpc('publish_site_draft', {
    p_tenant: tenantId,
    p_expected_lock_version: input.expectedLockVersion,
  })
  if (error) {
    await reportActionError('publishSiteDraft', error, { tenantId })
    return mappedError(error)
  }
  return finishRevision({
    tenantId, actorId: user.id, action: 'tenant.site_draft_publish', data, supabase,
    success: 'Sidan är publicerad.', bustPublicCache: true,
  })
}

export async function discardSiteDraft(input: {
  tenantId: string
  expectedLockVersion: number
}): Promise<SiteRevisionActionState> {
  const { user, supabase, tenantId } = await siteRevisionCtx(input)
  if (!tenantId || !Number.isSafeInteger(input.expectedLockVersion)) return { error: GENERIC }
  const { data, error } = await supabase.rpc('discard_site_draft', {
    p_tenant: tenantId,
    p_expected_lock_version: input.expectedLockVersion,
  })
  if (error) {
    await reportActionError('discardSiteDraft', error, { tenantId })
    return mappedError(error)
  }
  const revisionId = typeof data === 'string' ? data : null
  if (!revisionId) return { error: GENERIC }
  await logPlatformAction(supabase, {
    action: 'tenant.site_draft_discard', tenantId, actorId: user.id, entityId: revisionId,
  })
  refreshEditors(tenantId)
  return { success: 'Utkastet har kastats.', revisionId }
}

export async function restoreSiteRevision(input: {
  tenantId: string
  sourceRevisionId: string
  expectedLockVersion?: number | null
}): Promise<SiteRevisionActionState> {
  const { user, supabase, tenantId } = await siteRevisionCtx(input)
  if (!tenantId || !input.sourceRevisionId) return { error: GENERIC }
  const { data, error } = await supabase.rpc('restore_site_revision', {
    p_tenant: tenantId,
    p_source_revision_id: input.sourceRevisionId,
    p_expected_lock_version: input.expectedLockVersion ?? undefined,
  })
  if (error) {
    await reportActionError('restoreSiteRevision', error, { tenantId })
    return mappedError(error)
  }
  return finishRevision({
    tenantId, actorId: user.id, action: 'tenant.site_revision_restore', data, supabase,
    success: 'Versionen har återställts som utkast.',
  })
}
