// Template-skin resolver — the core resolution logic. PURE: takes already-fetched
// DB rows as arguments (no Supabase import) so it is fully unit-testable. The
// server data-loader (load-skin.ts) fetches the rows and calls resolveSkin().
//
// Resolution rule per DECLARED template_slot (keyed by slot_key):
//   1. A matching content_slot (tenant value) exists → resolve from it. Its `kind`
//      wins. For assets, asset_id is looked up in media_assets for url/alt/dims
//      (url=null when the id has no matching row). text_value is coerced; module_ref
//      passes through untouched.
//   2. No content_slot → fall back to the template_slot defaults
//      (default_kind || kind, default_text, default_asset_key).
//   3. Neither yields a usable value → `{ kind: 'empty' }`.
// Robust to today's prod reality (all three tables empty) — empty inputs resolve to
// an empty skin with no throw.

import type { Tables } from '@corevo/db'
import type {
  ResolvedSection,
  ResolvedSkin,
  ResolvedSlot,
  TemplateTokens,
} from './types'
import { parseTokens, tokensToCssVars } from './tokens'

/** The slot kinds we know how to render. template_slots.kind is a free `string`
 *  in the schema, so we narrow defensively and treat anything else as 'text'. */
type SlotKind = 'text' | 'asset' | 'module'
function asSlotKind(raw: string | null | undefined): SlotKind {
  return raw === 'asset' || raw === 'module' ? raw : 'text'
}

/**
 * Coerce a slot's raw value (content_slots.text_value jsonb, or a template
 * default_text string) to a plain string for direct rendering.
 *  - a string                          → itself
 *  - a `{ sv: 'x' }`-like locale object → the `sv` string (first localised label)
 *  - anything else (number/array/null)  → null (render-on-present)
 * Returns null rather than coercing non-strings so a stray value never renders.
 */
function coerceText(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sv = (value as Record<string, unknown>).sv
    if (typeof sv === 'string') return sv
  }
  return null
}

/** Resolve a single text slot from an already-chosen raw value. */
function resolveText(slotKey: string, value: unknown): ResolvedSlot {
  return { kind: 'text', slotKey, value, text: coerceText(value) }
}

/**
 * Resolve a single asset slot. `assetId` is the chosen media_assets.id (or null
 * when falling back to a bare default_asset_key with no concrete row). The asset
 * map is keyed by media_assets.id; a miss yields url/alt/dims = null so a dangling
 * id degrades gracefully instead of throwing.
 */
function resolveAsset(
  slotKey: string,
  assetId: string | null,
  defaultAssetKey: string | null,
  assetById: Map<string, Tables<'media_assets'>>,
): ResolvedSlot {
  const asset = assetId ? assetById.get(assetId) ?? null : null
  return {
    kind: 'asset',
    slotKey,
    assetId,
    url: asset ? asset.url : null,
    alt: asset ? asset.alt : null,
    width: asset ? asset.width : null,
    height: asset ? asset.height : null,
    defaultAssetKey,
  }
}

/**
 * Resolve every DECLARED template_slot for a tenant into a `slot_key → ResolvedSlot`
 * map. Tenant content_slots override the template defaults; an asset_id is resolved
 * against the supplied media_assets. Slots with neither a tenant value nor a usable
 * default resolve to `{ kind: 'empty' }`. Duplicate slot_key declarations keep the
 * last one seen (sort_order grouping happens in resolveSkin).
 */
export function resolveSlots(
  templateSlots: Tables<'template_slots'>[],
  contentSlots: Tables<'content_slots'>[],
  mediaAssets: Tables<'media_assets'>[],
): Record<string, ResolvedSlot> {
  // Index tenant values by slot_key and assets by id for O(1) lookup.
  const contentBySlot = new Map<string, Tables<'content_slots'>>()
  for (const c of contentSlots) contentBySlot.set(c.slot_key, c)
  const assetById = new Map<string, Tables<'media_assets'>>()
  for (const a of mediaAssets) assetById.set(a.id, a)

  const out: Record<string, ResolvedSlot> = {}

  for (const slot of templateSlots) {
    const slotKey = slot.slot_key
    const content = contentBySlot.get(slotKey)

    if (content) {
      // A tenant value exists — the content_slot's kind wins.
      const kind = asSlotKind(content.kind)
      if (kind === 'asset') {
        out[slotKey] = resolveAsset(
          slotKey,
          content.asset_id ?? null,
          slot.default_asset_key ?? null,
          assetById,
        )
      } else if (kind === 'module') {
        out[slotKey] = { kind: 'module', slotKey, moduleRef: content.module_ref ?? null }
      } else {
        out[slotKey] = resolveText(slotKey, content.text_value ?? null)
      }
      continue
    }

    // No tenant value → fall back to the template_slot's declared defaults.
    const kind = asSlotKind(slot.default_kind ?? slot.kind)
    if (kind === 'asset') {
      const defKey = slot.default_asset_key ?? null
      // A default asset is declared by KEY only (no concrete media_assets row to
      // resolve), so url/dims stay null but the key is surfaced for the renderer.
      out[slotKey] = defKey
        ? resolveAsset(slotKey, null, defKey, assetById)
        : { kind: 'empty', slotKey }
    } else if (kind === 'module') {
      // Modules have no template-level default ref → empty until a tenant sets one.
      out[slotKey] = slot.module_key
        ? { kind: 'module', slotKey, moduleRef: null }
        : { kind: 'empty', slotKey }
    } else {
      const defText = slot.default_text
      out[slotKey] =
        typeof defText === 'string' && defText.length > 0
          ? resolveText(slotKey, defText)
          : { kind: 'empty', slotKey }
    }
  }

  return out
}

/**
 * Group resolved slots into ordered sections using the declaring template_slots.
 * Sections appear in first-seen order (by ascending sort_order); slots within a
 * section are ordered by their template_slot.sort_order. Only declared slots that
 * actually resolved are included.
 */
function groupSections(
  templateSlots: Tables<'template_slots'>[],
  slots: Record<string, ResolvedSlot>,
): ResolvedSection[] {
  // Stable global order: ascending sort_order (ties keep input order).
  const ordered = [...templateSlots].sort((a, b) => a.sort_order - b.sort_order)
  const sections: ResolvedSection[] = []
  const bySection = new Map<string, ResolvedSection>()

  for (const slot of ordered) {
    const resolved = slots[slot.slot_key]
    if (!resolved) continue
    let section = bySection.get(slot.section_key)
    if (!section) {
      section = { sectionKey: slot.section_key, slots: [] }
      bySection.set(slot.section_key, section)
      sections.push(section)
    }
    section.slots.push(resolved)
  }

  return sections
}

/**
 * Resolve a full skin for one tenant on one template:
 *   tokens   ← parseTokens(template.tokens)
 *   cssVars  ← tokensToCssVars(tokens)
 *   slots    ← resolveSlots(...)
 *   sections ← slots grouped by section_key, ordered by sort_order
 * Empty inputs (today's prod reality) yield
 * `{ templateKey, tokens:{}, cssVars:{}, slots:{}, sections:[] }` without throwing.
 */
export function resolveSkin(
  template: Tables<'templates'>,
  templateSlots: Tables<'template_slots'>[],
  contentSlots: Tables<'content_slots'>[],
  mediaAssets: Tables<'media_assets'>[],
): ResolvedSkin {
  const tokens: TemplateTokens = parseTokens(template.tokens)
  const cssVars = tokensToCssVars(tokens)
  const slots = resolveSlots(templateSlots, contentSlots, mediaAssets)
  const sections = groupSections(templateSlots, slots)
  // ponytail: any authored content_slot counts as "tenant has content" — the
  // editor only writes content_slots for declared slots, so an orphan key here is
  // not a real case. Tighten to "resolved-from-content" only if that ever changes.
  const hasTenantContent = contentSlots.length > 0
  return { templateKey: template.key, tokens, cssVars, slots, sections, hasTenantContent }
}
