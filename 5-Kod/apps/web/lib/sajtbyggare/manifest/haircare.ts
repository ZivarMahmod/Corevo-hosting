// Haircare template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `haircare` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like klinik/drivin/restoran/carserv (and unlike salvia), haircare has NO
// THEME_CONTENT entry — it is a raw vendor template (Colorlib "Haircare",
// CC BY 3.0) imported as HTML. So the text/image defaults here are mirrored
// VERBATIM from the vendor source with their exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/haircare.ts (HAIRCARE_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/haircare/css/style.css
//                            (the THEME `body` rule + the brand `a{color}` rule).
// Every value below is lifted, never invented.
//
// CANON-TOKEN NOTE (judgment, not improvisation): Colorlib compiles its brand
// colour straight into rules (NOT into `:root{--primary}`) — `:root{--primary}` in
// this style.css is Bootstrap's own default `#007bff`, which is NOT the theme
// brand. The real, load-bearing Haircare brand is `#bf925b` (the gold used 50+×
// for `a{color}`, `.btn-primary`, the active nav item, and the appointment-form
// submit button). The theme `body` rule sets `background:#f5f2ea; color:gray;
// font-family:"Poppins",Arial,sans-serif`. Those exact theme values are lifted
// here — the codemod's heuristic `#007bff/#fff/#212529/apple-system` (Bootstrap
// defaults) were rejected as not the vendor's theme.

import type { RegionManifest } from './types'

/**
 * Haircare colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/haircare/css/style.css. Keep in sync if those files change;
 * the vendor CSS is the canonical source.
 */
const HAIRCARE_TOKEN_DEFAULTS = {
  /** style.css theme `a { color: #bf925b }` (also `.btn-primary`, active nav, the
   *  appointment-form submit). The gold brand highlight. */
  colorPrimary: '#bf925b',
  /** style.css theme `body { background: #f5f2ea }`. The page background. */
  colorBg: '#f5f2ea',
  /** style.css theme `body { color: gray }`. The body ink (CSS named colour, as
   *  the vendor wrote it). */
  colorFg: 'gray',
  /** Haircare declares NO distinct accent token; mirroring klinik/drivin/restoran/
   *  carserv's scheme (accent resolves to primary where the theme has none), the
   *  resolved accent default = its primary (`#bf925b`). */
  colorAccent: '#bf925b',
  /** style.css theme `body { font-family: "Poppins", Arial, sans-serif }` (the
   *  Google Webfont the vendor loads for body copy). */
  fontBody: '"Poppins", Arial, sans-serif',
} as const

/**
 * The editable regions for haircare. Order is editorial (hero → section
 * eyebrows/titles → about copy → images → colour → font → logo); it carries no
 * semantics. Region keys mirror salvia/klinik/drivin/restoran/carserv's
 * dotted-naming style.
 *
 * NOTE: the vendor hero has a `<span class="subheading">` eyebrow ("Welcome to
 * Haircare") AND an h1, but the exemplar scheme is hero = TITLE ONLY (no
 * hero.eyebrow/hero.lede), so only hero.title is declared (the h1) — mirroring
 * klinik/drivin/carserv. Colorlib marks each section eyebrow as
 * `<span class="subheading">` followed by an `<h2>` heading; the eyebrow+title
 * pairs below map to those real section headings (Services / Team / Gallery /
 * Pricing / Testimony). The intro/"about" block (the centre column of the For
 * Men / For Women row) is text-only — its `<h2>Welcome to our Salon</h2>` is
 * about.title and its real paragraph is about.copy (no eyebrow span there). The
 * Booking section's editable heading (`Make an Appointment`, the h2 above the
 * woven module) is booking.title; its "Booking" eyebrow + the "Call Us" line stay
 * static. Per-card service names / pricing rows / team names are skipped (exactly
 * as klinik skipped its service-item names).
 *
 * All text defaults are the exact vendor strings from HAIRCARE_PAGE_HTML
 * (templates/haircare.ts). All image defaults are the exact vendor asset paths
 * served from public/sajtbyggare/haircare/images/.
 */
export const HAIRCARE_REGION_MANIFEST: RegionManifest = {
  templateKey: 'haircare',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor: <h1>We are professional care for your hair</h1>).
    { key: 'hero.title', type: 'text', default: 'We are professional care for your hair', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Intro/"about" block (centre column of the For Men / For Women row).
    { key: 'about.title', type: 'text', default: 'Welcome to our Salon', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'A small river named Duden flows by their place and supplies it with the necessary regelialia. It is a paradisematic country, in which roasted parts of sentences fly into your mouth. Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.', tenantBinding: { store: 'copy', field: 'aboutCopy' } },

    // Section eyebrows (vendor `<span class="subheading">`) + their h2 headings.
    { key: 'services.eyebrow', type: 'text', default: 'Services', tenantBinding: { store: 'copy', field: 'servicesEyebrow' } },
    { key: 'services.title', type: 'text', default: 'Services Menu', tenantBinding: { store: 'copy', field: 'servicesTitle' } },
    // Booking section: only the form heading is editable (the "Booking" eyebrow stays static).
    { key: 'booking.title', type: 'text', default: 'Make an Appointment', tenantBinding: { store: 'copy', field: 'bookingTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Artistic Director', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Makeup Artist', tenantBinding: { store: 'copy', field: 'teamTitle' } },
    { key: 'gallery.eyebrow', type: 'text', default: 'Gallery', tenantBinding: { store: 'copy', field: 'galleryEyebrow' } },
    { key: 'gallery.title', type: 'text', default: 'Our gallery', tenantBinding: { store: 'copy', field: 'galleryTitle' } },
    { key: 'pricing.eyebrow', type: 'text', default: 'Pricing', tenantBinding: { store: 'copy', field: 'pricingEyebrow' } },
    { key: 'pricing.title', type: 'text', default: 'Our Prices', tenantBinding: { store: 'copy', field: 'pricingTitle' } },
    { key: 'testimonial.eyebrow', type: 'text', default: 'Testimony', tenantBinding: { store: 'copy', field: 'testimonialEyebrow' } },
    { key: 'testimonial.title', type: 'text', default: 'Happy Customer', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero background (vendor: hero-wrap style background-image url(images/bg-2.jpg))
    // and the For-Men intro/about panel image (images/formen.jpg) — this look's
    // about block is text-with-flanking-panels, not a single about <img>.
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/haircare/images/bg-2.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/haircare/images/formen.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: HAIRCARE_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: HAIRCARE_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: HAIRCARE_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: HAIRCARE_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: HAIRCARE_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
