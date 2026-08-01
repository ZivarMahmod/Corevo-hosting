'use client'

import { useRouter } from 'next/navigation'
import type { ElementType, ReactNode, KeyboardEvent } from 'react'
import { useBooking } from './BookingProvider'

/**
 * Click-to-book wrapper for whole rows / cards (service rows, price-list lines,
 * service cards). Layouts are server components and cannot attach onClick, so any
 * "click the row to book" affordance routes through this tiny client wrapper.
 *
 * Behaviour mirrors <BookCta>: when a BookingProvider with bookable services is
 * mounted it opens the in-page drawer; otherwise it navigates to the /boka route
 * (which renders its own empty state when there's nothing to book). Keyboard
 * accessible (role=button, Enter/Space) with a real focus ring.
 */
export function Bookable({
  children,
  as: Tag = 'div',
  className,
  label = 'Boka tid',
  enabled = true,
}: {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Accessible name for the row (e.g. "Boka — Klippning dam"). */
  label?: string
  enabled?: boolean
}) {
  const booking = useBooking()
  const router = useRouter()

  const activate = () => {
    if (booking) {
      if (booking.available) booking.open()
      else if (booking.reachable) router.push('/boka')
      return
    }
    router.push('/boka')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
  }

  const canUseExternal = Boolean(booking?.websiteOnly && booking.externalUrl)

  if (!enabled && !canUseExternal) {
    return (
      <Tag className={className} aria-disabled="true">
        {children}
      </Tag>
    )
  }

  if (booking && !booking.reachable) {
    return booking.websiteOnly && booking.externalUrl ? (
      <a
        href={booking.externalUrl}
        className={className}
        aria-label={label}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ) : (
      <Tag className={className} aria-disabled="true">
        {children}
      </Tag>
    )
  }

  return (
    <Tag
      className={className}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {children}
    </Tag>
  )
}
