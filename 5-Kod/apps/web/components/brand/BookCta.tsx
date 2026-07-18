'use client'

import Link from 'next/link'
import { useBooking } from '@/components/storefront/BookingProvider'

/** "Boka tid" — the entry into the booking engine.
 *
 *  In-page embed (Zivar's #1): when a BookingProvider is mounted (the whole
 *  storefront shell is wrapped in one), this opens the slide-over booking drawer
 *  IN-PAGE — the customer never leaves the salon's site. Every "Boka tid" (nav,
 *  hero, closing section, footer) shares the same drawer.
 *
 *  Fallback: with no provider (e.g. the standalone `/boka` route) it renders a
 *  real <Link href="/boka">, so the route keeps working.
 *
 *  Accent pill (.btn-accent). In back-office .btn-accent is the FROZEN Corevo gold
 *  (hardcoded in portal-global.css, never tenant-tinted). On the storefront
 *  --color-accent is re-pointed to the theme's own --color-primary (never Corevo
 *  gold — a brand leak), and a tenant's branding.color_accent still overrides it
 *  via injectTenantTokens — so this CTA reads as the salon's accent on their site
 *  and as the Corevo gold default everywhere in back-office.
 *
 *  Rendered as a <button> (not an <a>) when embedded, which also removes the only
 *  anchor inside the various `<p>`/CTA wrappers — no nested-anchor / block-in-p
 *  invalid nesting (React #418-safe).
 */
export function BookCta({
  className = '',
  label = 'Boka tid',
  enabled = true,
}: {
  className?: string
  label?: string
  enabled?: boolean
}) {
  const booking = useBooking()
  const cls = `btn-accent${className ? ` ${className}` : ''}`

  // Embedded: open the in-page drawer. Only when the salon actually has services
  // to book; otherwise fall through to the /boka route which renders its own
  // friendly empty state.
  if (!enabled || (booking && !booking.reachable)) {
    return (
      <span className={cls} aria-disabled="true">
        {label}
      </span>
    )
  }

  if (booking?.available) {
    return (
      <button type="button" className={cls} onClick={booking.open}>
        {label}
      </button>
    )
  }

  return (
    <Link href="/boka" className={cls}>
      {label}
    </Link>
  )
}
