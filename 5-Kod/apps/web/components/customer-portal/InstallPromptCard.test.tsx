/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallPromptCard } from './InstallPromptCard'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('InstallPromptCard', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Android Chrome/140.0.0.0 Mobile',
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  it('never invokes the native install prompt before the customer clicks the real CTA', async () => {
    const prompt = vi.fn(async () => undefined)
    const installEvent = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })

    await act(async () => root.render(<InstallPromptCard placement="auto" />))
    act(() => window.dispatchEvent(installEvent))

    expect(prompt).not.toHaveBeenCalled()
    const button = [...host.querySelectorAll('button')]
      .find((candidate) => candidate.textContent === 'Lägg på hemskärmen')
    expect(button).toBeDefined()

    await act(async () => button?.click())
    expect(prompt).toHaveBeenCalledOnce()
    expect(host.textContent).not.toContain('Ha dina bokningar nära till hands')
  })
})
