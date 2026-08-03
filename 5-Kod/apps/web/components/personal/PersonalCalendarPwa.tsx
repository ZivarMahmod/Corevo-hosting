'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StaffScheduleEntry } from '@/lib/personal/calendar'
import { fmtTime } from '@/lib/personal/format'
import { BookingStatusActions } from './BookingStatusActions'
import { ClientCard } from './ClientCard'
import styles from './personal-pwa.module.css'

export type PersonalStaffOption = { id: string; label: string; mine: boolean }

const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 19
const HOUR_PX = 54

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ej bekräftad',
  confirmed: 'Bekräftad',
  completed: 'Genomförd',
  cancelled: 'Avbokad',
  no_show: 'Uteblev',
}

function minuteInCalendarDay(iso: string, day: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).formatToParts(new Date(iso))
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0)
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? 1)
  const date = Number(parts.find((part) => part.type === 'day')?.value ?? 1)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  const target = Date.parse(`${day}T00:00:00Z`)
  const local = Date.UTC(year, month - 1, date)
  return Math.round((local - target) / 86_400_000) * 1440 + hour * 60 + minute
}

function bookingMinutes(booking: StaffScheduleEntry, day: string) {
  return {
    start: Math.max(0, minuteInCalendarDay(booking.startTs, day, booking.timeZone)),
    end: Math.min(1440, minuteInCalendarDay(booking.endTs, day, booking.timeZone)),
  }
}

export function calendarHourRange(bookings: StaffScheduleEntry[], day: string): { startHour: number; endHour: number } {
  let earliest = DEFAULT_START_HOUR * 60
  let latest = DEFAULT_END_HOUR * 60
  for (const booking of bookings) {
    const { start, end } = bookingMinutes(booking, day)
    earliest = Math.min(earliest, start)
    latest = Math.max(latest, end)
  }
  return {
    startHour: Math.max(0, Math.floor(earliest / 60)),
    endHour: Math.min(24, Math.ceil(latest / 60)),
  }
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
  const sheetRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const selected = useMemo(() => bookings.find((booking) => booking.id === selectedId) ?? null, [bookings, selectedId])
  const selectedBookingId = selected?.id
  const { startHour, endHour } = calendarHourRange(bookings, day)
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index)

  useEffect(() => {
    if (!selectedBookingId) return
    const sheet = sheetRef.current
    const returnFocus = returnFocusRef.current
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const focusable = () => [...(sheet?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelectedId(null)
        return
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      const first = controls[0]
      const last = controls.at(-1)
      if (!first || !last) {
        event.preventDefault()
      } else if (!sheet?.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    ;(focusable()[0] ?? sheet)?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (returnFocus?.isConnected) returnFocus.focus()
      returnFocusRef.current = null
    }
  }, [selectedBookingId])

  return (
    <section className={styles.calendarScreen} data-accept="personal-calendar">
      <header className={styles.calendarHeader}>
        <div><h1>{heading}</h1><p>{ownCalendar ? 'MINA BOKNINGAR' : 'BOKNINGAR'} · {bookings.length} {todayHref ? 'DEN HÄR DAGEN' : 'IDAG'}</p></div>
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
        <div className={styles.timeline} style={{ height: (endHour - startHour) * HOUR_PX }}>
          <div className={styles.times}>
            {hours.map((hour) => <span key={hour} style={{ top: (hour - startHour) * HOUR_PX - 7 }}>{String(hour).padStart(2, '0')}:00</span>)}
          </div>
          <div className={styles.grid}>
            {bookings.map((booking) => {
              const { start, end } = bookingMinutes(booking, day)
              const top = Math.max(0, ((start - startHour * 60) / 60) * HOUR_PX)
              const height = Math.max(34, ((end - start) / 60) * HOUR_PX)
              return (
                <button
                  key={booking.id}
                  type="button"
                  className={`${styles.bookingBlock} ${booking.status === 'completed' ? styles.bookingDone : ''} ${booking.status === 'cancelled' ? styles.bookingCancelled : ''}`}
                  style={{ top, height }}
                  onClick={(event) => {
                    returnFocusRef.current = event.currentTarget
                    setSelectedId(booking.id)
                  }}
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
          <section ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label="Bokning" tabIndex={-1}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetMeta}><span><i />{ownCalendar ? 'din bokning' : 'bokning'} · {day}</span><button type="button" aria-label="Stäng bokning" onClick={() => setSelectedId(null)}>✕</button></div>
            <div className={styles.sheetTitle}><strong>{fmtTime(selected.startTs, selected.timeZone)}</strong><span>{selected.serviceName ?? 'Bokning'}</span></div>
            <div className={styles.sheetCustomer}>
              {selected.customerId ? <ClientCard customerId={selected.customerId} locationId={selected.locationId} label={selected.customerLabel} bookingNote={selected.customerNote} /> : selected.customerLabel}
            </div>
            {ownCalendar && (selected.status === 'pending' || selected.status === 'confirmed') ? (
              <BookingStatusActions
                bookingId={selected.id}
                timeZone={selected.timeZone}
                endTs={selected.endTs}
              />
            ) : <p className={styles.sheetState}>Status: {STATUS_LABELS[selected.status] ?? 'Okänd status'}</p>}
          </section>
        </div>
      ) : null}
    </section>
  )
}
