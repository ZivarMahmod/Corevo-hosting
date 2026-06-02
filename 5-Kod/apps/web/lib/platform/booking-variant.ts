// Booking-vy-val per tenant (M7 §2.4) — the storefront booking experience Zivar
// picks for each salon during onboarding / in tenant-detail.
//
// CONTRACT FOR M3: the chosen variant is persisted at
//   tenant_settings.settings.booking.variant  →  '3' | '4'
// M3/storefront reads it directly from the raw `settings` jsonb (the same raw-read
// seam getGoogleReviewUrl uses), NOT from the frozen parseSettings()/getTenantBySlug
// bundle. Use `readBookingVariant(settings)` below so the parse + default live in
// ONE place that M3 imports — keep the storage key in sync everywhere.
//
// Held DELIBERATELY apart from settings.layout.{nav,hero}_variant, which is the
// storefront LAYOUT template (nav/hero look), not the booking flow.
//
//   Variant 3 (default) — full guided wizard (steg-för-steg: tjänst → personal →
//                         tid → uppgifter). The standard Corevo booking experience.
//   Variant 4           — snabbboka (compact "pick a time fast" flow for salons
//                         that want the shortest path to a booked slot).

export const BOOKING_VARIANTS = ['3', '4'] as const
export type BookingVariant = (typeof BOOKING_VARIANTS)[number]

export const DEFAULT_BOOKING_VARIANT: BookingVariant = '3'

export const BOOKING_VARIANT_LABELS: Record<BookingVariant, string> = {
  '3': 'Variant 3 — Guidad bokning (standard)',
  '4': 'Variant 4 — Snabbboka',
}

export const BOOKING_VARIANT_DESCRIPTIONS: Record<BookingVariant, string> = {
  '3': 'Steg-för-steg: tjänst → personal → tid → uppgifter. Standardupplevelsen.',
  '4': 'Kompakt flöde — kunden väljer tid snabbt med minsta möjliga steg.',
}

export function isBookingVariant(v: unknown): v is BookingVariant {
  return typeof v === 'string' && (BOOKING_VARIANTS as readonly string[]).includes(v)
}

/**
 * Read the booking variant out of a tenant's raw `settings` jsonb. Tolerates a
 * missing/legacy `booking` object and any unknown value → falls back to the
 * default so a tenant never lands on an undefined flow. This is the function M3
 * should import to resolve the variant on the storefront.
 */
export function readBookingVariant(settings: unknown): BookingVariant {
  if (settings && typeof settings === 'object') {
    const booking = (settings as Record<string, unknown>).booking
    if (booking && typeof booking === 'object') {
      const v = (booking as Record<string, unknown>).variant
      if (isBookingVariant(v)) return v
    }
  }
  return DEFAULT_BOOKING_VARIANT
}

/**
 * Storefront-facing presentation mode for `<BookingWizard mode={…} />`. The DB
 * persists the variant as '3' | '4'; the component takes 'wizard' | 'compact'.
 * This is the ONE place that bridges the two so the mapping never drifts:
 *   '3' (default) → 'wizard'  (full guided steg-för-steg)
 *   '4'           → 'compact' (snabbboka, allt på en skärm)
 * Anything missing/unknown resolves to '3' via readBookingVariant → 'wizard',
 * i.e. EXACTLY today's default flow (no behaviour change for unset tenants).
 */
export function readBookingMode(settings: unknown): 'wizard' | 'compact' {
  return readBookingVariant(settings) === '4' ? 'compact' : 'wizard'
}
