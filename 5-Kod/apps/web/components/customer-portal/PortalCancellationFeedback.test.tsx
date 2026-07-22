/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/(customer-portal)/mina/actions', () => ({
  cancelPortalBookingAction: mocks.cancel,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/mina/bokningar/123e4567-e89b-42d3-a456-426614174000',
  useRouter: () => ({ refresh: mocks.refresh }),
}))

import { PortalShell } from './PortalShell'
import { BookingDetail } from './PortalViews'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut', tenantName: 'FreshCut', logoUrl: null,
  verticalLabel: 'Frisörsalong', phone: '+4613123456', address: 'Testgatan 1', mapUrl: null,
  bookingOrigin: 'https://freshcut.corevo.se', timezone: 'Europe/Stockholm', locale: 'sv-SE',
  defaultCountry: 'SE', currency: 'SEK', cancellationCutoffHours: 24, customerName: 'Alex',
  lastSeenAt: '2026-07-22T12:00:00.000Z', absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
}

const active: PortalBookingProjection = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  startTs: '2099-08-23T12:30:00.000Z', endTs: '2099-08-23T13:00:00.000Z',
  status: 'confirmed', presentationStatus: 'confirmed', serviceName: 'Klippning',
  durationMinutes: 30, staffTitle: 'Sam', location: null, priceCents: 32900, currency: 'SEK',
  canCancel: true, cancelDeadline: '2099-08-22T12:30:00.000Z', publicRebookUrl: null,
}

function clickByText(text: string) {
  const button = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === text)
  if (!button) throw new Error(`button missing: ${text}`)
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function PortalRender({ cancelled }: { cancelled: boolean }) {
  const booking = cancelled ? {
    ...active,
    status: 'cancelled',
    presentationStatus: 'cancelled' as const,
    canCancel: false,
  } : active
  return (
    <PortalShell active="bookings" customerName="Alex">
      <BookingDetail snapshot={snapshot} booking={booking} />
    </PortalShell>
  )
}

describe('stable portal cancellation feedback host', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('223e4567-e89b-42d3-a456-426614174000')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('survives active-to-cancelled RSC-like child replacement with toast and valid focus', async () => {
    mocks.cancel.mockResolvedValue({ outcome: 'success' })
    act(() => root.render(<PortalRender cancelled={false} />))
    clickByText('Avboka bokningen')
    await act(async () => clickByText('Ja, avboka'))

    expect(document.querySelector('.cp-cancel-layer')?.getAttribute('data-closing')).toBe('true')
    expect(document.querySelector('.cp-cancel-toast')).toBeNull()
    expect(mocks.refresh).not.toHaveBeenCalled()

    // Simulate an unrelated RSC child replacement while the dialog still exits.
    // The stable PortalShell host must already own the pending success.
    act(() => root.render(<PortalRender cancelled />))
    expect(document.body.textContent).toContain('Avbokad')
    expect([...document.querySelectorAll('button')].some((button) =>
      button.textContent?.includes('Avboka bokningen'))).toBe(false)
    expect(document.querySelector('.cp-cancel-toast')).toBeNull()

    act(() => vi.advanceTimersByTime(139))
    expect(document.querySelector('.cp-cancel-toast')).toBeNull()
    expect(mocks.refresh).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(mocks.refresh).toHaveBeenCalledOnce()

    const toast = document.querySelector<HTMLElement>('.cp-cancel-toast')
    expect(toast?.textContent).toContain('Bokningen är avbokad. FreshCut har fått besked.')
    expect(toast?.tabIndex).toBe(0)
    expect(document.activeElement).toBe(document.getElementById('huvudinnehall'))

    act(() => vi.advanceTimersByTime(5_999))
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(document.querySelector('.cp-cancel-toast')).toBe(toast)
    act(() => toast!.focus())
    act(() => vi.advanceTimersByTime(10_000))
    expect(document.querySelector('.cp-cancel-toast')).toBe(toast)
    act(() => toast!.blur())
    act(() => vi.advanceTimersByTime(6_000))
    expect(document.querySelector('.cp-cancel-toast')).toBeNull()
  })

  it('uses a 0ms close when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
    act(() => root.render(<PortalRender cancelled={false} />))
    clickByText('Avboka bokningen')
    clickByText('Behåll bokningen')
    act(() => vi.advanceTimersByTime(0))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
