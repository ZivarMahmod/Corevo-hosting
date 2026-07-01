// Server loader for the S1 marked render (F3) — the IO sibling of the pure
// resolver. Fetches the cascade inputs for one tenant:
//   Bransch — site_content_vertical_defaults (0038) for the tenant's vertical+template
//   Kund    — tenant_settings.settings.copy (text) + tenant_settings.branding (column)
// picks the template's region-manifest (F1), and resolves via resolveSiteContent.
// Mirrors the lib/storefront/skin load-skin/resolve split (IO here, pure there).
//
// Reads via the anon public client (the storefront resolves content as anon) and
// scopes every query by the resolved tenant id app-side — RLS does NOT isolate
// anon (see lib/tenant-data.ts).

import { createPublicClient } from '@/lib/supabase/public'
import { SALVIA_REGION_MANIFEST } from './manifest/salvia'
import { LEANDER_REGION_MANIFEST } from './manifest/leander'
import { ZIGGE_REGION_MANIFEST } from './manifest/zigge'
import { LINNEA_REGION_MANIFEST } from './manifest/linnea'
import { EDIT_REGION_MANIFEST } from './manifest/edit'
import type { RegionManifest } from './manifest/types'
import { resolveSiteContent, type CascadeInput, type ResolvedRegion } from './resolve'

/** Template-key → region manifest. All five storefront themes carry a manifest;
 *  an unknown template key → loadSiteContent returns null. */
const MANIFESTS: Record<string, RegionManifest> = {
  [SALVIA_REGION_MANIFEST.templateKey]: SALVIA_REGION_MANIFEST,
  [LEANDER_REGION_MANIFEST.templateKey]: LEANDER_REGION_MANIFEST,
  [ZIGGE_REGION_MANIFEST.templateKey]: ZIGGE_REGION_MANIFEST,
  [LINNEA_REGION_MANIFEST.templateKey]: LINNEA_REGION_MANIFEST,
  [EDIT_REGION_MANIFEST.templateKey]: EDIT_REGION_MANIFEST,
}

export type LoadedSiteContent = {
  slug: string
  templateKey: string
  verticalId: string | null
  regions: ResolvedRegion[]
}

/**
 * Resolve a tenant's editable regions through the Universal→Bransch→Kund cascade.
 * Returns null when the tenant is unknown/inactive OR its template has no manifest
 * yet (S1 = salvia only) — the caller renders notFound().
 */
export async function loadSiteContent(slug: string): Promise<LoadedSiteContent | null> {
  const norm = slug.trim().toLowerCase()
  const supabase = createPublicClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, vertical_id')
    .eq('slug', norm)
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null

  const { data: settingsRow } = await supabase
    .from('tenant_settings')
    .select('settings, branding')
    .eq('tenant_id', tenant.id) // app-layer scope (RLS does not isolate anon)
    .maybeSingle()

  const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const templateKey = typeof settings.theme === 'string' ? settings.theme : ''
  const manifest = MANIFESTS[templateKey]
  if (!manifest) return null // unknown/unset template → no editable regions

  const tenantCopy = (settings.copy ?? null) as Record<string, unknown> | null
  const tenantBranding = (settingsRow?.branding ?? null) as Record<string, unknown> | null

  // Bransch layer: vertical defaults for this vertical + template.
  const verticalDefaults: Record<string, string> = {}
  if (tenant.vertical_id) {
    const { data: rows } = await supabase
      .from('site_content_vertical_defaults')
      .select('region_key, value')
      .eq('vertical_id', tenant.vertical_id)
      .eq('template_key', templateKey)
    for (const row of rows ?? []) {
      if (typeof row.region_key === 'string' && typeof row.value === 'string') {
        verticalDefaults[row.region_key] = row.value
      }
    }
  }

  const input: CascadeInput = { verticalDefaults, tenantCopy, tenantBranding }
  return {
    slug: norm,
    templateKey,
    verticalId: tenant.vertical_id ?? null,
    regions: resolveSiteContent(manifest, input),
  }
}
