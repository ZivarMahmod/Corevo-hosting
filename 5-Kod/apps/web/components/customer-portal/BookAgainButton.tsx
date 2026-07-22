'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { buildPortalRebookUrl } from '@/lib/customer-portal/rebook'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'

type BookAgainLabel = 'Boka en tid till' | 'Boka ny tid' | 'Boka igen'
type BookAgainVariant = 'primary' | 'secondary'

const BookAgainHrefContext = createContext<string | null>(null)

export function BookAgainProvider({
  snapshot,
  booking,
  children,
}: {
  snapshot: Pick<PortalSessionSnapshot, 'tenantSlug' | 'bookingOrigin'>
  booking?: Pick<PortalBookingProjection, 'publicRebookUrl'>
  children: ReactNode
}) {
  const href = buildPortalRebookUrl({
    tenantSlug: snapshot.tenantSlug,
    bookingOrigin: snapshot.bookingOrigin,
    ...(booking ? { bookingUrl: booking.publicRebookUrl } : {}),
  })
  return <BookAgainHrefContext.Provider value={href}>{children}</BookAgainHrefContext.Provider>
}

export function BookAgainButton({
  label,
  variant = 'secondary',
}: {
  label: BookAgainLabel
  variant?: BookAgainVariant
}) {
  const href = useContext(BookAgainHrefContext)
  if (!href) return null

  return (
    <a
      className={`cp-btn${variant === 'primary' ? ' cp-btn-primary' : ''}`}
      href={href}
      rel="noopener"
    >
      {label}
    </a>
  )
}
