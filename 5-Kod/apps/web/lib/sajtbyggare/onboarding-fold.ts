// Onboarding draft-fold (Sajtbyggare S3 / goal-38) — PURE, ingen I/O.
//
// Onboardingeditorn (CreateTenantForm "Designa sidan") postar en JSON-draft
// (regionKey → värde) i dolt `site_content_draft`. createTenant FOLDAR den ovanpå
// bas-settings/branding (tema + accent + logo + tagline = bas) via den SANERANDE
// apply-kärnan → draften blir den nya tenantens Kund-overrides.
//
// Fail-open HÄR (men kärnan är fail-closed): en trasig/osäker/tom draft → bas
// oförändrad, blockerar ALDRIG tenant-skapande. Alla fem tema-manifest är wirade
// (okänt tema ignorerar draften). Samma sanering som S2-spar-vägen (gratis
// XSS-paritet på onboarding-input).

import { applySiteContentEdits } from './site-content-edit'
import type { RegionManifest } from './manifest/types'
import { SALVIA_REGION_MANIFEST } from './manifest/salvia'
import { LEANDER_REGION_MANIFEST } from './manifest/leander'
import { ZIGGE_REGION_MANIFEST } from './manifest/zigge'
import { LINNEA_REGION_MANIFEST } from './manifest/linnea'
import { EDIT_REGION_MANIFEST } from './manifest/edit'

/** Tema → region-manifest (samma register som load/save). Okänt tema → ingen fold. */
const MANIFESTS: Record<string, RegionManifest> = {
  salvia: SALVIA_REGION_MANIFEST,
  leander: LEANDER_REGION_MANIFEST,
  zigge: ZIGGE_REGION_MANIFEST,
  linnea: LINNEA_REGION_MANIFEST,
  edit: EDIT_REGION_MANIFEST,
}

export type FoldedContent = {
  settings: Record<string, unknown>
  branding: Record<string, unknown>
}

export function foldOnboardingDraft(
  theme: string,
  draftRaw: string,
  baseSettings: Record<string, unknown>,
  baseBranding: Record<string, unknown>,
): FoldedContent {
  const base: FoldedContent = { settings: baseSettings, branding: baseBranding }
  const manifest = MANIFESTS[theme]
  if (!manifest) return base // okänt tema → behåll bas (fail-open)

  let draftObj: Record<string, unknown> = {}
  try {
    const p: unknown = JSON.parse(draftRaw)
    if (p && typeof p === 'object' && !Array.isArray(p)) draftObj = p as Record<string, unknown>
  } catch {
    return base // malformat → behåll bas
  }

  const edits = Object.entries(draftObj)
    .filter(([, v]) => typeof v === 'string')
    .map(([regionKey, value]) => ({ regionKey, value: value as string }))
  if (edits.length === 0) return base

  const applied = applySiteContentEdits(manifest, baseSettings, baseBranding, edits)
  // !applied.ok = en region saneras inte rent → ignorera HELA draften (fail-open),
  // skapa kunden ändå med bas-värdena.
  return applied.ok ? { settings: applied.settings, branding: applied.branding } : base
}
