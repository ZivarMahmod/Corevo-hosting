// Feane template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `feane` storefront theme, with each
// region's Universal/theme default and the storage binding for a per-tenant override.
// Pure data; imported by the F2 resolver / proof test only — NOT by any rendered
// route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like klinik/drivin/restoran/carserv (and unlike salvia), feane has NO THEME_CONTENT
// entry — it is a raw vendor template imported as HTML. So the text/image defaults
// here are mirrored VERBATIM from the vendor source with their exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/feane.ts (FEANE_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/feane/css/style.css.
// Every value below is lifted, never invented.

import type { RegionManifest } from './types'

/**
 * Feane colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/feane/css/style.css. Keep in sync if those files change; the
 * vendor CSS is the canonical source.
 *
 * NOTE: feane's style.css declares NO `:root { --primary }` custom property (the
 * codemod's heuristic emits a #000000 fallback when none is found). The template's
 * load-bearing brand highlight is the gold `#ffbe33` — the colour style.css applies
 * to `.heading_container h2 span`, the `.btn1` / order buttons, links and accents
 * (20 occurrences). That is the faithful primary lift, so primary == accent == the
 * gold, mirroring carserv/klinik/drivin (accent resolves to primary where the theme
 * has no distinct accent token).
 */
const FEANE_TOKEN_DEFAULTS = {
  /** style.css brand gold (`.heading_container h2 span { color: #ffbe33 }`,
   *  `.btn1`/order-button `background-color: #ffbe33`, link/accent colour). */
  colorPrimary: '#ffbe33',
  /** style.css `body { background-color: #ffffff }`. The page background. */
  colorBg: '#ffffff',
  /** style.css `body { color: #0c0c0c }`. The body ink. */
  colorFg: '#0c0c0c',
  /** feane declares no distinct accent token; the resolved accent default = its
   *  primary (the gold `#ffbe33`), mirroring carserv/klinik/drivin. */
  colorAccent: '#ffbe33',
  /** style.css `body { font-family: "Open Sans", sans-serif }` (the Google Webfont
   *  loaded for body copy; the h1/h2 display font is 'Dancing Script'). The
   *  load-bearing token is the body family `Open Sans`. */
  fontBody: '"Open Sans", sans-serif',
} as const

/**
 * The editable regions for feane. Order is editorial (hero → section titles →
 * images → colour → font → logo); it carries no semantics. Region keys mirror
 * salvia/klinik/drivin/restoran/carserv's dotted-naming style.
 *
 * feane's sections use a single `<h2>` heading each (in `.heading_container`) with
 * NO eyebrow line, so — unlike carserv's `// … //` eyebrow/title pairs — each section
 * contributes only a `.title`. The text regions map to the headings that exist
 * verbatim in the vendor markup: hero `<h1>` (Fast Food Restaurant), the Our Menu
 * (food_section), About (We Are Feane), Book A Table (book_section) and the customers
 * (client_section) headings, plus the real About paragraph (about.copy). The repeated
 * food-card names + offer/testimonial body copy carry no manifest region (exactly as
 * carserv skipped its service-card names and team/testimonial body copy). The
 * Book-A-Table heading attached to the booking module is `booking.title`.
 *
 * All text defaults are the exact vendor strings from FEANE_PAGE_HTML
 * (templates/feane.ts). All image defaults are the exact vendor asset paths served
 * from public/sajtbyggare/feane/images/.
 */
export const FEANE_REGION_MANIFEST: RegionManifest = {
  templateKey: 'feane',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor slider first/active slide: <h1>Fast Food Restaurant</h1>).
    { key: 'hero.title', type: 'text', default: 'Fast Food Restaurant', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section headings that exist verbatim in the vendor markup (one <h2> per section).
    { key: 'menu.title', type: 'text', default: 'Our Menu', tenantBinding: { store: 'copy', field: 'menuTitle' } },
    { key: 'about.title', type: 'text', default: 'We Are Feane', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: "There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. All", tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'booking.title', type: 'text', default: 'Book A Table', tenantBinding: { store: 'copy', field: 'bookingTitle' } },
    { key: 'testimonial.title', type: 'text', default: 'What Says Our Customers', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero background (vendor: images/hero-bg.jpg) and the about image (images/about-img.png).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/feane/images/hero-bg.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/feane/images/about-img.png', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: FEANE_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: FEANE_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: FEANE_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: FEANE_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: FEANE_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
