// goal-50 — look-registry: THE BOX. ONE canonical list of the selectable looks.
//
// A look = a render-bron template (väg A): full vendor HTML + its RegionManifest +
// a <corevo-module type="booking"> weave slot. The onboarding gallery, the live
// preview and the public storefront all dispatch off THIS list — never tags.bransch
// (no bransch-lock) and never the 5 React themes (no privileged "tema" in the box).
//
// ADDITIVE: goal-36 converts more vendor templates → append an entry here. Nothing
// else changes (build-once-never-delete). Every entry is treated IDENTICALLY.
//
// SERVER/TEST module: it imports the full PAGE_HTML strings (~700 lines each). The
// CLIENT gallery must NOT import this — the server page strips each entry to its
// lightweight meta (lookMeta) and passes that down as props, so the HTML never
// ships to the browser (de-risk R6).

import { firstModuleMarker } from './_optimize/proof-kit'
import type { RegionManifest } from './manifest/types'
import { RESTORAN_PAGE_HTML, RESTORAN_CSS_HREFS } from './templates/restoran'
import { KLINIK_PAGE_HTML, KLINIK_CSS_HREFS } from './templates/klinik'
import { DRIVIN_PAGE_HTML, DRIVIN_CSS_HREFS } from './templates/drivin'
import { CARSERV_PAGE_HTML, CARSERV_CSS_HREFS } from './templates/carserv'
import { RESTORAN_REGION_MANIFEST } from './manifest/restoran'
import { KLINIK_REGION_MANIFEST } from './manifest/klinik'
import { DRIVIN_REGION_MANIFEST } from './manifest/drivin'
import { CARSERV_REGION_MANIFEST } from './manifest/carserv'

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

/** First image-region default = the look's representative thumbnail. */
function thumbOf(manifest: RegionManifest): string {
  return manifest.regions.find((r) => r.type === 'image' && r.default)?.default ?? ''
}

function entry(
  name: string,
  vibeTags: string[],
  html: string,
  cssHrefs: readonly string[],
  manifest: RegionManifest,
): LookEntry {
  return {
    key: manifest.templateKey,
    name,
    vibeTags,
    thumbnail: thumbOf(manifest),
    html,
    cssHrefs,
    manifest,
    bookingPos: firstModuleMarker(html)?.pos ?? '',
  }
}

// ponytail: HTML is inlined into the server bundle. Measured (goal-36 Task 4):
// 4 looks = ~123 KB raw (~25 KB gzip); ~20 booking-fit looks project to ~600 KB
// raw (~100 KB gzip) — far under the Worker 10 MiB gzip limit. So R6 (load HTML
// from R2/KV instead of the bundle) stays DEFERRED. Upgrade path if the catalogue
// grows past ~50 looks or the worker nears the limit: move PAGE_HTML to R2/KV and
// fetch per-request (the "compile/store, render later" pattern in the de-risk doc).
export const LOOKS: LookEntry[] = [
  entry('Restoran', ['varm', 'mat', 'elegant'], RESTORAN_PAGE_HTML, RESTORAN_CSS_HREFS, RESTORAN_REGION_MANIFEST),
  entry('Klinik', ['ren', 'vård', 'lugn'], KLINIK_PAGE_HTML, KLINIK_CSS_HREFS, KLINIK_REGION_MANIFEST),
  entry('Drivin', ['modern', 'snabb', 'service'], DRIVIN_PAGE_HTML, DRIVIN_CSS_HREFS, DRIVIN_REGION_MANIFEST),
  entry('Carserv', ['bold', 'verkstad', 'teknik'], CARSERV_PAGE_HTML, CARSERV_CSS_HREFS, CARSERV_REGION_MANIFEST),
]

const BY_KEY = new Map(LOOKS.map((l) => [l.key, l]))

/** Resolve a look by key. Unknown key (incl. a React theme like 'leander') → undefined. */
export function getLook(key: string): LookEntry | undefined {
  return BY_KEY.get(key)
}

/** Strip the box to client-safe meta (drops html/manifest) for passing to the gallery. */
export function lookMetaList(): LookMeta[] {
  return LOOKS.map(({ key, name, vibeTags, thumbnail }) => ({ key, name, vibeTags, thumbnail }))
}
