// keto template — editable-region manifest (Sajtbyggare, F1 / goal-36).
//
// Declares the regions a tenant may edit on the `keto` storefront look, with each
// region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / proof test only.
//
// Like carserv/klinik/drivin/restoran, keto has NO THEME_CONTENT entry — it is a
// raw vendor template imported as HTML. So the text/image defaults here are mirrored
// VERBATIM from the vendor source with their exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/keto.ts (KETO_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/keto/css/
//                            (style.css brand/body rules).
// Every value below is lifted, never invented.
//
// keto specifics: the hero is an IMAGE-ONLY Bootstrap carousel (the slides carry no
// caption text), so there is NO hero.title text region — only hero.image. The first
// <h1> on the page is the booking-form heading ("Book a Room Online") → booking.title.
// keto uses no eyebrow (`// … //`) labels; section headings live in `.titlepage h2`,
// so the section regions are plain `<section>.title` (+ a `.copy` where the vendor
// shows a subtitle paragraph). The codemod's heuristic mis-detected the brand colour
// as Bootstrap's default `#007bff` (keto declares no `--primary`/`.btn-primary`); the
// real brand red `#fe0000` is lifted from style.css (`.book_btn`, nav hover, carousel
// active indicator, `.read_more:hover`).

import type { RegionManifest } from './types'

/**
 * keto colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/keto/css/. Keep in sync if those files change; the vendor CSS
 * is the canonical source.
 */
const KETO_TOKEN_DEFAULTS = {
  /** style.css `.book_btn { background-color: #fe0000 }` (also nav hover,
   *  `.banner .carousel-indicators .active`, `.read_more:hover`). The brand red. */
  colorPrimary: '#fe0000',
  /** No `background-color` on the vendor `body` rule; the page surface is white
   *  (`.header`/`.loader_bg` `background: #fff`). `#ffffff` is present in style.css. */
  colorBg: '#ffffff',
  /** style.css `body { color: #666666 }`. The body ink. */
  colorFg: '#666666',
  /** keto declares no distinct accent token; mirroring carserv/klinik/drivin/restoran
   *  (accent resolves to primary where the look has none), accent = its primary. */
  colorAccent: '#fe0000',
  /** style.css `body { font-family: 'Poppins', sans-serif }` (the Google Webfont the
   *  vendor loads for body copy). The load-bearing token is the body family `Poppins`. */
  fontBody: "'Poppins', sans-serif",
} as const

/**
 * The editable regions for keto. Order is editorial (booking heading → section
 * titles/copy → images → colour → font → logo); it carries no semantics. Region
 * keys mirror the dotted-naming style of the other looks.
 *
 * All text defaults are the exact vendor strings from KETO_PAGE_HTML
 * (templates/keto.ts). All image defaults are the exact vendor asset paths served
 * from public/sajtbyggare/keto/images/.
 */
export const KETO_REGION_MANIFEST: RegionManifest = {
  templateKey: 'keto',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Booking column heading (vendor: <h1>Book a Room Online</h1>, the form heading).
    { key: 'booking.title', type: 'text', default: 'Book a Room Online', tenantBinding: { store: 'copy', field: 'bookingTitle' } },

    // Section headings (vendor `.titlepage h2`) + the subtitle paragraphs that exist.
    { key: 'about.title', type: 'text', default: 'About Us', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: "The passage experienced a surge in popularity during the 1960s when Letraset used it on their dry-transfer sheets, and again during the 90s as desktop publishers bundled the text with their software. Today it's seen all around the web; on templates, websites, and stock designs. Use our generator to get your own, or read on for the authoritative history of lorem ipsum.", tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'room.title', type: 'text', default: 'Our Room', tenantBinding: { store: 'copy', field: 'roomTitle' } },
    { key: 'room.copy', type: 'text', default: 'Lorem Ipsum available, but the majority have suffered', tenantBinding: { store: 'copy', field: 'roomCopy' } },
    { key: 'gallery.title', type: 'text', default: 'gallery', tenantBinding: { store: 'copy', field: 'galleryTitle' } },
    { key: 'blog.title', type: 'text', default: 'Blog', tenantBinding: { store: 'copy', field: 'blogTitle' } },
    { key: 'blog.copy', type: 'text', default: 'Lorem Ipsum available, but the majority have suffered', tenantBinding: { store: 'copy', field: 'blogCopy' } },
    { key: 'contact.title', type: 'text', default: 'Contact Us', tenantBinding: { store: 'copy', field: 'contactTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero carousel first slide (vendor: images/banner1.jpg) + about image (images/about.png).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/keto/images/banner1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/keto/images/about.png', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: KETO_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: KETO_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: KETO_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: KETO_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: KETO_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
