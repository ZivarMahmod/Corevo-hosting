// Template-bron option 1 — skin → layout overlay (PURE, no I/O).
//
// Bridges the DB skin (content_slots, resolved by resolveSkin) onto the EXISTING
// React theme layout WITHOUT a new renderer: each resolved slot value is written
// onto the tenant's copy/branding via the template manifest's tenantBinding, then
// the normal resolveThemeContent + <Layout> render it. So the super-admin visual
// hub's content_slot edits go live through the salon's real, hand-built design —
// zero design regression.
//
// Precedence: this overlay is applied OVER the tenant_settings copy/branding base,
// so content_slots WINS. It overrides ONLY slots the tenant actually AUTHORED
// (skin.authoredSlotKeys) — never a template default. (Driving off "value present"
// would be a landmine: a template default also resolves to a present value, so a
// future default_text on a salvia slot would clobber the tenant's tenant_settings on
// every un-edited slot. Salvia avoids that only because 0040 nulled its defaults;
// the authored-key gate removes the dependence on that accident.) A present-value
// guard still applies so a dangling asset (url=null) never blanks a working image.

import type { ResolvedSkin } from './types'
import type { RegionManifest } from '@/lib/sajtbyggare/manifest/types'

/**
 * Fold a resolved skin onto base copy/branding using the manifest's region bindings.
 * Returns NEW copy/branding objects (inputs untouched). Regions with no matching
 * resolved slot (e.g. the manifest's color/font regions, which are tokens/branding,
 * not template_slots) are skipped. Array-valued branding fields (hero_images) write
 * at the binding's `index`.
 */
export function applySkinOverlay(
  skin: ResolvedSkin,
  manifest: RegionManifest,
  baseCopy: Record<string, unknown> | null | undefined,
  baseBranding: Record<string, unknown> | null | undefined,
): { copy: Record<string, unknown>; branding: Record<string, unknown> } {
  const copy: Record<string, unknown> = { ...(baseCopy ?? {}) }
  const branding: Record<string, unknown> = { ...(baseBranding ?? {}) }
  const authored = new Set(skin.authoredSlotKeys)

  for (const region of manifest.regions) {
    // Provenance gate: only the tenant's OWN authored slots win over tenant_settings,
    // never a template default (which also resolves to a present value). See types.ts.
    if (!authored.has(region.key)) continue
    const slot = skin.slots[region.key]
    if (!slot) continue
    const binding = region.tenantBinding

    if (slot.kind === 'text' && slot.text != null && binding.store === 'copy') {
      copy[binding.field] = slot.text
    } else if (slot.kind === 'asset' && slot.url != null && binding.store === 'branding') {
      if (typeof binding.index === 'number') {
        const cur = branding[binding.field]
        const arr = Array.isArray(cur) ? [...cur] : []
        arr[binding.index] = slot.url
        branding[binding.field] = arr
      } else {
        branding[binding.field] = slot.url
      }
    }
  }

  return { copy, branding }
}
