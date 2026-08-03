// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaffScheduleEntry } from '@/lib/personal/calendar'

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
vi.mock('./BookingStatusActions', () => ({ BookingStatusActions: () => <button type="button">Ändra status</button> }))
vi.mock('./ClientCard', () => ({ ClientCard: () => <span>Kundkort</span> }))

import { calendarHourRange, PersonalCalendarPwa } from './PersonalCalendarPwa'

let container: HTMLDivElement
let root: Root

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const booking = (overrides: Partial<StaffScheduleEntry> = {}): StaffScheduleEntry => ({
  id: 'booking-1',
  status: 'confirmed',
  startTs: '2026-08-03T08:00:00Z',
  endTs: '2026-08-03T09:00:00Z',
  priceCents: 50000,
  staffId: 'staff-1',
  serviceId: 'service-1',
  serviceName: 'Klippning',
  locationId: 'location-1',
  customerId: null,
  customerLabel: 'Testkund',
  note: null,
  timeZone: 'UTC',
  customerPrefs: [],
  customerNote: null,
  ...overrides,
})

describe('PersonalCalendarPwa booking sheet', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('traps focus, closes on Escape and restores the booking trigger', async () => {
    await act(async () => root.render(
      <PersonalCalendarPwa
        heading="Måndag"
        day="2026-08-03"
        previousDay="2026-08-02"
        nextDay="2026-08-04"
        todayHref={null}
        bookings={[booking()]}
        staff={[]}
        selectedStaffId="staff-1"
        canViewAllCalendars={false}
        ownCalendar
      />,
    ))

    const trigger = container.querySelector<HTMLButtonElement>('button')!
    trigger.focus()
    await act(async () => trigger.click())

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    const controls = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
    expect(dialog.textContent).toContain('Ändra status')
    expect(document.activeElement).toBe(controls[0])

    controls[0]!.focus()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(controls.at(-1))

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('does not show mutation actions for a colleague booking', async () => {
    await act(async () => root.render(
      <PersonalCalendarPwa
        heading="Måndag"
        day="2026-08-03"
        previousDay="2026-08-02"
        nextDay="2026-08-04"
        todayHref={null}
        bookings={[booking()]}
        staff={[]}
        selectedStaffId="staff-1"
        canViewAllCalendars
        ownCalendar={false}
      />,
    ))

    const trigger = container.querySelector<HTMLButtonElement>('button')!
    await act(async () => trigger.click())

    expect(container.textContent).not.toContain('Ändra status')
    expect(container.textContent).toContain('Status: Bekräftad')
  })
})

describe('calendarHourRange', () => {
  it('expands the timeline to include early and late bookings', () => {
    expect(calendarHourRange([
      booking({ id: 'early', startTs: '2026-08-03T06:15:00Z', endTs: '2026-08-03T07:00:00Z' }),
      booking({ id: 'late', startTs: '2026-08-03T21:30:00Z', endTs: '2026-08-03T22:30:00Z' }),
    ], '2026-08-03')).toEqual({ startHour: 6, endHour: 23 })
  })

  it('clips bookings that cross either edge of the selected day', () => {
    expect(calendarHourRange([
      booking({ id: 'from-yesterday', startTs: '2026-08-02T23:30:00Z', endTs: '2026-08-03T00:30:00Z' }),
      booking({ id: 'to-tomorrow', startTs: '2026-08-03T23:30:00Z', endTs: '2026-08-04T00:30:00Z' }),
    ], '2026-08-03')).toEqual({ startHour: 0, endHour: 24 })
  })
})
