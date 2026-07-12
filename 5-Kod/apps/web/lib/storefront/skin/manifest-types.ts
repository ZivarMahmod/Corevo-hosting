// Region-manifest — the storefront skin DATA LAYER (no UI).
//
// A "region manifest" declares, for ONE fixed template, exactly WHICH parts of
// that template are editable by a tenant — and nothing else. Editable regions
// are DEFINED BY THE TEMPLATE: a tenant can only change a region's *value* (swap
// an image, rewrite a heading, retint a colour), never the layout.
//
// This module is PURE types: no React, no I/O, no DB calls, no flag check. It is
// the CONTRACT the skin overlay (./overlay) resolves against when it maps a DB
// skin (content_slots) onto a tenant's copy/branding — which puts it on the
// PUBLIC storefront's render path (app/(public)/page.tsx). Keeping it free of
// side effects is deliberate: it must stay cheap to import from a rendered route.

/** The kinds of region a template can expose as editable. Declares the region's
 *  editable kind (text field / image picker / colour / font / logo); it builds no
 *  controls of its own. */
export type RegionType = 'text' | 'image' | 'color' | 'font' | 'logo'

/**
 * WHERE a per-tenant override for a region is read/written. Machine-usable on
 * purpose: the manifest and the override resolver share this descriptor so the
 * two can never drift apart (e.g. a manifest key with no real storage path).
 *
 * Two stores exist (no schema of their own — they reuse what the tenant already
 * persists):
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
 *                      key the overlay and `data-editable` markers use.
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
