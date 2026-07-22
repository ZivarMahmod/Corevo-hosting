'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import type {
  PortalBookingCursor,
  PortalBookingProjection,
  PortalSessionSnapshot,
} from '@/lib/customer-portal/types'
import { formatPortalBooking, groupPortalHistory } from '@/lib/customer-portal/presentation'
import { BookingStatusChip } from './PortalViews'

type LoadMoreResult =
  | {
      outcome: 'ok'
      items: PortalBookingProjection[]
      hasMore: boolean
      nextCursor: PortalBookingCursor | null
    }
  | { outcome: 'unavailable' }

const locationText = (booking: PortalBookingProjection) =>
  [booking.location?.name, booking.location?.address].filter(Boolean).join(', ') || null

function Chevron() {
  return <svg className="cp-icon cp-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
}

export function BookingHistoryListClient({
  snapshot,
  initialItems,
  initialCursor,
  loadMore,
}: {
  snapshot: PortalSessionSnapshot
  initialItems: PortalBookingProjection[]
  initialCursor: PortalBookingCursor | null
  loadMore: (cursor: PortalBookingCursor) => Promise<LoadMoreResult>
}) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [error, setError] = useState(false)
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null)
  const focusTargetRef = useRef<HTMLAnchorElement>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (focusTargetId) focusTargetRef.current?.focus()
  }, [focusTargetId])

  function requestMore() {
    if (!cursor || isPending) return
    setError(false)
    startTransition(async () => {
      const result = await loadMore(cursor)
      if (result.outcome !== 'ok') {
        setError(true)
        return
      }

      setItems((current) => [...current, ...result.items])
      setCursor(result.hasMore ? result.nextCursor : null)
      if (!result.hasMore) setFocusTargetId(result.items[0]?.id ?? null)
    })
  }

  if (items.length === 0) {
    return <><h1>Historik</h1><section className="cp-card cp-empty"><p>Du har inga tidigare bokningar hos {snapshot.tenantName} ännu.</p></section></>
  }

  const groups = groupPortalHistory(items)
  return (
    <>
      <h1>Historik</h1>
      <div className="cp-history-sections">
        {groups.map((group) => group.items.length > 0 && (
          <section className="cp-booking-list" key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.items.map((item) => {
                const formatted = formatPortalBooking(item, snapshot)
                const location = locationText(item)
                return (
                  <li key={item.id}>
                    <Link
                      className="cp-booking-link"
                      href={`/mina/bokningar/${item.id}`}
                      ref={item.id === focusTargetId ? focusTargetRef : undefined}
                    >
                      <span className="cp-booking-copy">
                        <span>{item.serviceName} — {formatted.historyDate}</span>
                        {item.staffTitle && <small>{item.staffTitle}</small>}
                        {location && <small>{location}</small>}
                        {formatted.price && <small>{formatted.price}</small>}
                      </span>
                      <BookingStatusChip booking={item} />
                      <Chevron />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {cursor && (
        <button
          className="cp-btn cp-history-more"
          type="button"
          aria-disabled={isPending ? 'true' : undefined}
          onClick={requestMore}
        >
          {isPending ? 'Hämtar…' : 'Visa fler'}
        </button>
      )}
      {error && <p className="cp-history-error" role="alert">Fler bokningar kunde inte hämtas. Försök igen.</p>}
    </>
  )
}
