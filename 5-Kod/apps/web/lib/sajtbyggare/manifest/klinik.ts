// Klinik template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `klinik` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like restoran (and unlike salvia), klinik has NO THEME_CONTENT entry — it is a
// raw vendor template imported as HTML. So the text/image defaults here are
// mirrored VERBATIM from the vendor source with their exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/klinik.ts (KLINIK_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/klinik/css/
//                            (style.css :root + bootstrap.min.css body rule).
// Every value below is lifted, never invented (incl. the vendor's "Heppiness" typo).

import type { RegionManifest } from './types'

/**
 * Klinik colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/klinik/css/. Keep in sync if those files change; the vendor
 * CSS is the canonical source.
 */
const KLINIK_TOKEN_DEFAULTS = {
  /** style.css `:root { --primary: #0463FA }`. The blue brand highlight
   *  (`.text-primary`, `.btn-primary`, `.bg-primary`). */
  colorPrimary: '#0463FA',
  /** bootstrap.min.css `body { background-color: #fff }`. The page background. */
  colorBg: '#FFFFFF',
  /** bootstrap.min.css `body { color: #8D8E92 }`. The body ink. */
  colorFg: '#8D8E92',
  /** Klinik declares NO distinct accent token in the vendor CSS; mirroring
   *  salvia/restoran's scheme (accent resolves to primary where the theme has
   *  none), the resolved accent default = its primary (`--primary: #0463FA`). */
  colorAccent: '#0463FA',
  /** bootstrap.min.css `body { font-family: "Open Sans", sans-serif }` (the Google
   *  Webfont the vendor loads for body copy; headings use Roboto). The load-bearing
   *  token is the body family `Open Sans`. */
  fontBody: '"Open Sans", sans-serif',
} as const

/**
 * The editable regions for klinik. Order is editorial (hero → section
 * eyebrows/titles → images → colour → font → logo); it carries no semantics.
 * Region keys mirror salvia/restoran's dotted-naming style.
 *
 * NOTE: the vendor hero (header) has only an h1 + 3 stat counters (NO lede), so
 * there is no `hero.lede` here — it would be a fabricated value. The eyebrow/title
 * regions map to the section pill-eyebrows + headings that exist verbatim in the
 * vendor markup. Several copy fields are declared (manifest conformance) but their
 * resolver wiring is out-of-scope here (goal-37/F2) — exactly as restoran.
 *
 * All text defaults are the exact vendor strings from KLINIK_PAGE_HTML
 * (templates/klinik.ts). All image defaults are the exact vendor asset paths
 * served from public/sajtbyggare/klinik/img/.
 */
export const KLINIK_REGION_MANIFEST: RegionManifest = {
  templateKey: 'klinik',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor header: <h1>Good Health Is The Root Of All Heppiness</h1>; typo verbatim).
    { key: 'hero.title', type: 'text', default: 'Good Health Is The Root Of All Heppiness', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section pill-eyebrows + headings that exist verbatim in the vendor markup.
    { key: 'about.eyebrow', type: 'text', default: 'About Us', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.title', type: 'text', default: 'Why You Should Trust Us? Get Know About Us!', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'service.eyebrow', type: 'text', default: 'Services', tenantBinding: { store: 'copy', field: 'serviceEyebrow' } },
    { key: 'service.title', type: 'text', default: 'Health Care Solutions', tenantBinding: { store: 'copy', field: 'serviceTitle' } },
    { key: 'feature.eyebrow', type: 'text', default: 'Features', tenantBinding: { store: 'copy', field: 'featureEyebrow' } },
    { key: 'feature.title', type: 'text', default: 'Why Choose Us', tenantBinding: { store: 'copy', field: 'featureTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Doctors', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Our Experience Doctors', tenantBinding: { store: 'copy', field: 'teamTitle' } },
    { key: 'appointment.eyebrow', type: 'text', default: 'Appointment', tenantBinding: { store: 'copy', field: 'appointmentEyebrow' } },
    { key: 'appointment.title', type: 'text', default: 'Make An Appointment To Visit Our Doctor', tenantBinding: { store: 'copy', field: 'appointmentTitle' } },
    { key: 'testimonial.eyebrow', type: 'text', default: 'Testimonial', tenantBinding: { store: 'copy', field: 'testimonialEyebrow' } },
    { key: 'testimonial.title', type: 'text', default: 'What Say Our Patients!', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero carousel first image (vendor: img/carousel-1.jpg) and the first about image (img/about-1.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/klinik/img/carousel-1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/klinik/img/about-1.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: KLINIK_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: KLINIK_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: KLINIK_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: KLINIK_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: KLINIK_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
