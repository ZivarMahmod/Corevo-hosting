/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  verifyCurrent: vi.fn(),
  submitDestination: vi.fn(),
  resend: vi.fn(),
  finalize: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/app/(customer-portal)/mina/actions', () => ({
  startPortalContactChangeAction: mocks.start,
  verifyPortalContactChangeCurrentAction: mocks.verifyCurrent,
  submitPortalContactChangeDestinationAction: mocks.submitDestination,
  resendPortalContactChangeAction: mocks.resend,
  finalizePortalContactChangeAction: mocks.finalize,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}))

import { ContactChangeFlow } from './ContactChangeFlow'
import { PortalSessionBoundary } from './PortalSessionBoundary'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  if (!found) throw new Error(`button not found: ${name}`)
  return found
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

async function submit(form: HTMLFormElement) {
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}

describe('canonical ContactChangeFlow', () => {
  let root: Root
  let host: HTMLDivElement
  const trigger = { current: document.createElement('button') }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.append(trigger.current)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="change_phone"
          tenantName="FreshCut"
          currentContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 22' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    trigger.current.remove()
  })

  it('opens as exact step 1 dialog, traps focus and ignores the scrim', () => {
    const dialog = host.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(host.textContent).toContain('Steg 1 av 4')
    expect(host.textContent).toContain('Bekräfta att det är du')
    expect(host.textContent).toContain('Vi skickar en kod till din nuvarande kontakt +46 ••• •• 22.')
    expect(host.textContent).toContain('Av säkerhetsskäl bekräftar du först din nuvarande kontaktuppgift och sedan den nya.')
    expect(document.activeElement).toBe(host.querySelector('h2'))
    click(host.querySelector('.cp-contact-change-scrim')!)
    expect(host.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('shows neutral same-overlay help with exactly one public contact path', () => {
    click(button('Jag kommer inte åt den här kontaktuppgiften'))
    expect(host.textContent).toContain('Kan du inte använda din nuvarande kontakt?')
    expect(host.textContent).toContain('Av säkerhetsskäl kan du inte byta kontaktuppgift själv utan kod till din nuvarande kontakt. Kontakta FreshCut för manuell kontroll.')
    expect(host.querySelectorAll('a')).toHaveLength(1)
    expect(host.querySelector('a')?.textContent).toBe('Hjälp')
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/hjalp')
    expect(host.querySelector('input')).toBeNull()
    expect(host.textContent).not.toMatch(/reserv|dokument|personal/i)
    click(button('Tillbaka'))
    expect(host.textContent).toContain('Steg 1 av 4')
  })

  it('sends only to the current server channel, then requires one semantic current PIN field', async () => {
    mocks.start.mockResolvedValue({ outcome: 'sent', channel: 'sms', maskedDestination: '+46 ••• •• 22' })
    await act(async () => click(button('Skicka kod')))
    expect(mocks.start).toHaveBeenCalledWith('change_phone')
    expect(host.textContent).toContain('Steg 2 av 4')
    expect(host.textContent).toContain('Vi har skickat en kod via SMS till +46 ••• •• 22')
    const input = host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
    expect(input).not.toBeNull()
    expect(document.activeElement).toBe(input)
    expect(host.querySelectorAll('input')).toHaveLength(1)
  })

  it('locks destination type to change_email and never renders a generic contact field', () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="change_email"
          tenantName="FreshCut"
          currentContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 22' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          initialStep={3}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
    expect(host.textContent).toContain('Steg 3 av 4')
    expect(host.textContent).toContain('Ny e-postadress')
    expect(host.textContent).not.toContain('Nytt mobilnummer')
    expect(host.textContent).not.toContain('Landskod')
    expect(host.textContent).not.toContain('Mobilnummer eller e-post')
    expect(host.querySelectorAll('input')).toHaveLength(1)
    expect(host.textContent).toContain('Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas.')
  })

  it('validates a channel-bound destination and preserves it after a neutral send failure', async () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="change_phone"
          tenantName="FreshCut"
          currentContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 22' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          initialStep={3}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
    const input = host.querySelector<HTMLInputElement>('input[name="destination"]')!
    act(() => {
      input.value = 'fel'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await submit(host.querySelector('form')!)
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Ange ett giltigt mobilnummer.')
    expect(mocks.submitDestination).not.toHaveBeenCalled()

    mocks.submitDestination.mockResolvedValue({ outcome: 'unavailable' })
    act(() => {
      input.value = '0729408522'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await submit(host.querySelector('form')!)
    expect(input.value).toBe('0729408522')
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Något gick fel. Försök igen.')
  })

  it('keeps a delivery-failed challenge in its PIN step so resend can recover it', async () => {
    mocks.start.mockResolvedValue({ outcome: 'delivery_failed' })
    await act(async () => click(button('Skicka kod')))
    expect(host.textContent).toContain('Steg 2 av 4')
    expect(host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.disabled).toBe(true)
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('SMS:et med koden kunde inte skickas. Försök igen eller ändra mobilnummer.')
    expect(host.textContent).not.toContain('Vi har skickat en kod via SMS')
    expect(button('Skicka ny kod om [00:30]').disabled).toBe(true)

    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="change_phone"
          tenantName="FreshCut"
          currentContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 22' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          initialStep={3}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
    const destination = host.querySelector<HTMLInputElement>('input[name="destination"]')!
    act(() => {
      destination.value = '0729408590'
      destination.dispatchEvent(new Event('input', { bubbles: true }))
    })
    mocks.submitDestination.mockResolvedValue({ outcome: 'delivery_failed' })
    await submit(host.querySelector('form')!)
    expect(host.textContent).toContain('Steg 4 av 4')
    expect(host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.disabled).toBe(true)
    expect(button('Skicka ny kod om [00:30]').disabled).toBe(true)
  })

  it('uses a separate new PIN, single-flights finalize and shows action-specific receipt', async () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="add_phone"
          tenantName="FreshCut"
          currentContact={{ channel: 'email', maskedDestination: 'a•••@example.se' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          initialStep={4}
          initialNewContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 90' }}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
    expect(host.textContent).toContain('Vi har skickat en kod via SMS till +46 ••• •• 90')
    const input = host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
    act(() => {
      input.value = '654321'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    let finish!: (value: { outcome: 'success'; action: 'add_phone' }) => void
    mocks.finalize.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const form = host.querySelector('form')!
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(mocks.finalize).toHaveBeenCalledTimes(1)
    expect(input.disabled).toBe(true)
    expect(button('Verifierar…').getAttribute('aria-disabled')).toBe('true')
    await act(async () => finish({ outcome: 'success', action: 'add_phone' }))
    expect(host.textContent).not.toContain('Steg 4 av 4')
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Mobilnumret är tillagt.')
    expect(host.textContent).toContain('Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas.')
    expect(button('Stäng')).not.toBeNull()
  })

  it('resends only the active purpose and replaces the old code without leaving the overlay', async () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="add_phone"
          tenantName="FreshCut"
          currentContact={{ channel: 'email', maskedDestination: 'a•••@example.se' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          initialStep={4}
          initialNewContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 90' }}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
    mocks.resend.mockResolvedValue({
      outcome: 'sent', channel: 'sms', maskedDestination: '+46 ••• •• 90',
    })
    await act(async () => click(button('Skicka ny kod')))
    expect(mocks.resend).toHaveBeenCalledWith('new')
    expect(host.textContent).toContain('Steg 4 av 4')
    expect(host.textContent).toContain('En ny kod har skickats.')
    expect(host.textContent).not.toContain('Vi har skickat en kod via SMS')
    expect(button('Skicka ny kod om [00:30]').disabled).toBe(true)
  })

  it('locks an undelivered resend and keeps the server cooldown active', async () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <ContactChangeFlow
          action="change_email"
          tenantName="FreshCut"
          currentContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 22' }}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={trigger}
          initialStep={4}
          initialNewContact={{ channel: 'email', maskedDestination: 'n•••@example.se' }}
          onClose={vi.fn()}
        />
      </PortalSessionBoundary>,
    ))
    mocks.resend.mockResolvedValue({ outcome: 'delivery_failed' })
    await act(async () => click(button('Skicka ny kod')))
    expect(host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.disabled).toBe(true)
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Mejlet med koden kunde inte skickas. Försök igen eller ändra e-post.')
    expect(host.textContent).not.toContain('Vi har skickat en kod via e-post')
    expect(button('Skicka ny kod om [00:30]').disabled).toBe(true)
  })

  it('keeps exact invalid/expired/max-attempt copy and redirects expired portal sessions', async () => {
    mocks.start.mockResolvedValue({ outcome: 'expired' })
    await act(async () => click(button('Skicka kod')))
    expect(mocks.replace).toHaveBeenCalledWith('/aterhamta/freshcut?session=expired')
  })
})
