// Site-content edit-applier (Sajtbyggare S2) — PURE, no I/O, no 'use server'.
//
// Tar en lista region-redigeringar från editorn + den nya tenantens befintliga
// `settings` / `branding`, SANERAR varje värde mot regionens typ (sanitize.ts), och
// bygger de NYA `settings`- och `branding`-objekten som spar-vägen sedan upsertar.
//
// Fail-closed (goal-37 Steg 6): okänd region ELLER misslyckad sanering → HELA
// resultatet avvisas ({ ok:false }), spar-vägen skriver INGET. Atomiskt: en dålig
// region får inte smyga in halva sparningen.
//
// Region-granulärt: varje edit skriver bara sin egen nyckel i copy/branding, så två
// admins som rör OLIKA regioner krockar inte. Samma region → sista-skrivningen-vinner
// (dokumenterad gräns, docs/sajtbyggare-editor.md). Tomt värde = rensa override →
// faller tillbaka till Bransch/Universal via resolveSiteContent.
//
// Återanvänder spar-semantiken från admin/actions.ts (settings.copy-merge +
// branding-merge) men förblir testbar utan Supabase.

import type { RegionManifest } from './manifest/types'
import { sanitizeRegionValue } from './sanitize'

/** En redigering: regionens manifest-nyckel + det nya (osanerade) värdet. */
export type SiteContentEdit = { regionKey: string; value: string }

export type ApplyResult =
  | { ok: true; settings: Record<string, unknown>; branding: Record<string, unknown> }
  | { ok: false; error: string }

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {}
}

/**
 * Bygg nästa `settings` + `branding` ur prev + sanerade redigeringar.
 *  - TEXT (store 'copy')     → settings.copy.<field>
 *  - övriga (store 'branding') → branding.<field> (eller branding.<field>[index])
 * Tomt värde rensar override (text→'', branding→null). Allt annat saneras; en region
 * som inte saneras rent → fail-closed.
 */
export function applySiteContentEdits(
  manifest: RegionManifest,
  prevSettings: Record<string, unknown> | null | undefined,
  prevBranding: Record<string, unknown> | null | undefined,
  edits: SiteContentEdit[],
): ApplyResult {
  const regionByKey = new Map(manifest.regions.map((r) => [r.key, r]))
  const settings = asRecord(prevSettings)
  const copy = asRecord(settings.copy)
  const branding = asRecord(prevBranding)

  for (const edit of edits) {
    const region = regionByKey.get(edit.regionKey)
    if (!region) return { ok: false, error: `Okänd region: ${edit.regionKey}` }
    const binding = region.tenantBinding
    const isClear = typeof edit.value === 'string' && edit.value.trim() === ''

    if (isClear) {
      // Rensa override → resolveSiteContent faller tillbaka till Bransch/Universal.
      if (binding.store === 'copy') {
        copy[binding.field] = ''
      } else if (binding.index !== undefined) {
        const arr = Array.isArray(branding[binding.field]) ? [...(branding[binding.field] as unknown[])] : []
        arr[binding.index] = null
        branding[binding.field] = arr
      } else {
        branding[binding.field] = null
      }
      continue
    }

    const san = sanitizeRegionValue(region.type, edit.value)
    if (!san.ok) return { ok: false, error: `Ogiltigt värde för ${edit.regionKey}: ${san.reason}` }

    if (binding.store === 'copy') {
      copy[binding.field] = san.value
    } else if (binding.index !== undefined) {
      const arr = Array.isArray(branding[binding.field]) ? [...(branding[binding.field] as unknown[])] : []
      arr[binding.index] = san.value
      branding[binding.field] = arr
    } else {
      branding[binding.field] = san.value
    }
  }

  settings.copy = copy
  return { ok: true, settings, branding }
}
