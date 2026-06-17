// Drivin template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `drivin` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like klinik/restoran (and unlike salvia), drivin has NO THEME_CONTENT entry — it
// is a raw vendor template imported as HTML. So the text/image defaults here are
// mirrored VERBATIM from the vendor source with their exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/drivin.ts (DRIVIN_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/drivin/css/
//                            (style.css :root + bootstrap.min.css body rule).
// Every value below is lifted, never invented (incl. the vendor typos "Tranding
// Courses" and "Afordable Fee").

import type { RegionManifest } from './types'

/**
 * Drivin colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/drivin/css/. Keep in sync if those files change; the vendor
 * CSS is the canonical source.
 */
const DRIVIN_TOKEN_DEFAULTS = {
  /** style.css `:root { --primary: #F3BD00 }` (= bootstrap.min.css `--bs-primary:
   *  #F3BD00`). The yellow brand highlight (`.text-primary`, `.btn-primary`,
   *  `.bg-primary`). */
  colorPrimary: '#F3BD00',
  /** bootstrap.min.css `body { background-color: #fff }`. The page background. */
  colorBg: '#fff',
  /** bootstrap.min.css `body { color: #757575 }` (= style.css `:root --secondary:
   *  #757575`). The body ink. */
  colorFg: '#757575',
  /** Drivin declares NO distinct accent token in the vendor CSS; mirroring
   *  klinik/restoran's scheme (accent resolves to primary where the theme has
   *  none), the resolved accent default = its primary (`--primary: #F3BD00`). */
  colorAccent: '#F3BD00',
  /** bootstrap.min.css `body { font-family: "Work Sans", sans-serif }` (the Google
   *  Webfont the vendor loads for body copy). The load-bearing token is the body
   *  family `Work Sans`. */
  fontBody: '"Work Sans", sans-serif',
} as const

/**
 * The editable regions for drivin. Order is editorial (hero → section
 * eyebrows/titles → images → colour → font → logo); it carries no semantics.
 * Region keys mirror salvia/klinik/restoran's dotted-naming style.
 *
 * NOTE: the vendor hero carousel has only an h1 per slide (NO eyebrow, NO lede),
 * so there is no `hero.eyebrow`/`hero.lede` here — those would be fabricated
 * values. hero.title is the FIRST/active slide heading. The "Make Appointment"
 * block has only an h1 (no eyebrow pill), so there is `appointment.title` but NO
 * `appointment.eyebrow`. The eyebrow/title regions map only to section
 * eyebrows + headings that exist verbatim in the vendor markup (the Facts cards
 * and per-course names are skipped, as klinik skipped its service-item names).
 *
 * All text defaults are the exact vendor strings from DRIVIN_PAGE_HTML
 * (templates/drivin.ts), incl. the typos. All image defaults are the exact
 * vendor asset paths served from public/sajtbyggare/drivin/img/.
 */
export const DRIVIN_REGION_MANIFEST: RegionManifest = {
  templateKey: 'drivin',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor carousel first/active slide: <h1>Learn To Drive With Confidence</h1>).
    { key: 'hero.title', type: 'text', default: 'Learn To Drive With Confidence', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section eyebrows + headings that exist verbatim in the vendor markup.
    { key: 'about.eyebrow', type: 'text', default: 'About Us', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.title', type: 'text', default: 'We Help Students To Pass Test & Get A License On The First Try', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'courses.eyebrow', type: 'text', default: 'Tranding Courses', tenantBinding: { store: 'copy', field: 'coursesEyebrow' } },
    { key: 'courses.title', type: 'text', default: 'Our Courses Upskill You With Driving Training', tenantBinding: { store: 'copy', field: 'coursesTitle' } },
    { key: 'feature.eyebrow', type: 'text', default: 'Why Choose Us!', tenantBinding: { store: 'copy', field: 'featureEyebrow' } },
    { key: 'feature.title', type: 'text', default: 'Best Driving Training Agency In Your City', tenantBinding: { store: 'copy', field: 'featureTitle' } },
    { key: 'appointment.title', type: 'text', default: 'Make Appointment', tenantBinding: { store: 'copy', field: 'appointmentTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Meet The Team', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'We Have Great Experience Of Driving', tenantBinding: { store: 'copy', field: 'teamTitle' } },
    { key: 'testimonial.eyebrow', type: 'text', default: 'Testimonial', tenantBinding: { store: 'copy', field: 'testimonialEyebrow' } },
    { key: 'testimonial.title', type: 'text', default: 'What Our Clients Say!', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero carousel first image (vendor: img/carousel-1.jpg) and the first about image (img/about-1.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/drivin/img/carousel-1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/drivin/img/about-1.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: DRIVIN_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: DRIVIN_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: DRIVIN_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: DRIVIN_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: DRIVIN_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
