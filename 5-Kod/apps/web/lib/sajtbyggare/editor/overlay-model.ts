// Klick-overlay-modell (Sajtbyggare S2) — PURE, ingen React, ingen DOM.
//
// Hjärtat i det egna "klicka-på-elementet"-overlayt (INRIKTNING-modellen, GrapesJS
// förkastad): given en klickad nods `data-editable*`-attribut → vilken region; och en
// draft-karta (osparade region-värden) med immutabla operationer + härledning av
// effektivt värde och "modifierad"-status för previewen/badgen. Allt testbart utan
// jsdom; React-skalet (SiteEditor) och postMessage-bryggan konsumerar detta.

import type { RegionType } from '../manifest/types'
import type { ResolvedRegion } from '../resolve'
import type { SiteContentEdit } from '../site-content-edit'

const REGION_TYPES: ReadonlySet<string> = new Set(['text', 'image', 'color', 'font', 'logo'])

/** En region som overlayt kan öppna en editor för. */
export type RegionRef = { key: string; type: RegionType }

/**
 * Läs region-referensen ur en nods `data-editable` (key) + `data-editable-type`
 * (typ) — exakt S1:s marker-kontrakt (marker.ts/regionMarkerAttrs). Null om noden
 * inte är en redigerbar region eller typen är okänd → overlayt ignorerar klicket.
 */
export function regionRefFromAttrs(attrs: {
  editable?: string | null
  type?: string | null
}): RegionRef | null {
  const key = attrs.editable?.trim()
  const type = attrs.type?.trim()
  if (!key || !type || !REGION_TYPES.has(type)) return null
  return { key, type: type as RegionType }
}

/** Osparade region-redigeringar: regionKey → nytt värde (tom sträng = rensa override). */
export type Draft = Record<string, string>

/** Sätt ett draft-värde (immutabelt — returnerar ny karta). */
export function setDraftValue(draft: Draft, key: string, value: string): Draft {
  return { ...draft, [key]: value }
}

/** Rensa ett draft-värde tillbaka till sparat/inärvt (tar bort nyckeln ur draften). */
export function clearDraftValue(draft: Draft, key: string): Draft {
  if (!(key in draft)) return draft
  const next = { ...draft }
  delete next[key]
  return next
}

/** Drafta en explicit "rensa override" (skriv tom → resolver faller tillbaka). */
export function blankDraftValue(draft: Draft, key: string): Draft {
  return { ...draft, [key]: '' }
}

/** Draften som spar-vägens edit-lista (saveSiteContent). Bara faktiskt draftade nycklar. */
export function draftToEdits(draft: Draft): SiteContentEdit[] {
  return Object.entries(draft).map(([regionKey, value]) => ({ regionKey, value }))
}

/** Det värde previewen ska visa för en region: draft-override om draftad, annars det
 *  resolverade (sparat/Bransch/Universal) värdet. Draftat tomt → null (visa inärvt
 *  default via render-vägen, som resolveSiteContent gör). */
export function effectiveValue(region: ResolvedRegion, draft: Draft): string | null {
  if (region.key in draft) {
    const v = draft[region.key] ?? ''
    return v.trim() === '' ? null : v
  }
  return region.value
}

/** Visar editorn "modifierad"-badge? Draftad till icke-tomt → ja; draftad till tomt
 *  (rensad) → nej (= standard igen); ej draftad → spegla sparat provenance. */
export function isModified(region: ResolvedRegion, draft: Draft): boolean {
  if (region.key in draft) return (draft[region.key] ?? '').trim() !== ''
  return region.provenance === 'modifierad'
}

/** Finns det osparade ändringar alls? (driver "Spara"-knappens enabled-läge). */
export function hasUnsavedChanges(draft: Draft): boolean {
  return Object.keys(draft).length > 0
}
