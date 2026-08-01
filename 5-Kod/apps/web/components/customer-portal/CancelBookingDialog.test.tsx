/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), refresh: vi.fn() }))
vi.mock('@/app/(customer-portal)/mina/actions', () => ({
  cancelPortalBookingAction: mocks.cancel,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import { PortalBookingCancellation } from './CancelBookingDialog'
import { PortalCancellationFeedbackProvider } from './PortalCancellationFeedback'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const idempotencyKey = '223e4567-e89b-42d3-a456-426614174000'

function button(name: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  if (!match) throw new Error(`button not found: ${name}`)
  return match
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function keydown(key: string, shiftKey = false) {
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
    key, shiftKey, bubbles: true, cancelable: true,
  })))
}

describe('canonical portal cancellation dialog', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(idempotencyKey)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => root.render(
      <PortalCancellationFeedbackProvider>
        <main id="huvudinnehall" tabIndex={-1}>
          <article>
            <h2 data-cancel-focus-target tabIndex={-1}>NÄSTA BOKNING</h2>
            <PortalBookingCancellation
              bookingPublicId={bookingId}
              expectedCutoffHours={24}
              tenantName="FreshCut"
              bookingSummary="onsdag 22 juli · 11:00 — Skäggtrimning hos FreshCut"
              policyText="Kostnadsfri avbokning till tisdag 21 juli 11:00."
              triggerLabel="Avboka"
              blockedContact={{ phone: '+46 70 000 00 00', website: 'https://freshcut.corevo.se' }}
              variant="home"
            />
          </article>
        </main>
      </PortalCancellationFeedbackProvider>,
    ))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('opens the exact modal dialog, keeps destructive scrim clicks inert and returns focus on escape', () => {
    vi.useFakeTimers()
    const trigger = button('Avboka')
    trigger.focus()
    click(trigger)

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-labelledby')).toBe('avboka-titel')
    expect(dialog?.getAttribute('aria-describedby')).toBe('avboka-brod')
    expect(document.getElementById('avboka-titel')?.textContent).toBe('Avboka bokningen?')
    expect(document.getElementById('avboka-brod')?.textContent).toContain(
      'onsdag 22 juli · 11:00 — Skäggtrimning hos FreshCut',
    )
    expect(document.body.textContent).toContain('Kostnadsfri avbokning till tisdag 21 juli 11:00.')
    expect(document.activeElement).toBe(button('Behåll bokningen'))
    expect([...dialog!.querySelectorAll('button')].map((item) => item.textContent?.trim()))
      .toEqual(['', 'Behåll bokningen', 'Ja, avboka'])

    click(document.querySelector('.cp-cancel-scrim')!)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    keydown('Escape')
    expect(document.querySelector('.cp-cancel-layer')?.getAttribute('data-closing')).toBe('true')
    act(() => vi.advanceTimersByTime(139))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('traps tab focus inside the dialog', () => {
    click(button('Avboka'))
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Stäng"]')!
    const destructive = button('Ja, avboka')
    destructive.focus()
    keydown('Tab')
    expect(document.activeElement).toBe(close)
    close.focus()
    keydown('Tab', true)
    expect(document.activeElement).toBe(destructive)
  })

  it('locks every exit while pending and reuses one crypto idempotency key for retry', async () => {
    vi.useFakeTimers()
    let finishFirst!: (value: { outcome: 'unavailable' }) => void
    mocks.cancel
      .mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve }))
      .mockResolvedValueOnce({ outcome: 'success' })

    click(button('Avboka'))
    click(button('Ja, avboka'))
    click(button('Avbokar…'))
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(button('Avbokar…').getAttribute('aria-disabled')).toBe('true')
    expect(button('Behåll bokningen').getAttribute('aria-disabled')).toBe('true')
    expect(document.querySelector('[aria-label="Stäng"]')?.getAttribute('aria-disabled')).toBe('true')
    keydown('Escape')
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()

    await act(async () => finishFirst({ outcome: 'unavailable' }))
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Avbokningen kunde inte genomföras. Din bokning är oförändrad.',
    )
    expect(button('Försök igen')).not.toBeNull()
    expect([...document.querySelectorAll('button')].some((item) => item.textContent === 'Ja, avboka')).toBe(false)

    await act(async () => click(button('Försök igen')))
    expect(mocks.cancel).toHaveBeenCalledTimes(2)
    expect(mocks.cancel.mock.calls[0]?.[0].idempotencyKey).toBe(idempotencyKey)
    expect(mocks.cancel.mock.calls[1]?.[0].idempotencyKey).toBe(idempotencyKey)
    expect(document.querySelector('.cp-cancel-layer')?.getAttribute('data-closing')).toBe('true')
    act(() => vi.advanceTimersByTime(140))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Bokningen är avbokad. FreshCut har fått besked.',
    )
    expect(document.activeElement).toBe(document.getElementById('huvudinnehall'))
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('shows the policy-changed terminal state and the exact detail fallback after close', async () => {
    act(() => root.render(
      <PortalCancellationFeedbackProvider>
        <main id="huvudinnehall" tabIndex={-1}>
          <article>
            <h1 data-cancel-focus-target tabIndex={-1}>onsdag 22 juli · 11:00</h1>
            <PortalBookingCancellation
              bookingPublicId={bookingId}
              expectedCutoffHours={24}
              tenantName="FreshCut"
              bookingSummary="onsdag 22 juli · 11:00 — Skäggtrimning hos FreshCut"
              policyText="Kostnadsfri avbokning till tisdag 21 juli 11:00."
              triggerLabel="Avboka bokningen"
              blockedContact={{ phone: '+46 70 000 00 00', website: 'https://freshcut.corevo.se' }}
              variant="detail"
            />
          </article>
        </main>
      </PortalCancellationFeedbackProvider>,
    ))
    mocks.cancel.mockResolvedValue({ outcome: 'policy_blocked' })
    click(button('Avboka bokningen'))
    await act(async () => click(button('Ja, avboka')))

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Bokningen kan inte längre avbokas online. Din bokning är oförändrad.',
    )
    expect(button('Stäng')).not.toBeNull()
    expect([...document.querySelectorAll('button')].some((item) => item.textContent === 'Ja, avboka')).toBe(false)
    keydown('Escape')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.textContent).toContain(
      'Den här bokningen kan inte längre avbokas online. Ring FreshCut på +46 70 000 00 00.',
    )
    expect(document.querySelector('a[href="tel:+46 70 000 00 00"]')).not.toBeNull()
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('keeps the success toast for at least five seconds and pauses dismissal on hover', async () => {
    vi.useFakeTimers()
    mocks.cancel.mockResolvedValue({ outcome: 'success' })
    click(button('Avboka'))
    await act(async () => click(button('Ja, avboka')))
    act(() => vi.advanceTimersByTime(140))
    const toast = document.querySelector<HTMLElement>('.cp-toast')!
    expect(toast.tabIndex).toBe(0)
    act(() => vi.advanceTimersByTime(5_999))
    expect(document.querySelector('.cp-toast')).toBe(toast)
    act(() => toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    act(() => vi.advanceTimersByTime(10_000))
    expect(document.querySelector('.cp-toast')).toBe(toast)
    act(() => toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    act(() => vi.advanceTimersByTime(6_000))
    expect(document.querySelector('.cp-toast')).toBeNull()
  })
})
