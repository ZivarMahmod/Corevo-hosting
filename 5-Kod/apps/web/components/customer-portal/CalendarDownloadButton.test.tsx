/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CalendarBookingProvider,
  CalendarDownloadButton,
} from './CalendarDownloadButton'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const otherBookingId = '223e4567-e89b-42d3-a456-426614174000'
const mocks = {
  fetch: vi.fn(),
  createObjectURL: vi.fn(() => 'blob:calendar-file'),
  revokeObjectURL: vi.fn(),
  anchorClick: vi.fn(),
}

const button = () => document.querySelector<HTMLButtonElement>('.cp-calendar-download button')!
const click = (element = button()) => act(() => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})

describe('CalendarDownloadButton', () => {
  let root: Root
  let host: HTMLDivElement

  function renderButton(
    providerBookingId = bookingId,
    forbiddenButtonProps: Record<string, string> = {},
  ) {
    act(() => root.render(
      <CalendarBookingProvider bookingPublicId={providerBookingId}>
        <CalendarDownloadButton {...forbiddenButtonProps} />
      </CalendarBookingProvider>,
    ))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(mocks.createObjectURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mocks.revokeObjectURL)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mocks.anchorClick)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    renderButton()
  })

  afterEach(() => {
    if (host.isConnected) {
      act(() => root.unmount())
      host.remove()
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('locks synchronous double-clicks, downloads once and keeps focus through success', async () => {
    let finish!: (response: Response) => void
    mocks.fetch.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    button().focus()

    click()
    click()

    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.fetch).toHaveBeenCalledWith(
      `/api/customer-portal/bookings/${bookingId}/calendar`,
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(button().textContent).toContain('Hämtar…')
    expect(button().getAttribute('aria-disabled')).toBe('true')
    expect(document.querySelector('.cp-calendar-download')?.getAttribute('data-state'))
      .toBe('calendar_pending')
    expect(document.activeElement).toBe(button())

    await act(async () => finish(new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', {
      status: 200,
      headers: { 'content-type': 'text/calendar; charset=utf-8' },
    })))

    expect(button().textContent).toContain('Lägg i kalender')
    expect(button().hasAttribute('aria-disabled')).toBe(false)
    expect(document.activeElement).toBe(button())
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Kalenderfilen är klar')
    expect(document.querySelector('.cp-calendar-download')?.getAttribute('data-state'))
      .toBe('calendar_success')
    expect(mocks.createObjectURL).toHaveBeenCalledOnce()
    expect(mocks.anchorClick).toHaveBeenCalledOnce()
    const anchor = mocks.anchorClick.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('corevo-bokning.ics')
    expect(anchor.href).toBe('blob:calendar-file')
    expect(document.body.contains(anchor)).toBe(false)

    act(() => vi.advanceTimersByTime(999))
    expect(mocks.revokeObjectURL).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:calendar-file')
  })

  it('shows the exact neutral error and retries on a fresh click', async () => {
    mocks.fetch
      .mockResolvedValueOnce(new Response('Kalenderfilen kunde inte skapas.', { status: 404 }))
      .mockResolvedValueOnce(new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { status: 200 }))

    await act(async () => click())
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Kalenderfilen kunde inte skapas. Försök igen.',
    )
    expect(document.querySelector('.cp-calendar-download')?.getAttribute('data-state'))
      .toBe('calendar_error')
    expect(button().textContent).toContain('Lägg i kalender')

    await act(async () => click())
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Kalenderfilen är klar')
  })

  it('uses the same retryable error for a rejected request', async () => {
    mocks.fetch.mockRejectedValue(new TypeError('network details must stay hidden'))

    await act(async () => click())

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Kalenderfilen kunde inte skapas. Försök igen.',
    )
    expect(document.body.textContent).not.toContain('network details')
    expect(button().hasAttribute('aria-disabled')).toBe(false)
  })

  it('accepts no free booking ID prop and always fetches the booking-bound context ID', async () => {
    // @ts-expect-error Booking identity belongs to CalendarBookingProvider, never the button API.
    const invalidButtonApi = <CalendarDownloadButton bookingPublicId={otherBookingId} />
    expect(invalidButtonApi.props.bookingPublicId).toBe(otherBookingId)

    renderButton(bookingId, { bookingPublicId: otherBookingId })
    mocks.fetch.mockResolvedValue(new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { status: 200 }))

    await act(async () => click())

    expect(mocks.fetch).toHaveBeenCalledWith(
      `/api/customer-portal/bookings/${bookingId}/calendar`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mocks.fetch).not.toHaveBeenCalledWith(
      `/api/customer-portal/bookings/${otherBookingId}/calendar`,
      expect.anything(),
    )
  })

  it('aborts and suppresses a stale download after unmount', async () => {
    let finish!: (response: Response) => void
    const blob = vi.fn(() => Promise.resolve(new Blob(['stale'])))
    mocks.fetch.mockReturnValue(new Promise((resolve) => { finish = resolve }))

    click()
    const signal = mocks.fetch.mock.calls[0]?.[1]?.signal as AbortSignal
    act(() => root.unmount())
    host.remove()

    expect(signal.aborted).toBe(true)
    await act(async () => finish({ ok: true, blob } as unknown as Response))
    expect(blob).not.toHaveBeenCalled()
    expect(mocks.createObjectURL).not.toHaveBeenCalled()
    expect(mocks.anchorClick).not.toHaveBeenCalled()
  })

  it('aborts the previous context and never downloads its stale response', async () => {
    let finishFirst!: (response: Response) => void
    const staleBlob = vi.fn(() => Promise.resolve(new Blob(['stale'])))
    mocks.fetch
      .mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve }))
      .mockResolvedValueOnce(new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { status: 200 }))

    click()
    const firstSignal = mocks.fetch.mock.calls[0]?.[1]?.signal as AbortSignal
    renderButton(otherBookingId)

    expect(firstSignal.aborted).toBe(true)
    await act(async () => finishFirst({ ok: true, blob: staleBlob } as unknown as Response))
    expect(staleBlob).not.toHaveBeenCalled()
    expect(mocks.anchorClick).not.toHaveBeenCalled()

    await act(async () => click())
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      `/api/customer-portal/bookings/${otherBookingId}/calendar`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mocks.anchorClick).toHaveBeenCalledOnce()
  })
})
