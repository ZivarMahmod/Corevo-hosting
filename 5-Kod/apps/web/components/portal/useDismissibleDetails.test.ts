import { describe, expect, it, vi } from 'vitest'
import { closeOpenPortalDetails, dismissPortalDetailsOnEscape } from './useDismissibleDetails'

describe('portal details coordination', () => {
  it('closes every open portal details except the one being opened', () => {
    const account = { open: true }
    const desktopLocation = { open: true }
    const mobileLocation = { open: true }

    closeOpenPortalDetails([account, desktopLocation, mobileLocation], mobileLocation)

    expect(account.open).toBe(false)
    expect(desktopLocation.open).toBe(false)
    expect(mobileLocation.open).toBe(true)
  })

  it('consumes Escape before a parent modal and restores summary focus', () => {
    const focus = vi.fn()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const details = {
      open: true,
      querySelector: vi.fn(() => ({ focus })),
    }

    const dismissed = dismissPortalDetailsOnEscape(
      { key: 'Escape', preventDefault, stopPropagation },
      details,
    )

    expect(dismissed).toBe(true)
    expect(details.open).toBe(false)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledOnce()
  })

  it('leaves non-Escape keys untouched', () => {
    const details = {
      open: true,
      querySelector: vi.fn(() => ({ focus: vi.fn() })),
    }
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()

    const dismissed = dismissPortalDetailsOnEscape(
      { key: 'Enter', preventDefault, stopPropagation },
      details,
    )

    expect(dismissed).toBe(false)
    expect(details.open).toBe(true)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(stopPropagation).not.toHaveBeenCalled()
  })
})
