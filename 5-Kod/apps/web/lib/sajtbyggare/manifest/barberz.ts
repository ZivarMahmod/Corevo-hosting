// Barberz template — editable-region manifest (Sajtbyggare, goal-36).
//
// Declares the regions a tenant may edit on the `barberz` storefront look, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the resolver / proof test only.
//
// Like carserv/klinik/drivin/restoran (a raw vendor template imported as HTML),
// the text/image defaults here are mirrored VERBATIM from the vendor source:
//   - text/image strings → lib/sajtbyggare/templates/barberz.ts (BARBERZ_PAGE_HTML),
//                          a faithful copy of the Colorlib "Barberz" home page
//                          (booking.title is folded from contact.html's own form
//                          section — see the template header).
//   - colour/font tokens → the vendor CSS in public/sajtbyggare/barberz/css/
//                          (style.css recompiled-Bootstrap :root + body rule).
// Every value is lifted, never invented.

import type { RegionManifest } from './types'

/**
 * Barberz colour/font defaults, mirrored EXACTLY from the vendor CSS shipped in
 * public/sajtbyggare/barberz/css/. The vendor CSS is the canonical source.
 */
const BARBERZ_TOKEN_DEFAULTS = {
  /** style.css recompiled-Bootstrap `:root { --primary: #dc3545 }` — the brand
   *  red (`.text-primary`, `.btn-primary`, `.bg-primary`; ~100 refs). */
  colorPrimary: '#dc3545',
  /** The page background. Barberz's body rule sets no background, so the canonical
   *  white in the vendor CSS is `#fff` (the 3-digit form the vendor uses, ~162×). */
  colorBg: '#fff',
  /** style.css `body { color: #364d59 !important }` — the body ink. */
  colorFg: '#364d59',
  /** style.css recompiled-Bootstrap `:root { --secondary: #6c757d }` — Barberz
   *  declares no distinct accent, so the resolved accent = the secondary grey. */
  colorAccent: '#6c757d',
  /** The DM Sans body stack the vendor CSS carries verbatim (style.css; DM Sans is
   *  the Google Webfont loaded in <head>). Lifted as the exact string. */
  fontBody:
    '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
} as const

/**
 * The editable regions for barberz. Order is editorial (hero → section titles →
 * about copy → booking → images → colour → font → logo); it carries no semantics.
 *
 * Barberz uses NO eyebrows (its section headers are plain `scissors` h2/h3), so —
 * unlike carserv's `// … //` eyebrow pairs — only the section TITLES are declared.
 * `services.title` is stored as the displayed text "Services & Pricing" (the markup
 * encodes the ampersand as `&amp;`). `booking.title` is the folded contact-form
 * heading ("Contact Us Or Use This Form To Rent A Car", a vendor leftover kept
 * verbatim). Repeated body lorem (testimonials/blog/booking lede) carries no region.
 *
 * All text defaults are the exact vendor strings from BARBERZ_PAGE_HTML; all image
 * defaults are the exact vendor asset paths served from public/sajtbyggare/barberz/images/.
 */
export const BARBERZ_REGION_MANIFEST: RegionManifest = {
  templateKey: 'barberz',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    { key: 'hero.title', type: 'text', default: 'More Than Just A Haircut', tenantBinding: { store: 'copy', field: 'heroTitle' } },
    { key: 'about.title', type: 'text', default: 'Welcome To Barberz!', tenantBinding: { store: 'copy', field: 'aboutTitle' } },
    { key: 'about.copy', type: 'text', default: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iure nesciunt nemo vel earum maxime neque!', tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'services.title', type: 'text', default: 'Services & Pricing', tenantBinding: { store: 'copy', field: 'servicesTitle' } },
    { key: 'hairstyles.title', type: 'text', default: 'More Hair Styles', tenantBinding: { store: 'copy', field: 'hairstylesTitle' } },
    { key: 'moreservices.title', type: 'text', default: 'More Services', tenantBinding: { store: 'copy', field: 'moreservicesTitle' } },
    { key: 'testimonial.title', type: 'text', default: 'Our Top Client Says', tenantBinding: { store: 'copy', field: 'testimonialTitle' } },
    { key: 'blog.title', type: 'text', default: 'Our Blog', tenantBinding: { store: 'copy', field: 'blogTitle' } },
    { key: 'cta.title', type: 'text', default: 'Quality Haircut', tenantBinding: { store: 'copy', field: 'ctaTitle' } },
    { key: 'booking.title', type: 'text', default: 'Contact Us Or Use This Form To Rent A Car', tenantBinding: { store: 'copy', field: 'bookingTitle' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    // Hero cover background (images/hero_1.jpg) and the about/img-years image (images/img_1.jpg).
    { key: 'hero.image', type: 'image', default: '/sajtbyggare/barberz/images/hero_1.jpg', tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: '/sajtbyggare/barberz/images/img_1.jpg', tenantBinding: { store: 'branding', field: 'about_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: BARBERZ_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: BARBERZ_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: BARBERZ_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: BARBERZ_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: BARBERZ_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
