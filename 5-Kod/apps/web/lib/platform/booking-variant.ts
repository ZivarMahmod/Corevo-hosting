// Booking-vy-val per tenant (M7 §2.4 + design "booking-variants") — the storefront
// booking presentation Zivar picks for each salon during onboarding / tenant-detail.
//
// CONTRACT FOR M3: the chosen variant is persisted at
//   tenant_settings.settings.booking.variant
// as one of the FOUR design ids: 'wizard' | 'compact' | 'drawer' | 'inline'.
// M3/storefront reads it directly from the raw `settings` jsonb (the same raw-read
// seam getGoogleReviewUrl uses), NOT from the frozen parseSettings()/getTenantBySlug
// bundle. Use `readBookingVariant(settings)` / `readBookingMode(settings)` below so
// the parse + default + legacy-mapping live in ONE place that M3 imports — keep the
// storage key in sync everywhere.
//
// LEGACY: earlier tenants persisted the numeric ids '3' (guided) / '4' (snabbboka).
// readBookingVariant maps those FORWARD ('3'→'wizard', '4'→'compact') so no existing
// salon ever breaks and `readBookingMode` keeps returning exactly today's value.
//
// Held DELIBERATELY apart from settings.theme, which is the storefront LAYOUT/look
// (the five named themes), not the booking flow.
//
//   wizard (default) — guidad steg-för-steg i en CENTRERAD MODAL.
//   compact          — snabbboka (allt på en skärm) i slide-over-panelen.
//   drawer           — guidad steg-för-steg i SLIDE-OVER-panelen från sidan.
//   inline           — bokningen ligger INBYGGD längst ner på sidan (ingen overlay);
//                      "Boka tid"-CTA:erna scrollar dit. Alla fyra renderar numera
//                      DISTINKT (Zivar: "det ska finnas olika att välja mellan och de
//                      ska funka") — presentationen styrs i BookingProvider/layout.

export const BOOKING_VARIANTS = ['wizard', 'compact', 'drawer', 'inline'] as const
export type BookingVariant = (typeof BOOKING_VARIANTS)[number]

export const DEFAULT_BOOKING_VARIANT: BookingVariant = 'wizard'
export const RECOMMENDED_BOOKING_VARIANT: BookingVariant = 'wizard'

// Legacy numeric ids → design ids (forward-compat for already-persisted tenants).
const LEGACY_VARIANTS: Record<string, BookingVariant> = { '3': 'wizard', '4': 'compact' }

// Design metadata — mirrors the handoff super-data SU_VARIANTS exactly.
export const BOOKING_VARIANT_LABELS: Record<BookingVariant, string> = {
  wizard: 'Steg-för-steg',
  compact: 'Snabbboka',
  drawer: 'Drawer',
  inline: 'Inline-sektion',
}
export const BOOKING_VARIANT_TAGS: Record<BookingVariant, string> = {
  wizard: 'Rekommenderad',
  compact: 'Genväg',
  drawer: 'Desktop',
  inline: 'Native',
}
export const BOOKING_VARIANT_DESCRIPTIONS: Record<BookingVariant, string> = {
  wizard: 'Guide i flera steg i en centrerad ruta mitt på skärmen.',
  compact: 'Allt på en skärm i panel från sidan — för stamkunder.',
  drawer: 'Guide i flera steg i panel som glider in från sidan.',
  inline: 'Bokningen ligger inbyggd längst ner på sidan — ingen popup, knapparna scrollar dit.',
}

export function isBookingVariant(v: unknown): v is BookingVariant {
  return typeof v === 'string' && (BOOKING_VARIANTS as readonly string[]).includes(v)
}

/**
 * Read the booking variant out of a tenant's raw `settings` jsonb. Accepts the four
 * design ids directly, maps the legacy numeric ids ('3'/'4') forward, and tolerates
 * a missing/legacy `booking` object or any unknown value → falls back to the default
 * so a tenant never lands on an undefined flow. This is the function M3 should import
 * to resolve the variant on the storefront.
 */
export function readBookingVariant(settings: unknown): BookingVariant {
  if (settings && typeof settings === 'object') {
    const booking = (settings as Record<string, unknown>).booking
    if (booking && typeof booking === 'object') {
      const v = (booking as Record<string, unknown>).variant
      if (isBookingVariant(v)) return v
      if (typeof v === 'string' && v in LEGACY_VARIANTS) return LEGACY_VARIANTS[v]!
    }
  }
  return DEFAULT_BOOKING_VARIANT
}

/**
 * INNEHÅLLS-läget för `<BookingWizard mode={…} />` (guide vs enskärms):
 *   'compact' | 'inline'  → 'compact' (allt staplat i ett svep)
 *   'wizard'  | 'drawer'  → 'wizard'  (guidad steg-för-steg)
 * PRESENTATIONEN (modal/slide-over/inbyggd) styrs separat av varianten i
 * BookingProvider + layout. Okänt/osatt → 'wizard'.
 */
export function readBookingMode(settings: unknown): 'wizard' | 'compact' {
  const v = readBookingVariant(settings)
  return v === 'compact' || v === 'inline' ? 'compact' : 'wizard'
}
