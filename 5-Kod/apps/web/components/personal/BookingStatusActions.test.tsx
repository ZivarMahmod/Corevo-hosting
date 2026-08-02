/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({ cancel: vi.fn(), status: vi.fn(), rebook: vi.fn() }))
vi.mock('@/lib/personal/actions', () => ({
  cancelOwnBooking: actions.cancel,
  setBookingStatus: actions.status,
  rebookOwnBooking: actions.rebook,
}))

import { BookingStatusActions } from './BookingStatusActions'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('BookingStatusActions cancellation', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('requires an explicit confirmation before cancellation can submit', () => {
    act(() => root.render(
      <BookingStatusActions
        bookingId="booking-1"
        timeZone="UTC"
        endTs={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      />,
    ))
    const cancel = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Avboka')!
    expect(cancel.type).toBe('button')

    act(() => cancel.click())

    const confirm = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Ja, avboka')!
    expect(confirm.type).toBe('submit')
    expect(host.textContent).toContain('Behåll tiden')
    expect(actions.cancel).not.toHaveBeenCalled()
  })
})
