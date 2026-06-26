// Barber X template — editable-region manifest (Sajtbyggare, goal-36).
//
// Declares the regions a tenant may edit on the `barberx` storefront look, with
// each region's Universal/look default and the storage binding for a per-tenant
// override. Pure data; imported by the resolver / proof test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag).
//
// Like carserv/klinik/drivin/restoran (and unlike salvia), barberx has NO
// THEME_CONTENT entry — it is a raw vendor template imported as HTML. So the
// text/image defaults here are mirrored VERBATIM from the vendor source with their
// exact origin noted:
//   - text/image strings  → lib/sajtbyggare/templates/barberx.ts (BARBERX_PAGE_HTML),
//                            itself a faithful copy of the vendor index.html. The one
//                            exception is the booking band's eyebrow/title, lifted
//                            verbatim from the SAME form's heading in contact.html
//                            ("Get In Touch" / "If You Have Any Query, Please Contact
//                            Us") and folded into the home band (the home page presents
//                            that form headless) — the template's own content, never
//                            invented.
//   - colour/font tokens  → the vendor CSS in public/sajtbyggare/barberx/css/style.css
//                            (the `body` rule + the gold/navy brand colours). Bootstrap,
//                            Font Awesome and the Open Sans webfont load from CDNs in
//                            the vendor, so style.css is the only local stylesheet and
//                            the canonical token source.
// Every value below is lifted, never invented.

import type { RegionManifest } from './types'

/**
 * Barber X colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/barberx/css/style.css. Keep in sync if that file changes; the
 * vendor CSS is the canonical source.
 */
const BARBERX_TOKEN_DEFAULTS = {
  /** style.css the gold brand colour — `.hero { background: #D5B981 }`,
   *  `.btn { background: #D5B981 }`, `a:hover { color: #D5B981 }`. The load-bearing
   *  highlight of the look. */
  colorPrimary: '#D5B981',
  /** style.css `body { background: #ffffff }`. The page background. */
  colorBg: '#ffffff',
  /** style.css `body { color: #797979 }`. The body ink. */
  colorFg: '#797979',
  /** style.css the dark navy used for headings + the top bar/navbar
   *  (`h1..h6 { color: #1d2434 }`, `.top-bar { background: #1d2434 }`). barberx has
   *  a distinct accent (unlike carserv where accent == primary). */
  colorAccent: '#1d2434',
  /** style.css `body { font-family: 'Open Sans', sans-serif }` (the Google Webfont
   *  the vendor loads from a CDN). The load-bearing token is the body family. */
  fontBody: "'Open Sans', sans-serif",
} as const

/**
 * The editable regions for barberx. Order is editorial (document order: hero →
 * about → service → price → team → booking → blog → images → colour → font → logo);
 * it carries no semantics. Region keys mirror carserv/salvia/klinik/drivin's
 * dotted-naming style.
 *
 * NOTE: the vendor hero has a TITLE only (no eyebrow), so only hero.title is
 * declared. The Service/Pricing/Team/Blog blocks each carry a `.section-header`
 * (`<p>` eyebrow + `<h2>` heading) → eyebrow/title regions. The Testimonial block
 * (no section-header on the home page) and the per-item names (service cards, price
 * rows, team members, blog posts) carry no manifest region — mirroring how carserv
 * skipped its team/service card names. The Contact band's folded heading
 * (`Get In Touch` / `If You Have Any Query, Please Contact Us`) — the band that gets
 * `id="contact"` and the booking module — is booking.eyebrow/booking.title.
 *
 * All text defaults are the exact vendor strings from BARBERX_PAGE_HTML
 * (templates/barberx.ts). All image defaults are the exact vendor asset paths served
 * from public/sajtbyggare/barberx/img/.
 */
export const BARBERX_REGION_MANIFEST: RegionManifest = {
  templateKey: 'barberx',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    // Hero (vendor: <h1>HTML5 Template for Salon Website</h1>).
    { key: 'hero.title', type: 'text', default: 'HTML5 Template for Salon Website', tenantBinding: { store: 'copy', field: 'heroTitle' } },

    // Section eyebrows + headings that exist verbatim in the vendor markup.
    { key: 'about.eyebrow', type: 'text', default: 'Learn About Us', tenantBinding: { store: 'copy', field: 'aboutEyebrow' } },
    { key: 'about.title', type: 'text', default: '25 Years Experience', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec pretium mi. Curabitur facilisis ornare velit non vulputate. Aliquam metus tortor, auctor id gravida condimentum, viverra quis sem.', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'service.eyebrow', type: 'text', default: 'Our Salon Services', tenantBinding: { store: 'copy', field: 'serviceEyebrow' } },
    { key: 'service.title', type: 'text', default: 'Best Salon and Barber Services for You', tenantBinding: { store: 'copy', field: 'serviceTitle' } },
    { key: 'price.eyebrow', type: 'text', default: 'Our Best Pricing', tenantBinding: { store: 'copy', field: 'priceEyebrow' } },
    { key: 'price.title', type: 'text', default: 'We Provide Best Price in the City', tenantBinding: { store: 'copy', field: 'priceTitle' } },
    { key: 'team.eyebrow', type: 'text', default: 'Our Barber Team', tenantBinding: { store: 'copy', field: 'teamEyebrow' } },
    { key: 'team.title', type: 'text', default: 'Meet Our Hair Cut Expert Barber', tenantBinding: { store: 'copy', field: 'teamTitle' } },
    // Booking band — folded contact section-header (verbatim from contact.html).
    { key: 'booking.eyebrow', type: 'text', default: 'Get In Touch', tenantBinding: { store: 'copy', field: 'bookingEyebrow' } },
    { key: 'booking.title', type: 'text', default: 'If You Have Any Query, Please Contact Us', tenantBinding: { store: 'copy', field: 'bookingTitle' } },
    { key: 'blog.eyebrow', type: 'text', default: 'Latest From Blog', tenantBinding: { store: 'copy', field: 'blogEyebrow' } },
    { key: 'blog.title', type: 'text', default: 'Learn More from Latest Barber Blog', tenantBinding: { store: 'copy', field: 'blogTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero image (vendor: img/hero.png) and the about image (img/about.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/barberx/img/hero.png', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/barberx/img/about.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: BARBERX_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: BARBERX_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: BARBERX_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: BARBERX_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: BARBERX_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no look default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
