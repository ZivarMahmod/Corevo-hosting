'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { StaffScheduleEntry } from '@/lib/personal/calendar'
import { fmtTime } from '@/lib/personal/format'
import { BookingStatusActions } from './BookingStatusActions'
import { ClientCard } from './ClientCard'
import styles from './personal-pwa.module.css'

export type PersonalStaffOption = { id: string; label: string; mine: boolean }

const START_HOUR = 8
const END_HOUR = 19
const HOUR_PX = 54

function minuteOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export function PersonalCalendarPwa({
  heading,
  day,
  previousDay,
  nextDay,
  todayHref,
  bookings,
  staff,
  selectedStaffId,
  canViewAllCalendars,
  ownCalendar,
}: {
  heading: string
  day: string
  previousDay: string
  nextDay: string
  todayHref: string | null
  bookings: StaffScheduleEntry[]
  staff: PersonalStaffOption[]
  selectedStaffId: string
  canViewAllCalendars: boolean
  ownCalendar: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => bookings.find((booking) => booking.id === selectedId) ?? null, [bookings, selectedId])
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index)

  return (
    <section className={styles.calendarScreen} data-accept="personal-calendar">
      <header className={styles.calendarHeader}>
        <div><h1>{heading}</h1><p>{ownCalendar ? 'MINA BOKNINGAR' : 'BOKNINGAR'} · {bookings.length} IDAG</p></div>
        <div className={styles.dayControls}>
          <Link href={`/personal?dag=${previousDay}&personal=${selectedStaffId}`} aria-label="Föregående dag">‹</Link>
          <Link href={`/personal?dag=${nextDay}&personal=${selectedStaffId}`} aria-label="Nästa dag">›</Link>
        </div>
      </header>

      {todayHref ? <Link href={todayHref} className={styles.todayLink}>Till idag</Link> : null}

      {canViewAllCalendars && staff.length > 1 ? (
        <div className={styles.staffChips} aria-label="Kalender">
          {staff.map((member) => (
            <Link
              key={member.id}
              href={`/personal?dag=${day}&personal=${member.id}`}
              className={member.id === selectedStaffId ? styles.staffChipActive : undefined}
            >
              <span>{member.label.slice(0, 1).toUpperCase()}</span>{member.mine ? 'Jag' : member.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className={styles.timelineScroll}>
        <div className={styles.timeline} style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
          <div className={styles.times}>
            {hours.map((hour) => <span key={hour} style={{ top: (hour - START_HOUR) * HOUR_PX - 7 }}>{String(hour).padStart(2, '0')}:00</span>)}
          </div>
          <div className={styles.grid}>
            {bookings.map((booking) => {
              const start = minuteOfDay(booking.startTs, booking.timeZone)
              const end = minuteOfDay(booking.endTs, booking.timeZone)
              const top = Math.max(0, ((start - START_HOUR * 60) / 60) * HOUR_PX)
              const height = Math.max(34, ((end - start) / 60) * HOUR_PX)
              return (
                <button
                  key={booking.id}
                  type="button"
                  className={`${styles.bookingBlock} ${booking.status === 'completed' ? styles.bookingDone : ''} ${booking.status === 'cancelled' ? styles.bookingCancelled : ''}`}
                  style={{ top, height }}
                  onClick={() => setSelectedId(booking.id)}
                >
                  <strong>{fmtTime(booking.startTs, booking.timeZone)} · {booking.customerLabel}</strong>
                  <span>{booking.serviceName ?? 'Bokning'}</span>
                </button>
              )
            })}
          </div>
        </div>
        {bookings.length === 0 ? <p className={styles.noBookings}>Inga bokningar den här dagen.</p> : null}
      </div>

      {selected ? (
        <div className={styles.sheetLayer} data-accept="booking-sheet">
          <button className={styles.sheetBackdrop} type="button" aria-label="Stäng" onClick={() => setSelectedId(null)} />
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-label="Bokning">
            <div className={styles.sheetHandle} />
            <div className={styles.sheetMeta}><span><i />{ownCalendar ? 'din bokning' : 'bokning'} · {day}</span><button type="button" onClick={() => setSelectedId(null)}>✕</button></div>
            <div className={styles.sheetTitle}><strong>{fmtTime(selected.startTs, selected.timeZone)}</strong><span>{selected.serviceName ?? 'Bokning'}</span></div>
            <div className={styles.sheetCustomer}>
              {selected.customerId ? <ClientCard customerId={selected.customerId} locationId={selected.locationId} label={selected.customerLabel} bookingNote={selected.customerNote} /> : selected.customerLabel}
            </div>
            {(selected.status === 'pending' || selected.status === 'confirmed') ? (
              <BookingStatusActions
                bookingId={selected.id}
                timeZone={selected.timeZone}
                endTs={selected.endTs}
              />
            ) : <p className={styles.sheetState}>Status: {selected.status}</p>}
          </section>
        </div>
      ) : null}
    </section>
  )
}
