// Super-admin visual hub — CLIENT-SAFE contract shared by the preview overlay
// (a 'use client' component) and the server actions behind it.
//
// CRITICAL (next build, not tsc): this file MUST stay free of `import 'server-only'`
// and of anything that transitively imports it (no @/lib/supabase/server, no
// @/lib/r2/upload, no @/lib/platform/guard). It carries ONLY plain types + pure
// helpers + string constants, so the client bundle can import it without dragging a
// server module across the boundary. The DB writes live in preview-admin.ts
// ('use server'); the client only ever calls those actions and speaks the
// postMessage protocol declared here.
//
// v1 scope: IMAGE slots (kind:'asset'). Text + module slots are surfaced read-only
// so the drawer can show the full slot inventory, but editing is image-only for now
// (full page-builder = later). The shapes already allow text/module so the later
// waves extend without a rename.

/** A template slot declaration + its current resolved value for ONE tenant — the
 *  unit the editor lists and (for assets) edits. Mirrors template_slots columns the
 *  UI needs plus the resolved value pulled through the skin resolver. Kept flat and
 *  serialisable (crosses the server-action boundary). */
export type PreviewSlot = {
  /** Stable id = template_slots.slot_key (unique per template). */
  slotKey: string
  /** template_slots.section_key — groups slots into sections in the drawer. */
  sectionKey: string
  /** template_slots.label — human label shown in the drawer. */
  label: string
  /** Editable slot kinds. v1 edits 'asset'; 'text'/'module' are shown read-only. */
  kind: 'text' | 'asset' | 'module'
  /** template_slots.aspect_hint (e.g. '16:9') — guides the image picker framing. */
  aspectHint: string | null
  /** template_slots.asset_role (e.g. 'hero','gallery') — descriptive only. */
  assetRole: string | null
  /** sort_order, ascending — drawer ordering. */
  sortOrder: number
  /** Whether the tenant has an explicit content_slots row (vs. template default). */
  hasOverride: boolean
  /** Resolved current value for display:
   *   - asset: the live image URL (tenant override OR null when on a bare default)
   *   - text:  the resolved string (or null)
   *   - module: null (no preview thumbnail) */
  currentUrl: string | null
  currentText: string | null
  /** media_assets.id currently bound (asset slots only); null otherwise. */
  currentAssetId: string | null
}

/** One uploaded/owned image in a tenant's media library — the asset picker grid. */
export type PreviewAsset = {
  id: string
  url: string
  alt: string | null
  width: number | null
  height: number | null
  /** ISO timestamp, newest-first ordering in the picker. */
  createdAt: string
}

/** Result of a slot save (image swap). `ok:false` carries a Swedish reason for the
 *  drawer. On success the new image URL is returned so the drawer can optimistically
 *  reflect it while the iframe reloads. */
export type SlotSaveResult =
  | { ok: true; slotKey: string; url: string; assetId: string }
  | { ok: false; error: string }

/** Result of a text-slot save (or clear → revert to template default). */
export type TextSaveResult =
  | { ok: true; slotKey: string; text: string }
  | { ok: false; error: string }

/** Client-side length guard for a text slot (server re-checks). */
export const PREVIEW_TEXT_MAX = 5000

/** Result of listing a tenant's editable slots for the active template. */
export type SlotListResult =
  | { ok: true; templateKey: string; slots: PreviewSlot[] }
  | { ok: false; error: string }

/** Result of listing a tenant's media library (asset picker). */
export type AssetListResult =
  | { ok: true; assets: PreviewAsset[] }
  | { ok: false; error: string }

// ── postMessage protocol (storefront iframe ⇄ super-admin overlay) ───────────────
// The preview shows the tenant's REAL storefront in an <iframe>. When the storefront
// is later instrumented to mark slot-bearing elements, it will postMessage a
// SlotClickMessage to the parent so the overlay can open the right slot. Until the
// storefront emits these (it does not yet — render of slots is a follow-up wave),
// the overlay falls back to the slot LIST in the drawer. Defining the protocol now
// means the storefront side and this side agree without a later rename.

/** Message namespace — every message we own carries this `source` so we ignore the
 *  storefront's own / third-party postMessages safely. */
export const PREVIEW_MESSAGE_SOURCE = 'corevo-preview' as const

/** Storefront → parent: a slot-bearing element was clicked in edit mode. */
export type SlotClickMessage = {
  source: typeof PREVIEW_MESSAGE_SOURCE
  type: 'slot-click'
  slotKey: string
}

/** Parent → storefront: toggle the storefront's in-page edit affordances (outline
 *  slot elements, intercept clicks). Sent on edit-mode enter/exit. The storefront
 *  may ignore it until instrumented — harmless. */
export type EditModeMessage = {
  source: typeof PREVIEW_MESSAGE_SOURCE
  type: 'edit-mode'
  enabled: boolean
}

/** Parent → storefront: a slot's image changed; re-fetch / soft-refresh if able.
 *  (We also hard-reload the iframe as the reliable fallback.) */
export type SlotUpdatedMessage = {
  source: typeof PREVIEW_MESSAGE_SOURCE
  type: 'slot-updated'
  slotKey: string
}

export type PreviewInboundMessage = SlotClickMessage
export type PreviewOutboundMessage = EditModeMessage | SlotUpdatedMessage

/** Narrow an untrusted `MessageEvent.data` to one of OUR inbound messages. Anything
 *  without our `source` tag (the storefront's own analytics, embeds, extensions) is
 *  rejected — never trust a raw cross-origin message. */
export function parseInboundMessage(data: unknown): PreviewInboundMessage | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.source !== PREVIEW_MESSAGE_SOURCE) return null
  if (m.type === 'slot-click' && typeof m.slotKey === 'string') {
    return { source: PREVIEW_MESSAGE_SOURCE, type: 'slot-click', slotKey: m.slotKey }
  }
  return null
}

/** Allowed upload mime types (mirrors lib/r2/upload.ts EXT) — used by the file input
 *  `accept` and a fast client-side guard before the upload round-trips. */
export const PREVIEW_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'

/** Client-side size guard (matches the server's 2 MB cap) so an oversized file is
 *  rejected before upload. The server re-checks — this is just a fast fail. */
export const PREVIEW_IMAGE_MAX_BYTES = 2 * 1024 * 1024
