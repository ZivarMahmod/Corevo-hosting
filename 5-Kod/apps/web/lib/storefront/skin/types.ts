// Template-skin resolver — shared types (Multi-bransch / template-skin engine).
//
// A "skin" is the fully-resolved presentation of one tenant on one template:
// the template's design tokens (→ CSS custom properties) plus every declared
// content slot resolved to the tenant's value (or the template default, or an
// honest `empty`). The resolver is split into PURE logic (tokens.ts / resolve.ts,
// unit-testable, no I/O) and a thin server loader (load-skin.ts) so the data shape
// stays decoupled from Supabase.
//
// Ground truth for the inputs is @corevo/db (Tables<'templates'> etc.). On prod
// today templates.tokens = {}, templates.sections = [], and template_slots /
// content_slots / media_assets are EMPTY, so every type here treats its source
// fields as optional and the resolver degrades to defaults/empty without throwing.

/**
 * A template's design tokens, parsed from `templates.tokens` (jsonb).
 * Plan shape is `{ color?, font?, layout? }`, each a flat map of string values
 * (e.g. `color.bg`, `font.heading`, `layout.radius`). The column is `{}` today,
 * so every group is optional and only string leaves are kept (parseTokens drops
 * the rest). This maps 1:1 onto the `--sf-*` CSS custom properties (see tokens.ts).
 */
export type TemplateTokens = {
  color?: Record<string, string>
  font?: Record<string, string>
  layout?: Record<string, string>
}

/**
 * One declared slot resolved for a tenant. Discriminated on `kind`:
 *  - `text`   — a copy slot. `value` is the raw resolved value (tenant text_value
 *               jsonb, or the template default_text); `text` is that coerced to a
 *               plain string when it is a string or a `{ sv: string }`-like object,
 *               else null (render-on-present).
 *  - `asset`  — a media slot. `assetId` points at media_assets.id (null when the
 *               slot falls back to a default_asset_key with no row); url/alt/dims
 *               come from the resolved media_assets row (null when unresolved).
 *  - `module` — an embedded module slot. `moduleRef` is the raw module reference
 *               (content_slots.module_ref jsonb) passed through untouched.
 *  - `empty`  — the slot is declared but the tenant gave no value AND the template
 *               carries no usable default (render nothing / a placeholder).
 */
export type ResolvedSlot =
  | { kind: 'text'; slotKey: string; value: unknown; text: string | null }
  | {
      kind: 'asset'
      slotKey: string
      assetId: string | null
      url: string | null
      alt: string | null
      width: number | null
      height: number | null
      defaultAssetKey: string | null
    }
  | { kind: 'module'; slotKey: string; moduleRef: unknown }
  | { kind: 'empty'; slotKey: string }

/** A template section with its slots in template_slots.sort_order. */
export type ResolvedSection = {
  sectionKey: string
  slots: ResolvedSlot[]
}

/**
 * The fully-resolved skin for one tenant on one template.
 *  - `tokens`   — parsed TemplateTokens (`{}` when templates.tokens is empty).
 *  - `cssVars`  — `tokens` flattened to `--sf-*` custom properties (`{}` when empty).
 *  - `slots`    — every declared slot keyed by slot_key.
 *  - `sections` — slots grouped by section_key, sections + slots ordered by
 *                 the declaring template_slots.sort_order.
 *  - `hasTenantContent` — true iff the tenant has authored ≥1 content_slot for
 *                 this template. CRITICAL for the storefront wiring (goal-47):
 *                 `sections`/`slots` are populated from TEMPLATE DEFAULTS even
 *                 when the tenant authored nothing, so `sections.length > 0` is
 *                 NOT a safe "render from DB" signal (salvia ships 19 template
 *                 slots). The storefront flips to DB-render only when the tenant
 *                 actually authored content — this flag is that gate.
 * Empty inputs (today's prod reality) yield empty tokens/cssVars/slots/sections
 * with hasTenantContent=false and no throw.
 */
export type ResolvedSkin = {
  templateKey: string
  tokens: TemplateTokens
  cssVars: Record<string, string>
  slots: Record<string, ResolvedSlot>
  sections: ResolvedSection[]
  hasTenantContent: boolean
}
