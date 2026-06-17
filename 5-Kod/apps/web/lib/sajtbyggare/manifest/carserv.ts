// CarServ template — editable-region manifest (Sajtbyggare, F1).
//
// Declares the regions a tenant may edit on the `carserv` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like klinik/drivin/restoran (and unlike salvia), carserv has NO THEME_CONTENT
// entry — it is a raw vendor template imported as HTML. So the text/image defaults
// here are mirrored VERBATIM from the vendor source with their exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/carserv.ts (CARSERV_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/carserv/css/
//                            (style.css :root + bootstrap.min.css body rule).
// Every value below is lifted, never invented (incl. the vendor's literal `// … //`
// eyebrow slashes, and the typos "Compleate Projects" / "Vacuam Cleaning").

import type { RegionManifest } from './types'

/**
 * CarServ colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/carserv/css/. Keep in sync if those files change; the vendor
 * CSS is the canonical source.
 */
const CARSERV_TOKEN_DEFAULTS = {
  /** style.css `:root { --primary: #D81324 }`. The red brand highlight
   *  (`.text-primary`, `.btn-primary`, `.bg-primary`). */
  colorPrimary: '#D81324',
  /** bootstrap.min.css `body { background-color: #fff }`. The page background.
   *  (Exact 3-digit lowercase form the vendor body rule carries.) */
  colorBg: '#fff',
  /** bootstrap.min.css `body { color: #596277 }`. The body ink. */
  colorFg: '#596277',
  /** CarServ declares NO distinct accent token in the vendor CSS; mirroring
   *  klinik/drivin/restoran's scheme (accent resolves to primary where the theme
   *  has none), the resolved accent default = its primary (`--primary: #D81324`). */
  colorAccent: '#D81324',
  /** bootstrap.min.css `body { font-family: "Ubuntu", sans-serif }` (the Google
   *  Webfont the vendor loads for body copy; headings use Barlow). The load-bearing
   *  token is the body family `Ubuntu`. */
  fontBody: '"Ubuntu", sans-serif',
} as const

/**
 * The editable regions for carserv. Order is editorial (hero → section
 * eyebrows/titles → images → colour → font → logo); it carries no semantics.
 * Region keys mirror salvia/klinik/drivin/restoran's dotted-naming style.
 *
 * NOTE: the vendor hero carousel slide has an eyebrow (`// Car Servicing //`) AND
 * an h1, but the exemplar scheme is hero = TITLE ONLY (no hero.eyebrow/hero.lede),
 * so only hero.title is declared (the first/active slide heading) — mirroring
 * klinik/drivin. The first Service block (3 cards, no heading) carries no manifest
 * region — its card names are skipped, exactly as klinik skipped its service-item
 * names and drivin its course names. The `service.eyebrow`/`service.title` regions
 * map to the SECOND Service block (`// Our Services //` / `Explore Our Services`),
 * the block that gets `id="service"`. The Booking block's form-column heading
 * (`Book For A Service`, the h1 attached to the module) is `booking.title`; the
 * section's left lead h1 has no manifest region. Eyebrow/title regions map only to
 * eyebrows + headings that exist verbatim in the vendor markup (the Fact counters
 * are skipped).
 *
 * All text defaults are the exact vendor strings from CARSERV_PAGE_HTML
 * (templates/carserv.ts), incl. the literal `// … //` eyebrow slashes. All image
 * defaults are the exact vendor asset paths served from public/sajtbyggare/carserv/img/.
 */
export const CARSERV_REGION_MANIFEST: RegionManifest = {
  templateKey: 'carserv',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor carousel first/active slide: <h1>Qualified Car Repair Service Center</h1>).
    { key: 'hero.title', type: 'text', default: 'Qualified Car Repair Service Center', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section eyebrows + headings that exist verbatim in the vendor markup
    // (eyebrows carry the literal `// … //` slashes — lifted as-is).
    { key: 'about.eyebrow', type: 'text', default: '// About Us //', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.title', type: 'text', default: 'CarServ Is The Best Place For Your Auto Care', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'service.eyebrow', type: 'text', default: '// Our Services //', tenantBinding: { store: 'copy', field: 'serviceEyebrow' } },
    { key: 'service.title', type: 'text', default: 'Explore Our Services', tenantBinding: { store: 'copy', field: 'serviceTitle' } },
    { key: 'booking.title', type: 'text', default: 'Book For A Service', tenantBinding: { store: 'copy', field: 'bookingTitle' } },
    { key: 'team.eyebrow', type: 'text', default: '// Our Technicians //', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Our Expert Technicians', tenantBinding: { store: 'copy', field: 'teamTitle' } },
    { key: 'testimonial.eyebrow', type: 'text', default: '// Testimonial //', tenantBinding: { store: 'copy', field: 'testimonialEyebrow' } },
    { key: 'testimonial.title', type: 'text', default: 'Our Clients Say!', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero carousel first image (vendor: img/carousel-bg-1.jpg) and the about image (img/about.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/carserv/img/carousel-bg-1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/carserv/img/about.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: CARSERV_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: CARSERV_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: CARSERV_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: CARSERV_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: CARSERV_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
