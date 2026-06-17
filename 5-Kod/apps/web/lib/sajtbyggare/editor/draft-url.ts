// Draft ↔ URL-param (Sajtbyggare S2) — PURE. The editor encodes its unsaved draft
// into the preview iframe's query string; the server preview route decodes it and
// renders the REAL storefront with draft values merged in. Same-origin, no DB write.
//
// Robust by construction: a malformed / oversized param decodes to an EMPTY draft
// (preview falls back to saved values) rather than throwing. Only flat string→string
// entries survive — never objects/arrays/numbers (defence-in-depth before the value
// even reaches the sanitizer at save).

import type { Draft } from './overlay-model'

/** Query-param size cap (chars). Beyond this the draft is dropped (preview shows
 *  saved values) rather than risking an over-long URL. */
export const MAX_DRAFT_PARAM = 12000

export function encodeDraft(draft: Draft): string {
  return encodeURIComponent(JSON.stringify(draft))
}

export function decodeDraft(raw: string | null | undefined): Draft {
  if (!raw || raw.length > MAX_DRAFT_PARAM) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(decodeURIComponent(raw))
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: Draft = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}
