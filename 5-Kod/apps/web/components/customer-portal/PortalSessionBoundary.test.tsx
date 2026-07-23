/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mocks = vi.hoisted(() => ({ logout: vi.fn(), replace: vi.fn() }))
vi.mock('@/app/(customer-portal)/mina/actions', () => ({ logoutPortalAction: mocks.logout }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))

import {
  installPortalPageShowGuard,
  PortalLogoutTrigger,
  PortalSessionBoundary,
} from './PortalSessionBoundary'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function button(name: string): HTMLButtonElement {
  const result = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  if (!result) throw new Error(`button not found: ${name}`)
  return result
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function dialogButton(name: string): HTMLButtonElement {
  const result = [...document.querySelectorAll('[role="dialog"] button')]
    .find((candidate) => candidate.textContent?.trim() === name) as HTMLButtonElement | undefined
  if (!result) throw new Error(`dialog button not found: ${name}`)
  return result
}

describe('current-device logout boundary', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <nav aria-label="Huvudmeny">Portalnav</nav>
        <PortalLogoutTrigger className="cp-menu-link">Logga ut</PortalLogoutTrigger>
      </PortalSessionBoundary>,
    ))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('uses the exact logout-current dialog, initial focus, focus trap and Escape return', () => {
    const trigger = button('Logga ut')
    trigger.focus()
    click(trigger)
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('Logga ut från den här enheten?')
    expect(dialog.textContent).toContain(
      'Du loggas ut från dina bokningar på den här enheten. Du kan verifiera dig igen med en ny kod.',
    )
    expect(document.activeElement).toBe(button('Avbryt'))
    dialogButton('Logga ut').focus()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement).toBe(button('Avbryt'))
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('single-flights pending logout and replaces the whole portal with the no-nav recovery shell', async () => {
    let finish!: (result: { ok: true; tenantSlug: string }) => void
    mocks.logout.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    click(button('Logga ut'))
    click(dialogButton('Logga ut'))
    click(button('Loggar ut…'))
    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(button('Avbryt').getAttribute('aria-disabled')).toBe('true')
    expect(button('Loggar ut…').getAttribute('aria-disabled')).toBe('true')
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(document.activeElement).toBe(dialog)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement).toBe(dialog)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true,
    })))
    expect(document.activeElement).toBe(dialog)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()

    await act(async () => finish({ ok: true, tenantSlug: 'freshcut' }))
    expect(host.querySelector('h1')?.textContent).toBe('Du är utloggad')
    expect(host.querySelector('a.cp-btn')?.textContent).toBe('Få en ny kod')
    expect(host.querySelector('a.cp-btn')?.getAttribute('href')).toBe('/aterhamta/freshcut')
    expect(host.textContent).toContain('En giltig, oanvänd bokningslänk kan också öppna Mina bokningar.')
    expect(host.textContent).toContain('Dina bokningar finns kvar och påverkas inte.')
    expect(host.querySelector('nav')).toBeNull()
    expect(host.querySelectorAll('a.cp-btn')).toHaveLength(1)
    const recoveryMain = host.querySelector('main')
    expect(recoveryMain?.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(recoveryMain)
  })

  it('uses the bound shell tenant when missing-cookie logout is idempotent success', async () => {
    mocks.logout.mockResolvedValue({ ok: true, tenantSlug: null })
    click(button('Logga ut'))
    await act(async () => click(dialogButton('Logga ut')))
    expect(host.querySelector('a.cp-btn')?.getAttribute('href')).toBe('/aterhamta/freshcut')
  })

  it('keeps the dialog open with exact neutral error copy when revoke fails', async () => {
    mocks.logout.mockResolvedValue({ ok: false })
    click(button('Logga ut'))
    await act(async () => click(dialogButton('Logga ut')))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[role="alert"]')?.textContent)
      .toContain('Åtgärden kunde inte genomföras. Försök igen.')
    expect(button('Logga ut')).not.toBeNull()
  })

  it('forces a server recheck when a private portal page returns from BFCache', () => {
    const source = readFileSync(resolve(
      process.cwd(), 'components/customer-portal/PortalSessionBoundary.tsx',
    ), 'utf8')
    expect(source).toContain("addEventListener('pageshow'")
    expect(source).toContain('(event as PageTransitionEvent).persisted')
    expect(source).toContain('window.location.reload()')
    const reload = vi.fn()
    const target = new EventTarget()
    const remove = installPortalPageShowGuard(reload, target)
    const event = new Event('pageshow') as PageTransitionEvent
    Object.defineProperty(event, 'persisted', { value: true })
    target.dispatchEvent(event)
    expect(reload).toHaveBeenCalledOnce()
    remove()
  })
})
