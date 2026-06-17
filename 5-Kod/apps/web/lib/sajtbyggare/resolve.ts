// Override-kaskad + provenance (Sajtbyggare S1, F2) — PURE resolution logic.
//
// Resolves each editable region of a template through three layers, highest wins:
//
//   Kund (tenant)   — the tenant's own override (settings.copy / branding).  ← modifierad
//   Bransch (vertical) — the tenant's vertical default (0038 table).          ┐ standard
//   Universal (theme)  — the region-manifest default (theme/tokens).          ┘ (ärvt)
//
// `provenance` is the binary badge the editor shows: 'modifierad' when the value
// comes from a tenant override, else 'standard' (inherited). `source` additionally
// names WHICH layer supplied the value ('tenant' | 'vertical' | 'universal') so a
// caller can prove the full three-level cascade (a value can be inherited from the
// Bransch layer — source 'vertical', provenance 'standard' — distinct from the
// Universal default).
//
// PURE: takes already-fetched data (no Supabase import, no IO) so it is fully
// unit-testable; a thin server loader (F3) fetches the vertical defaults + tenant
// data and calls resolveSiteContent(). Mirrors the lib/storefront/skin split.

import type { Region, RegionManifest, TenantBinding } from './manifest/types'

/** The editor badge: inherited vs tenant-modified. */
export type Provenance = 'standard' | 'modifierad'

/** Which cascade layer supplied the resolved value. */
export type ContentSource = 'universal' | 'vertical' | 'tenant'

/** One region resolved through the cascade. `value` is the winning value (null
 *  only when no layer supplies one, e.g. an unset logo with no override). */
export type ResolvedRegion = {
  key: string
  type: Region['type']
  value: string | null
  source: ContentSource
  provenance: Provenance
}

/**
 * The already-fetched cascade inputs (all optional/empty-safe):
 *  - `verticalDefaults` — Bransch layer: `region_key → value` for the tenant's
 *    vertical + template (rows from site_content_vertical_defaults, 0038).
 *  - `tenantCopy`       — Kund layer: the tenant's `settings.copy` object
 *    (camelCase keys, e.g. heroTitle). Treated as `unknown` per field (frozen
 *    parseSettings does not validate it).
 *  - `tenantBranding`   — Kund layer: the tenant's `branding` column (snake_case
 *    keys: colours/font/logo + media arrays like hero_images).
 */
export type CascadeInput = {
  verticalDefaults: Record<string, string>
  tenantCopy: Record<string, unknown> | null | undefined
  tenantBranding: Record<string, unknown> | null | undefined
}

/** True for a usable override value: a non-empty (post-trim) string. Mirrors
 *  resolveTenantCopy's rule — a blank/whitespace value reverts to the inherited
 *  layer rather than rendering empty. Non-strings (null/number/array) are not
 *  usable scalar values. */
function usableString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Read a tenant override for a region via its manifest binding. Returns the
 * usable override string, or null when the tenant has not set it.
 *  - store 'copy'     → tenantCopy[field]
 *  - store 'branding' → tenantBranding[field], or tenantBranding[field][index]
 *                       for array fields (e.g. hero_images[0]).
 */
function readTenantOverride(binding: TenantBinding, input: CascadeInput): string | null {
  if (binding.store === 'copy') {
    const copy = input.tenantCopy ?? {}
    const v = copy[binding.field]
    return usableString(v) ? v : null
  }
  const branding = input.tenantBranding ?? {}
  const raw = branding[binding.field]
  const v = binding.index !== undefined ? (Array.isArray(raw) ? raw[binding.index] : undefined) : raw
  return usableString(v) ? v : null
}

/** Resolve a single region through Kund → Bransch → Universal. */
export function resolveRegion(region: Region, input: CascadeInput): ResolvedRegion {
  // Kund (tenant) override wins → modifierad.
  const tenant = readTenantOverride(region.tenantBinding, input)
  if (tenant !== null) {
    return { key: region.key, type: region.type, value: tenant, source: 'tenant', provenance: 'modifierad' }
  }

  // Bransch (vertical) default → inherited, but supplied by the vertical layer.
  const vertical = input.verticalDefaults[region.key]
  if (usableString(vertical)) {
    return { key: region.key, type: region.type, value: vertical, source: 'vertical', provenance: 'standard' }
  }

  // Universal (theme/manifest) default → inherited.
  return { key: region.key, type: region.type, value: region.default, source: 'universal', provenance: 'standard' }
}

/** Resolve every region in a manifest through the cascade, preserving order. */
export function resolveSiteContent(manifest: RegionManifest, input: CascadeInput): ResolvedRegion[] {
  return manifest.regions.map((region) => resolveRegion(region, input))
}
