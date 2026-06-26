// HairCut template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `haircut` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like carserv/klinik/drivin/restoran (and unlike salvia), haircut has NO
// THEME_CONTENT entry — it is a raw vendor template imported as HTML. So the
// text/image defaults here are mirrored VERBATIM from the vendor source with their
// exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/haircut.ts (HAIRCUT_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html (+ the
//                            booking band folded from the vendor contact.html).
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/haircut/css/
//                            (style.css :root + bootstrap.min.css body rule).
// Every value below is lifted, never invented. HairCut is a DARK theme (black page
// background, near-black "secondary" panels, red brand highlight).

import type { RegionManifest } from './types'

/**
 * HairCut colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/haircut/css/. Keep in sync if those files change; the vendor
 * CSS is the canonical source.
 */
const HAIRCUT_TOKEN_DEFAULTS = {
  /** style.css `:root { --primary: #EB1616 }`. The red brand highlight
   *  (`.text-primary`, `.btn-primary`). */
  colorPrimary: '#EB1616',
  /** bootstrap.min.css `body { background-color: #000 }`. The (black) page
   *  background — HairCut is a dark theme. (Exact short form the body rule carries.) */
  colorBg: '#000',
  /** bootstrap.min.css `body { color: #6C7293 }`. The muted body ink. */
  colorFg: '#6C7293',
  /** style.css `:root { --secondary: #191C24 }`. The near-black panel colour used
   *  by `.bg-secondary` (navbar, cards, price/hours panels). The distinct accent. */
  colorAccent: '#191C24',
  /** bootstrap.min.css `body { font-family: "Roboto", sans-serif }` (the Google
   *  Webfont the vendor loads for body copy; headings use Oswald). The load-bearing
   *  token is the body family `Roboto`. */
  fontBody: '"Roboto", sans-serif',
} as const

/**
 * The editable regions for haircut. Order is editorial (hero → section
 * eyebrows/titles → booking → images → colour → font → logo); it carries no
 * semantics. Region keys mirror carserv/salvia/klinik/drivin's dotted-naming style.
 *
 * NOTES on the choice of regions (each maps to an eyebrow/heading/paragraph that
 * exists VERBATIM in the vendor markup):
 *  - hero  = TITLE ONLY (the first/active carousel slide <h1>); the carousel has
 *    no eyebrow, mirroring carserv/klinik.
 *  - The vendor section "eyebrows" are `<p class="d-inline-block …">` pills (e.g.
 *    "About Us", "Services", "Price & Plan", "Our Barber", "Working Hours",
 *    "Testimonial") — declared as `*.eyebrow` text regions.
 *  - The Service cards (Haircut/Beard Trim/…), the Price rows, the Working-Hours
 *    rows and the Team cards carry NO manifest region — their names are skipped,
 *    exactly as carserv skipped its service-card names and price/fact counters.
 *  - booking.title = the folded contact section's form heading
 *    ("Have Any Query? Please Contact Us!"), the h1 attached to the booking module.
 *  - about.copy = the first About paragraph (lorem). The second About paragraph and
 *    the "Since 1990"/"1000+ clients" stat blocks have no region.
 *
 * All text defaults are the exact vendor strings from HAIRCUT_PAGE_HTML
 * (templates/haircut.ts). All image defaults are the exact vendor asset paths
 * served from public/sajtbyggare/haircut/img/.
 */
export const HAIRCUT_REGION_MANIFEST: RegionManifest = {
  templateKey: 'haircut',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor carousel first/active slide: <h1>We Will Keep You An Awesome Look</h1>).
    { key: 'hero.title', type: 'text', default: 'We Will Keep You An Awesome Look', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section eyebrow pills + headings that exist verbatim in the vendor markup.
    { key: 'about.eyebrow', type: 'text', default: 'About Us', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.title', type: 'text', default: 'More Than Just A Haircut. Learn More About Us!', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'service.eyebrow', type: 'text', default: 'Services', tenantBinding: { store: 'copy', field: 'serviceEyebrow' } },
    { key: 'service.title', type: 'text', default: 'What We Provide', tenantBinding: { store: 'copy', field: 'serviceTitle' } },
    { key: 'price.eyebrow', type: 'text', default: 'Price & Plan', tenantBinding: { store: 'copy', field: 'priceEyebrow' } },
    { key: 'price.title', type: 'text', default: 'Check Out Our Barber Services And Prices', tenantBinding: { store: 'copy', field: 'priceTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Our Barber', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Meet Our Barber', tenantBinding: { store: 'copy', field: 'teamTitle' } },
    { key: 'hours.eyebrow', type: 'text', default: 'Working Hours', tenantBinding: { store: 'copy', field: 'hoursEyebrow' } },
    { key: 'hours.title', type: 'text', default: 'Professional Barbers Are Waiting For You', tenantBinding: { store: 'copy', field: 'hoursTitle' } },
    { key: 'testimonial.eyebrow', type: 'text', default: 'Testimonial', tenantBinding: { store: 'copy', field: 'testimonialEyebrow' } },
    { key: 'testimonial.title', type: 'text', default: 'What Our Clients Say!', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },
    // Booking band heading (folded from contact.html).
    { key: 'booking.title', type: 'text', default: 'Have Any Query? Please Contact Us!', tenantBinding: { store: 'copy', field: 'bookingTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero carousel first image (vendor: img/carousel-1.jpg) and the about image (img/about.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/haircut/img/carousel-1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/haircut/img/about.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: HAIRCUT_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: HAIRCUT_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: HAIRCUT_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: HAIRCUT_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: HAIRCUT_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
