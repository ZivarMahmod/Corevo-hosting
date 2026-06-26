// DentCare template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `dentcare` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like klinik/carserv/drivin/restoran (and unlike salvia), dentcare has NO
// THEME_CONTENT entry — it is a raw vendor template imported as HTML. So the
// text/image defaults here are mirrored VERBATIM from the vendor source with their
// exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/dentcare.ts (DENTCARE_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/dentcare/css/
//                            (style.css :root + bootstrap.min.css body rule).
// Every value below is lifted, never invented.

import type { RegionManifest } from './types'

/**
 * DentCare colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/dentcare/css/. Keep in sync if those files change; the vendor
 * CSS is the canonical source.
 */
const DENTCARE_TOKEN_DEFAULTS = {
  /** style.css `:root { --primary: #06A3DA }`. The cyan brand highlight
   *  (`.text-primary`, `.btn-primary`, `.bg-primary`). */
  colorPrimary: '#06A3DA',
  /** bootstrap.min.css `body { background-color: #fff }`. The page background
   *  (the exact 3-digit lowercase form the vendor body rule carries). */
  colorBg: '#fff',
  /** bootstrap.min.css `body { color: #6B6A75 }`. The body ink. */
  colorFg: '#6B6A75',
  /** Unlike klinik/carserv, dentcare DOES declare a distinct accent token in the
   *  vendor CSS: style.css `:root { --secondary: #F57E57 }` (the coral the theme
   *  uses for `.bg-secondary`, e.g. the Banner "Make Appointment" card). Lifted
   *  as-is — it is NOT resolved to primary. */
  colorAccent: '#F57E57',
  /** bootstrap.min.css `body { font-family: "Open Sans", sans-serif }` (the Google
   *  Webfont the vendor loads for body copy; headings use Jost). The load-bearing
   *  token is the body family `Open Sans` (exact form, no space after comma). */
  fontBody: '"Open Sans",sans-serif',
} as const

/**
 * The editable regions for dentcare. Order is editorial (hero → section
 * eyebrows/titles → images → colour → font → logo); it carries no semantics.
 * Region keys mirror salvia/klinik/carserv's dotted-naming style.
 *
 * NOTE: the vendor hero is the Bootstrap carousel slide — an eyebrow
 * (`Keep Your Teeth Healthy`) AND an h1 — but the exemplar scheme is hero = TITLE
 * ONLY (no hero.eyebrow), so only hero.title is declared (the first/active slide
 * heading `Take The Best Quality Dental Treatment`) — mirroring klinik/carserv. The
 * navbar brand h1 (`DentCare`) carries no manifest region. The Banner trio (Opening
 * Hours / Search A Doctor / Make Appointment cards — h3 headings, no eyebrow) is
 * skipped, exactly as carserv skipped its first heading-less Service block. The
 * Appointment block's form-column heading (`Make Appointment`, the h1 attached to
 * the module) is `booking.title`; the section's left lead h1 has no manifest region.
 * The Offer banner (`Save 30% …`, no section-title eyebrow), the in-pricing phone
 * CTA (`Call for Appointment`), and the Testimonial carousel (no heading at all)
 * carry no eyebrow/title regions — declaring one would be a fabricated value. The
 * `team.*` regions map to the vendor's "Our Dentist" staff section (eyebrow +
 * heading), mirroring carserv/klinik's team region naming.
 *
 * All text defaults are the exact vendor strings from DENTCARE_PAGE_HTML
 * (templates/dentcare.ts). All image defaults are the exact vendor asset paths
 * served from public/sajtbyggare/dentcare/img/.
 */
export const DENTCARE_REGION_MANIFEST: RegionManifest = {
  templateKey: 'dentcare',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor carousel first/active slide: <h1>Take The Best Quality Dental Treatment</h1>).
    { key: 'hero.title', type: 'text', default: 'Take The Best Quality Dental Treatment', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section eyebrows + headings that exist verbatim in the vendor markup
    // (eyebrows are the `section-title` h5 pills, e.g. "About Us" / "Our Services").
    { key: 'about.eyebrow', type: 'text', default: 'About Us', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.title', type: 'text', default: "The World's Best Dental Clinic That You Can Trust", tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum et tempor sit. Aliqu diam amet diam et eos labore. Clita erat ipsum et lorem et sit, sed stet no labore lorem sit. Sanctus clita duo justo et tempor eirmod magna dolore erat amet', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'booking.title', type: 'text', default: 'Make Appointment', tenantBinding: { store: 'copy', field: 'bookingTitle' } },
    { key: 'service.eyebrow', type: 'text', default: 'Our Services', tenantBinding: { store: 'copy', field: 'serviceEyebrow' } },
    { key: 'service.title', type: 'text', default: 'We Offer The Best Quality Dental Services', tenantBinding: { store: 'copy', field: 'serviceTitle' } },
    { key: 'pricing.eyebrow', type: 'text', default: 'Pricing Plan', tenantBinding: { store: 'copy', field: 'pricingEyebrow' } },
    { key: 'pricing.title', type: 'text', default: 'We Offer Fair Prices for Dental Treatment', tenantBinding: { store: 'copy', field: 'pricingTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Our Dentist', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Meet Our Certified & Experienced Dentist', tenantBinding: { store: 'copy', field: 'teamTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero carousel first image (vendor: img/carousel-1.jpg) and the about image (img/about.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/dentcare/img/carousel-1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/dentcare/img/about.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: DENTCARE_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: DENTCARE_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: DENTCARE_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: DENTCARE_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: DENTCARE_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
