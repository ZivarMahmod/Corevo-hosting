// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalNavigationClient } from './PortalNavigationClient'
import { PortalRouteFocus } from './PortalRouteFocus'

const navigation = vi.hoisted(() => ({ pathname: '/mina' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

let container: HTMLDivElement
let root: Root
let desktop = false
const mediaListeners = new Set<() => void>()

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('customer portal client shell behavior', () => {
  beforeEach(() => {
    desktop = false
    mediaListeners.clear()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        get matches() { return desktop },
        media: '(min-width: 780px)',
        onchange: null,
        addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }),
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  function ShellClients() {
    return (
      <>
        <PortalNavigationClient active="bookings" mode="desktop" />
        <main id="huvudinnehall" tabIndex={-1}><PortalRouteFocus /></main>
        <PortalNavigationClient active="bookings" mode="mobile" />
      </>
    )
  }

  it('keeps exactly one nav landmark while switching between mobile and desktop', async () => {
    await act(async () => root.render(<ShellClients />))
    expect(container.querySelectorAll('nav[aria-label="Huvudmeny"]')).toHaveLength(1)
    expect(container.querySelector('nav')?.className).toBe('cp-bottomnav')

    desktop = true
    await act(async () => mediaListeners.forEach((listener) => listener()))
    expect(container.querySelectorAll('nav[aria-label="Huvudmeny"]')).toHaveLength(1)
    expect(container.querySelector('nav')?.className).toBe('cp-sidenav')
  })

  it('moves focus to main content after route changes', async () => {
    await act(async () => root.render(<ShellClients />))
    expect(document.activeElement).toBe(container.querySelector('main'))

    document.body.focus()
    navigation.pathname = '/mina/historik'
    await act(async () => root.render(<ShellClients />))
    expect(document.activeElement).toBe(container.querySelector('main'))
  })
})
