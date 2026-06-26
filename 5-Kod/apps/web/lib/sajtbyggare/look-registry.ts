// goal-51 — look-registry: THE BOX, reset to BASELINE (empty).
//
// A look = a render-bron template (väg A): full vendor HTML + its RegionManifest +
// a <corevo-module type="booking"> weave slot. The onboarding gallery, the live
// preview and the public storefront all dispatch off THIS list.
//
// BASELINE RESET (goal-51): the 13 imported vendor looks were SCRAPPED (foreign static
// sites that never merged with Corevo's tokens/modules/live-edit). LOOKS is now empty;
// goal-52 rebuilds the original 5 as NATIVE section-kit + look-as-config. The engine
// (render-bridge/marker/resolve/manifest/sanitize) is PARKED, not deleted — it is the
// substrate goal-52 builds on. getLook/lookMetaList stay so every consumer (gallery,
// preview, storefront dispatch) degrades to a clean empty state instead of breaking.

import type { RegionManifest } from './manifest/types'

export type LookEntry = {
  /** stable id = manifest.templateKey; the value stored per tenant + dispatched on. */
  key: string
  /** human-facing label in the gallery. */
  name: string
  /** free-text vibe chips (display only; NOT a bransch filter). */
  vibeTags: string[]
  /** a served asset path used as the gallery thumbnail (the look's own hero image). */
  thumbnail: string
  /** the render-bron page HTML (väg A). Server-only — never send to the client. */
  html: string
  /** the look's vendor stylesheet hrefs (served from public/sajtbyggare/<key>/css/). */
  cssHrefs: readonly string[]
  /** the editable-region manifest (text/image/color/font/logo bindings). */
  manifest: RegionManifest
  /** the <corevo-module pos> the template mounts (derived from the HTML, not duped). */
  bookingPos: string
}

/** Lightweight, client-safe projection of a look (no html). The gallery uses this. */
export type LookMeta = Pick<LookEntry, 'key' | 'name' | 'vibeTags' | 'thumbnail'>

// ponytail: baseline — no looks registered. goal-52 appends native looks here.
export const LOOKS: LookEntry[] = []

const BY_KEY = new Map(LOOKS.map((l) => [l.key, l]))

/** Resolve a look by key. Unknown key (incl. a React theme like 'leander') → undefined. */
export function getLook(key: string): LookEntry | undefined {
  return BY_KEY.get(key)
}

/** Strip the box to client-safe meta (drops html/manifest) for passing to the gallery. */
export function lookMetaList(): LookMeta[] {
  return LOOKS.map(({ key, name, vibeTags, thumbnail }) => ({ key, name, vibeTags, thumbnail }))
}
