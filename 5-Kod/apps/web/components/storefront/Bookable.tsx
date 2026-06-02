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
}: {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Accessible name for the row (e.g. "Boka — Klippning dam"). */
  label?: string
}) {
  const booking = useBooking()
  const router = useRouter()

  const activate = () => {
    if (booking && booking.available) booking.open()
    else router.push('/boka')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
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
