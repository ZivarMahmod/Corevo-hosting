// Alotan template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `alotan` storefront theme (a
// Colorlib barber-shop look), with each region's Universal/theme default and the
// storage binding for a per-tenant override. Pure data; imported by the F2 resolver
// / proof test only — NOT by any rendered route yet (the surface is wired behind the
// SAJTBYGGARE_ENABLED flag).
//
// Like carserv/klinik/drivin/restoran (and unlike salvia), alotan has NO
// THEME_CONTENT entry — it is a raw vendor template imported as HTML. So the
// text/image defaults here are mirrored VERBATIM from the vendor source with their
// exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/alotan.ts (ALOTAN_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html (+ the
//                            appointment band folded from contact.html).
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/alotan/css/style.css
//                            (the `body` rule + the brand `#ff6d24` used across
//                            `.btn.btn-primary` / links). Every value is lifted,
//                            never invented.

import type { RegionManifest } from './types'

/**
 * Alotan colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/alotan/css/style.css. Keep in sync if those files change; the
 * vendor CSS is the canonical source.
 */
const ALOTAN_TOKEN_DEFAULTS = {
  /** style.css brand orange — `.btn.btn-primary`/`.btn-outline-primary`/link hovers
   *  all resolve to `#ff6d24` (e.g. `.btn.btn-primary` background, line ~581). The
   *  template defines no `--primary` custom prop; this is the load-bearing brand hue. */
  colorPrimary: '#ff6d24',
  /** style.css `body { background: #fff }`. The page background. */
  colorBg: '#fff',
  /** style.css `body { color: #999999 }`. The body ink. */
  colorFg: '#999999',
  /** Alotan declares NO distinct accent token; mirroring carserv/klinik/drivin
   *  (accent resolves to primary where the theme has none), the resolved accent
   *  default = its primary (`#ff6d24`). */
  colorAccent: '#ff6d24',
  /** style.css `body { font-family: "Roboto", arial, sans-serif }` (the Google
   *  Webfont the vendor loads). */
  fontBody: '"Roboto", arial, sans-serif',
} as const

/**
 * The editable regions for alotan. Order is editorial (section titles/copy → images
 * → colour → font → logo); it carries no semantics. Region keys mirror
 * salvia/carserv/klinik/drivin's dotted-naming style.
 *
 * NOTE: alotan's hero is a single banner IMAGE (banner_text_1.png) with no heading
 * text, so there is no hero.title — only hero.image. The Services slider repeats the
 * same three slide titles (Haircuting / Beard Shaving / Cream & Shampoo) many times;
 * those duplicate carousel slides carry NO manifest region (junk dropped). The
 * `services.*` regions map to the Services section's lead (`Services` + its copy);
 * `features.*` to the Barber Features block; `about.*` to the "Good Looking Style"
 * section (its heading + first body paragraph + its image). `booking.title` is the
 * appointment band heading (`Appoint a Haircut Today and Get 25% discount`, the h2
 * attached to the booking module — the contact.html form was folded here).
 *
 * All text defaults are the exact vendor strings from ALOTAN_PAGE_HTML
 * (templates/alotan.ts). All image defaults are the exact vendor asset paths served
 * from public/sajtbyggare/alotan/images/.
 */
export const ALOTAN_REGION_MANIFEST: RegionManifest = {
  templateKey: 'alotan',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    { key: 'services.title', type: 'text', default: 'Services', tenantBinding: { store: 'copy', field: 'servicesTitle' } },
    { key: 'services.copy', type: 'text', default: 'Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.', tenantBinding: { store: 'copy', field: 'servicesCopy' } },
    { key: 'features.title', type: 'text', default: 'Barber Features', tenantBinding: { store: 'copy', field: 'featuresTitle' } },
    { key: 'features.copy', type: 'text', default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Earum magnam illum maiores adipisci pariatur, eveniet.', tenantBinding: { store: 'copy', field: 'featuresCopy' } },
    { key: 'booking.title', type: 'text', default: 'Appoint a Haircut Today and Get 25% discount', tenantBinding: { store: 'copy', field: 'bookingTitle' } },
    { key: 'about.title', type: 'text', default: 'Good Looking Style', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quam facere a excepturi quod impedit rerum ipsum totam incidunt, necessitatibus id veritatis maiores quos saepe dolore commodi magnam fugiat. Incidunt, omnis.', tenantBinding: { store: 'copy', field: 'aboutCopy' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/alotan/images/banner_text_1.png', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/alotan/images/img_5.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: ALOTAN_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: ALOTAN_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: ALOTAN_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: ALOTAN_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: ALOTAN_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
