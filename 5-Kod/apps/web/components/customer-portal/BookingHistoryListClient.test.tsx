// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'
import { BookingHistoryListClient } from './BookingHistoryListClient'

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut', tenantName: 'FreshCut', logoUrl: null,
  verticalLabel: 'Frisörsalong', phone: null, address: null, mapUrl: null,
  bookingOrigin: 'https://freshcut.corevo.se', timezone: 'Europe/Stockholm', locale: 'sv-SE',
  defaultCountry: 'SE', currency: 'SEK', cancellationCutoffHours: 24, customerName: 'Alex',
  lastSeenAt: '2026-07-22T12:00:00.000Z', absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
}

const booking = (id: string, serviceName: string): PortalBookingProjection => ({
  id, startTs: '2026-06-10T12:30:00.000Z', endTs: '2026-06-10T13:00:00.000Z',
  status: 'completed', presentationStatus: 'completed', serviceName, durationMinutes: 30,
  staffTitle: null, location: null, priceCents: null, currency: 'SEK', canCancel: false,
  cancelDeadline: null, publicRebookUrl: null,
})

const first = booking('123e4567-e89b-42d3-a456-426614174000', 'Första besöket')
const second = booking('223e4567-e89b-42d3-a456-426614174000', 'Andra besöket')
let container: HTMLDivElement
let root: Root

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('BookingHistoryListClient', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('keeps existing rows, announces pending/failure, and restores the same retry button', async () => {
    let resolveLoad: (value: { outcome: 'unavailable' }) => void = () => undefined
    const loadMore = vi.fn(() => new Promise<{ outcome: 'unavailable' }>((resolve) => {
      resolveLoad = resolve
    }))
    await act(async () => root.render(
      <BookingHistoryListClient
        snapshot={snapshot}
        initialItems={[first]}
        initialCursor={{ startTs: first.startTs, id: first.id }}
        loadMore={loadMore}
      />,
    ))

    const button = container.querySelector<HTMLButtonElement>('button')!
    button.focus()
    act(() => button.click())
    await act(async () => Promise.resolve())
    expect(button.textContent).toBe('Hämtar…')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(container.textContent).toContain('Första besöket')

    await act(async () => resolveLoad({ outcome: 'unavailable' }))
    expect(container.textContent).toContain('Fler bokningar kunde inte hämtas. Försök igen.')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Första besöket')
    expect(button.textContent).toBe('Visa fler')
    expect(document.activeElement).toBe(button)
  })

  it('locks rapid duplicate clicks and maps a rejected action to the intact canonical error state', async () => {
    let rejectLoad: (reason?: unknown) => void = () => undefined
    const loadMore = vi.fn(() => new Promise<never>((_resolve, reject) => {
      rejectLoad = reject
    }))
    await act(async () => root.render(
      <BookingHistoryListClient
        snapshot={snapshot}
        initialItems={[first]}
        initialCursor={{ startTs: first.startTs, id: first.id }}
        loadMore={loadMore}
      />,
    ))

    const button = container.querySelector<HTMLButtonElement>('button')!
    button.focus()
    act(() => {
      button.click()
      button.click()
    })
    expect(loadMore).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)

    await act(async () => rejectLoad(new Error('network rejected')))
    expect(container.textContent).toContain('Fler bokningar kunde inte hämtas. Försök igen.')
    expect(container.textContent).toContain('Första besöket')
    expect(button.disabled).toBe(false)
    expect(document.activeElement).toBe(button)
  })

  it('appends the next page and focuses its first row when the button disappears', async () => {
    const loadMore = vi.fn(async () => ({
      outcome: 'ok' as const,
      items: [second],
      hasMore: false,
      nextCursor: null,
    }))
    await act(async () => root.render(
      <BookingHistoryListClient
        snapshot={snapshot}
        initialItems={[first]}
        initialCursor={{ startTs: first.startTs, id: first.id }}
        loadMore={loadMore}
      />,
    ))

    const button = container.querySelector<HTMLButtonElement>('button')!
    button.focus()
    await act(async () => button.click())

    expect(container.textContent).toContain('Första besöket')
    expect(container.textContent).toContain('Andra besöket')
    expect(container.querySelector('button')).toBeNull()
    expect(document.activeElement?.textContent).toContain('Andra besöket')
  })
})
