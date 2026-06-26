// Hairsal template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `hairsal` storefront look, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like klinik/drivin/restoran/carserv (and unlike salvia), hairsal has NO
// THEME_CONTENT entry — it is a raw vendor template imported as HTML. So the
// text/image defaults here are mirrored VERBATIM from the vendor source:
//   - text/image strings  → lib/sajtbyggare/templates/hairsal.ts (HAIRSAL_PAGE_HTML),
//                            a faithful copy of the vendor index.html home page PLUS
//                            the booking <form> SECTION folded in from booking.html
//                            (the home page carries no inline booking form).
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/hairsal/css/
//                            (style.css `body` + bootstrap.min.css `.text-primary` /
//                            body / `:root --secondary`).
// Every value below is lifted, never invented (incl. the vendor typo "Stellla
// Martin" in the testimonial section).
//
// Source: Hairsal by Colorlib (https://colorlib.com), licensed CC BY 3.0
// (kräver-kredit: the footer Colorlib backlink is kept in HAIRSAL_PAGE_HTML).

import type { RegionManifest } from './types'

/**
 * Hairsal colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/hairsal/css/. Keep in sync if those files change; the vendor
 * CSS is the canonical source.
 */
const HAIRSAL_TOKEN_DEFAULTS = {
  /** bootstrap.min.css `.text-primary { color: #8bc34a }` (this colorlib build's
   *  customised Bootstrap primary; the green brand highlight on `.text-primary`,
   *  `.btn-primary`, `em.text-primary`). */
  colorPrimary: '#8bc34a',
  /** bootstrap.min.css `body { background-color: #fff }`. The page background
   *  (style.css's `body` rule sets no background, so the Bootstrap body rule wins).
   *  Exact 3-digit lowercase form the vendor body rule carries. */
  colorBg: '#fff',
  /** style.css `body { color: #4d4d4d }` (loaded last → overrides Bootstrap's
   *  `#212529`). The body ink. */
  colorFg: '#4d4d4d',
  /** Hairsal declares no distinct brand accent token; the only secondary/accent
   *  token in the vendor CSS is Bootstrap's `:root { --secondary: #6c757d }`, so
   *  the resolved accent default = that lifted value (never invented). */
  colorAccent: '#6c757d',
  /** bootstrap.min.css `body { font-family: "Poppins", ... }` (the Google Webfont
   *  the vendor loads for body copy; headings use "Display Playfair"). The
   *  load-bearing token is the body family `Poppins`. */
  fontBody: '"Poppins", sans-serif',
} as const

/**
 * The editable regions for hairsal. Order is editorial (hero → section
 * titles/copy → images → colour → font → logo); it carries no semantics.
 * Region keys mirror salvia/klinik/drivin/restoran/carserv's dotted-naming style.
 *
 * NOTE: the vendor hero is an owl slider whose first slide has an eyebrow
 * (`Welcome to Hairsal`) AND a heading, but the exemplar scheme is hero = TITLE
 * ONLY (no hero.eyebrow), so only hero.title is declared — the first slide's main
 * heading `Hair Salon Expert` (an h2.display-1; the codemod's first-<h1> heuristic
 * had wrongly grabbed the "Hairsal" logo h1, dropped here). `welcome.*` map to the
 * intro "Welcome to Hair Salon" section, `services.title` to "Featured Services",
 * `testimonial.title` to the "New hairstyle!" quote section, `booking.title` to the
 * folded "Book Now" form heading, and `about.*` to the footer "About Hairsal" block.
 *
 * All text defaults are the exact vendor strings from HAIRSAL_PAGE_HTML
 * (templates/hairsal.ts). All image defaults are the exact vendor asset paths
 * served from public/sajtbyggare/hairsal/images/.
 */
export const HAIRSAL_REGION_MANIFEST: RegionManifest = {
  templateKey: 'hairsal',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor owl slider first slide: <h2 class="display-1">Hair Salon Expert</h2>).
    { key: 'hero.title', type: 'text', default: 'Hair Salon Expert', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Intro "Welcome to Hair Salon" section (h3 + paragraph).
    { key: 'welcome.title', type: 'text', default: 'Welcome to Hair Salon', tenantBinding: { store: 'copy', field: 'welcomeTitle' } },
    { key: 'welcome.copy', type: 'text', default: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt architecto ab hic rem placeat eius commodi eum eligendi recusandae sed qui cumque quibusdam.', tenantBinding: { store: 'copy', field: 'welcomeCopy' } },

    // Featured Services section heading.
    { key: 'services.title', type: 'text', default: 'Featured Services', tenantBinding: { store: 'copy', field: 'servicesTitle' } },

    // "New hairstyle!" testimonial/quote section heading.
    { key: 'testimonial.title', type: 'text', default: 'New hairstyle!', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },

    // Folded booking section heading (the form heading from booking.html).
    { key: 'booking.title', type: 'text', default: 'Book Now', tenantBinding: { store: 'copy', field: 'bookingTitle' } },

    // Footer "About Hairsal" block (heading + paragraph).
    { key: 'about.title', type: 'text', default: 'About Hairsal', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Saepe pariatur reprehenderit vero atque, consequatur id ratione, et non dignissimos culpa? Ut veritatis, quos illum totam quis blanditiis, minima minus odio!', tenantBinding: { store: 'copy', field: 'aboutCopy' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero slider first background (vendor: images/hero_bg_1.jpg) and the
    // "New hairstyle!" portrait (images/person_1.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/hairsal/images/hero_bg_1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/hairsal/images/person_1.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: HAIRSAL_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: HAIRSAL_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: HAIRSAL_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: HAIRSAL_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: HAIRSAL_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
