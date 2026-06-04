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
//   wizard (default) — guidad steg-för-steg (tjänst → personal → tid → uppgifter).
//   compact          — snabbboka (kompakt "välj tid snabbt"-flöde).
//   drawer / inline  — PRESENTATION-DEFERRED: design-faithful choices the operator
//                      can pick today; M3 renders them as the guided wizard until the
//                      booking engine implements the distinct slide-over / scroll-in
//                      presentations (readBookingMode resolves both → 'wizard'), so a
//                      pick is always honoured by a working flow.

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
  wizard: 'En sak per skärm, störst träffyta. Bäst på mobil (99% av bokningar).',
  compact: 'Kompakt — för stamkunder som vet vad de vill.',
  drawer: "Bokningen glider in 'inuti' sidan. Snyggast på desktop.",
  inline: 'Scrollar in i sidan, allt staplat i ett svep.',
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
 * Storefront-facing presentation mode for `<BookingWizard mode={…} />`. The DB
 * persists one of the four design ids; the component takes 'wizard' | 'compact'.
 * This is the ONE place that bridges the two so the mapping never drifts:
 *   'compact'                  → 'compact' (snabbboka, allt på en skärm)
 *   'wizard' | 'drawer' | 'inline' → 'wizard' (guidad steg-för-steg)
 * Anything missing/unknown resolves to 'wizard', i.e. EXACTLY today's default flow
 * (no behaviour change for unset/legacy tenants — legacy '4' still → 'compact').
 */
export function readBookingMode(settings: unknown): 'wizard' | 'compact' {
  return readBookingVariant(settings) === 'compact' ? 'compact' : 'wizard'
}
