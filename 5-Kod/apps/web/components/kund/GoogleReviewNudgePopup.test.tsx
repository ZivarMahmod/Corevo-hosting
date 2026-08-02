/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleReviewNudgePopup } from './GoogleReviewNudgePopup'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('GoogleReviewNudgePopup', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('moves focus into the dialog and closes on Escape', () => {
    const otherDialog = document.createElement('div')
    otherDialog.setAttribute('role', 'dialog')
    otherDialog.innerHTML = '<button>Cookieval</button>'
    document.body.append(otherDialog)
    act(() => root.render(
      <GoogleReviewNudgePopup reviewUrl="https://example.com" tenantName="Salongen" bookingId="booking-1" />,
    ))
    act(() => vi.advanceTimersByTime(900))

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Stäng')
    const popup = document.getElementById('review-nudge-title')!.closest('[role="dialog"]')!
    const lastPopupControl = [...popup.querySelectorAll<HTMLElement>('button, a[href]')].at(-1)!
    lastPopupControl.focus()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Stäng')
    expect(document.activeElement?.textContent).not.toBe('Cookieval')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.getElementById('review-nudge-title')).toBeNull()
    otherDialog.remove()
  })
})
