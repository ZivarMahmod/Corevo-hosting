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
// goal-36 — appended looks (frisör/barber first, then other verticals). Each is a
// VERIFIED 0-FAIL render-bron look (templates/<key>.proof.test.ts + independent verify).
import { HAIRCARE_PAGE_HTML, HAIRCARE_CSS_HREFS } from './templates/haircare'
import { HAIRSAL_PAGE_HTML, HAIRSAL_CSS_HREFS } from './templates/hairsal'
import { HAIRCUT_PAGE_HTML, HAIRCUT_CSS_HREFS } from './templates/haircut'
import { ALOTAN_PAGE_HTML, ALOTAN_CSS_HREFS } from './templates/alotan'
import { BARBERX_PAGE_HTML, BARBERX_CSS_HREFS } from './templates/barberx'
import { BARBERZ_PAGE_HTML, BARBERZ_CSS_HREFS } from './templates/barberz'
import { DENTCARE_PAGE_HTML, DENTCARE_CSS_HREFS } from './templates/dentcare'
import { KETO_PAGE_HTML, KETO_CSS_HREFS } from './templates/keto'
import { FEANE_PAGE_HTML, FEANE_CSS_HREFS } from './templates/feane'
import { HAIRCARE_REGION_MANIFEST } from './manifest/haircare'
import { HAIRSAL_REGION_MANIFEST } from './manifest/hairsal'
import { HAIRCUT_REGION_MANIFEST } from './manifest/haircut'
import { ALOTAN_REGION_MANIFEST } from './manifest/alotan'
import { BARBERX_REGION_MANIFEST } from './manifest/barberx'
import { BARBERZ_REGION_MANIFEST } from './manifest/barberz'
import { DENTCARE_REGION_MANIFEST } from './manifest/dentcare'
import { KETO_REGION_MANIFEST } from './manifest/keto'
import { FEANE_REGION_MANIFEST } from './manifest/feane'

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
  // ── frisör / barber (Corevos kärna — visas först) ──
  entry('Haircare', ['salong', 'varm', 'omsorg'], HAIRCARE_PAGE_HTML, HAIRCARE_CSS_HREFS, HAIRCARE_REGION_MANIFEST),
  entry('Hairsal', ['salong', 'klassisk'], HAIRSAL_PAGE_HTML, HAIRSAL_CSS_HREFS, HAIRSAL_REGION_MANIFEST),
  entry('Haircut', ['salong', 'klassisk', 'varm'], HAIRCUT_PAGE_HTML, HAIRCUT_CSS_HREFS, HAIRCUT_REGION_MANIFEST),
  entry('Alotan', ['salong', 'modern', 'stilren'], ALOTAN_PAGE_HTML, ALOTAN_CSS_HREFS, ALOTAN_REGION_MANIFEST),
  entry('BarberX', ['barber', 'mörk', 'tuff'], BARBERX_PAGE_HTML, BARBERX_CSS_HREFS, BARBERX_REGION_MANIFEST),
  entry('Barberz', ['barber', 'klassisk', 'vintage'], BARBERZ_PAGE_HTML, BARBERZ_CSS_HREFS, BARBERZ_REGION_MANIFEST),
  // ── övriga verticaler ──
  entry('Restoran', ['varm', 'mat', 'elegant'], RESTORAN_PAGE_HTML, RESTORAN_CSS_HREFS, RESTORAN_REGION_MANIFEST),
  entry('Klinik', ['ren', 'vård', 'lugn'], KLINIK_PAGE_HTML, KLINIK_CSS_HREFS, KLINIK_REGION_MANIFEST),
  entry('Drivin', ['modern', 'snabb', 'service'], DRIVIN_PAGE_HTML, DRIVIN_CSS_HREFS, DRIVIN_REGION_MANIFEST),
  entry('Carserv', ['bold', 'verkstad', 'teknik'], CARSERV_PAGE_HTML, CARSERV_CSS_HREFS, CARSERV_REGION_MANIFEST),
  entry('Dentcare', ['ren', 'vård', 'förtroende'], DENTCARE_PAGE_HTML, DENTCARE_CSS_HREFS, DENTCARE_REGION_MANIFEST),
  entry('Keto', ['fräsch', 'mat', 'hälsa'], KETO_PAGE_HTML, KETO_CSS_HREFS, KETO_REGION_MANIFEST),
  entry('Feane', ['mörk', 'restaurang', 'elegant'], FEANE_PAGE_HTML, FEANE_CSS_HREFS, FEANE_REGION_MANIFEST),
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
