// Region-manifest — the Sajtbyggare S1 DATA LAYER (no UI).
//
// A "region manifest" declares, for ONE fixed template, exactly WHICH parts of
// that template are editable by a tenant — and nothing else. The locked
// sajtbyggare model is a *visual content editor*, not a page builder: editable
// regions are DEFINED BY THE TEMPLATE, the tenant can only change a region's
// value (swap an image, rewrite a heading, retint a colour), never the layout.
//
// This module is PURE types + data: no React, no I/O, no DB calls, no flag
// check. It is tree-shakeable and stays unused until a later slice (F3) wires a
// resolver + render onto it. Keeping it free of side effects is deliberate so
// the (F2) override resolver and the (S2) editor can both consume it cheaply.

/** The kinds of region a template can expose as editable. Drives which editor
 *  control S2 will eventually render (text field / image picker / colour / font
 *  / logo). S1 only declares them; it builds no controls. */
export type RegionType = 'text' | 'image' | 'color' | 'font' | 'logo'

/**
 * WHERE a per-tenant override for a region is read/written. Machine-usable on
 * purpose: the manifest and the F2 override resolver share this descriptor so
 * the two can never drift apart (e.g. a manifest key with no real storage path).
 *
 * Two stores exist today (no schema change — S1 reuses what M2/M6/M7 already
 * persist):
 *  - `copy`     → `tenant_settings.settings.copy.<field>` (owner editorial text;
 *                 `field` is a camelCase CopyOverride key, e.g. `heroTitle`).
 *  - `branding` → `tenant_settings.branding.<field>` (the `branding` JSONB
 *                 COLUMN — colours/font/logo AND the storefront media keys
 *                 `hero_images[]`/`about_image`/`closing_image`; `field` is the
 *                 snake_case key, e.g. `color_primary`, `hero_images`).
 *
 * `index` is set ONLY for array-valued branding fields (e.g. `hero_images[0]`).
 */
export type TenantBinding =
  | { store: 'copy'; field: string }
  | { store: 'branding'; field: string; index?: number }

/**
 * One editable region declared by a template.
 *  - `key`           — stable dotted identifier (e.g. `hero.title`). The contract
 *                      key S2's click-overlay and `data-editable` markers use.
 *  - `type`          — the region's editable kind (see RegionType).
 *  - `default`       — the Universal/theme default value (the value shown before
 *                      any tenant override). `null` when the template carries no
 *                      default for this region (e.g. an unset logo).
 *  - `tenantBinding` — where a tenant override is stored (see TenantBinding).
 */
export type Region = {
  key: string
  type: RegionType
  default: string | null
  tenantBinding: TenantBinding
}

/** A template's complete editable-region manifest. `templateKey` matches the
 *  StorefrontTheme / templates.key the regions belong to (e.g. `salvia`). */
export type RegionManifest = {
  templateKey: string
  regions: Region[]
}
