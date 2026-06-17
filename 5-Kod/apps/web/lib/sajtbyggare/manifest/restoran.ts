// Restoran template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `restoran` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / F1 test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag
// in a later slice).
//
// Unlike salvia (whose defaults DRY-link to THEME_CONTENT.salvia), restoran has
// NO THEME_CONTENT entry — it is a raw vendor template imported as HTML. So the
// text/image defaults here are mirrored VERBATIM from the vendor source with
// their exact origin noted in a comment:
//   - text/image strings  → lib/sajtbyggare/templates/restoran.ts (RESTORAN_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/restoran/css/
//                            (style.css :root + bootstrap.min.css body rule).
// Every value below is lifted, never invented.

import type { RegionManifest } from './types'

/**
 * Restoran colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/restoran/css/. Keep in sync if those files change; the
 * vendor CSS is the canonical source.
 */
const RESTORAN_TOKEN_DEFAULTS = {
  /** style.css `:root { --primary: #FEA116 }` (= bootstrap.min.css `--bs-primary: #FEA116`). The orange brand highlight (`.text-primary`, `.btn-primary`). */
  colorPrimary: '#FEA116',
  /** bootstrap.min.css `body { background-color: #F1F8FF }` (= style.css `:root --light: #F1F8FF`). The page background. */
  colorBg: '#F1F8FF',
  /** bootstrap.min.css `body { color: #666565 }`. The body ink. */
  colorFg: '#666565',
  /** Restoran declares NO distinct accent token in the vendor CSS; mirroring
   *  salvia's scheme (accent resolves to primary where the theme has none), the
   *  resolved accent default = its primary (`--primary: #FEA116`). */
  colorAccent: '#FEA116',
  /** bootstrap.min.css `body { font-family: "Heebo", sans-serif }` (the Google
   *  Webfont the vendor loads). The load-bearing token is the family `Heebo`. */
  fontBody: "'Heebo', sans-serif",
} as const

/**
 * The editable regions for restoran. Order is editorial (hero → section eyebrows
 * → about → footer → images → colour → font → logo); it carries no semantics.
 * Region keys mirror salvia's dotted-naming style.
 *
 * NOTE: the vendor hero has only an h1 + lede (NO eyebrow), so there is no
 * `hero.eyebrow` here — it would be a fabricated value. The eyebrow regions map
 * to the section-title eyebrows that exist verbatim in the vendor markup.
 *
 * All text defaults are the exact vendor strings from RESTORAN_PAGE_HTML
 * (templates/restoran.ts). All image defaults are the exact vendor asset paths
 * served from public/sajtbyggare/restoran/img/.
 */
export const RESTORAN_REGION_MANIFEST: RegionManifest = {
  templateKey: 'restoran',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor: <h1>Enjoy Our<br>Delicious Meal</h1> + lede). The <br> is layout.
    { key: 'hero.title', type: 'text', default: 'Enjoy Our Delicious Meal', tenantBinding: { store: 'copy', field: 'heroTitle' } },
    { key: 'hero.lede', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet', tenantBinding: { store: 'copy', field: 'heroLede' } },

    // Section eyebrows + headings that exist verbatim in the vendor markup.
    { key: 'about.eyebrow', type: 'text', default: 'About Us', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.copy', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos erat ipsum et lorem et sit, sed stet lorem sit.', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'menu.eyebrow', type: 'text', default: 'Food Menu', tenantBinding: { store: 'copy', field: 'menuEyebrow' } },
    { key: 'menu.title', type: 'text', default: 'Most Popular Items', tenantBinding: { store: 'copy', field: 'menuTitle' } },
    { key: 'reservation.title', type: 'text', default: 'Book A Table Online', tenantBinding: { store: 'copy', field: 'reservationTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Team Members', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Our Master Chefs', tenantBinding: { store: 'copy', field: 'teamTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero image (vendor: img/hero.png) and the first about collage image (img/about-1.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/restoran/img/hero.png', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/restoran/img/about-1.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: RESTORAN_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: RESTORAN_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: RESTORAN_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: RESTORAN_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: RESTORAN_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
