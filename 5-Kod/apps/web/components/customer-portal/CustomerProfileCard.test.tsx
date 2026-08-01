/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateName: vi.fn(), start: vi.fn(), verifyCurrent: vi.fn(),
  submitDestination: vi.fn(), resend: vi.fn(), finalize: vi.fn(),
  refresh: vi.fn(), replace: vi.fn(),
}))
vi.mock('@/app/(customer-portal)/mina/actions', () => ({
  updatePortalNameAction: mocks.updateName,
  startPortalContactChangeAction: mocks.start,
  verifyPortalContactChangeCurrentAction: mocks.verifyCurrent,
  submitPortalContactChangeDestinationAction: mocks.submitDestination,
  resendPortalContactChangeAction: mocks.resend,
  finalizePortalContactChangeAction: mocks.finalize,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}))

import { CustomerProfileCard, CustomerProfileUnavailable } from './CustomerProfileCard'
import { PortalSessionBoundary } from './PortalSessionBoundary'

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

describe('canonical customer profile card', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <CustomerProfileCard
          tenantName="FreshCut"
          customerName="Alex Testperson"
          verifiedContact={{ channel: 'sms', maskedDestination: '•••• •• 00 00' }}
          secondaryContact={null}
          contactChangeActions={['change_phone']}
        />
      </PortalSessionBoundary>,
    ))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('renders exact profile copy, one masked server channel and only live staged menu actions', () => {
    expect(host.querySelector('h1')?.textContent).toBe('Profil')
    expect(host.querySelector('h2')?.textContent).toBe('Mina uppgifter')
    expect(host.textContent).toContain('Uppgifterna gäller hos FreshCut.')
    expect(host.textContent).toContain('Verifierad kontakt')
    expect(host.textContent).toContain('SMS')
    expect(host.textContent).toContain('•••• •• 00 00')
    expect(host.textContent).not.toContain('+46729408522')
    expect(host.querySelector('nav[aria-label="Profilmeny"]')?.textContent).toContain('Mina uppgifter')
    expect(host.querySelector('nav[aria-label="Profilmeny"]')?.textContent).toContain('Säkerhet och enheter')
    expect(host.querySelector('nav[aria-label="Profilmeny"]')?.textContent).toContain('Logga ut')
    expect(host.textContent).toContain('Installera på hemskärmen')
    expect(host.textContent).not.toMatch(/Lägg till mobilnummer|Byt e-post/)
    expect(host.textContent).toContain('Byt telefonnummer')
    expect(host.querySelectorAll('.cp-contact-icon')).toHaveLength(1)
    expect(host.querySelectorAll('.cp-menu-leading-icon')).toHaveLength(4)
  })

  it('opens the server-selected contact flow over the unchanged profile and returns focus on cancel', async () => {
    const trigger = button('Byt telefonnummer')
    click(trigger)
    expect(host.querySelector('[role="dialog"]')).not.toBeNull()
    expect(host.textContent).toContain('Bekräfta att det är du')
    expect(host.textContent).toContain('•••• •• 00 00')
    click(button('Avbryt'))
    await act(async () => Promise.resolve())
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it.each([
    [true, 'Verifierad'],
    [false, 'Inte verifierad'],
  ] as const)('renders an optional masked secondary contact with honest verified=%s status', (verified, label) => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <CustomerProfileCard
          tenantName="FreshCut"
          customerName="Alex Testperson"
          verifiedContact={{ channel: 'sms', maskedDestination: '+46 ••• •• 22' }}
          secondaryContact={{
            channel: 'email', maskedDestination: 'a•••@example.se', verified,
          }}
          contactChangeActions={['change_phone', 'change_email']}
        />
      </PortalSessionBoundary>,
    ))
    expect(host.textContent).toContain('a•••@example.se')
    expect(host.textContent).toContain(label)
    expect(host.querySelectorAll('.cp-contact-icon')).toHaveLength(2)
    expect(host.textContent).not.toContain('alex@example.se')
  })

  it('renders email as the only primary contact without an empty phone row', () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <CustomerProfileCard
          tenantName="FreshCut"
          customerName="Alex Testperson"
          verifiedContact={{ channel: 'email', maskedDestination: 'a•••@example.se' }}
          secondaryContact={null}
          contactChangeActions={['add_phone', 'change_email']}
        />
      </PortalSessionBoundary>,
    ))
    expect(host.querySelectorAll('.cp-contact-row')).toHaveLength(1)
    expect(host.textContent).toContain('E-post')
    expect(host.textContent).toContain('a•••@example.se')
    expect(host.textContent).not.toContain('SMS')
    expect(host.textContent).toContain('Lägg till mobilnummer')
    expect(host.textContent).toContain('Byt e-post')
  })

  it('validates before the server, cancels with Escape and returns focus to Ändra', async () => {
    const edit = button('Ändra')
    click(edit)
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    expect(document.activeElement).toBe(input)
    act(() => {
      input.value = 'X'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', {
      bubbles: true, cancelable: true,
    })))
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Namnet måste vara 2–120 tecken.')
    expect(mocks.updateName).not.toHaveBeenCalled()

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(host.querySelector('input[name="name"]')).toBeNull()
    expect(document.activeElement).toBe(button('Ändra'))
  })

  it('single-flights save, locks the form, returns focus and keeps the success toast for five seconds', async () => {
    vi.useFakeTimers()
    let finish!: (result: { outcome: 'success'; name: string }) => void
    mocks.updateName.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    click(button('Ändra'))
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    act(() => {
      input.value = '  Åsa Test  '
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const form = host.querySelector('form')!
    expect([...form.querySelectorAll('button')].map((candidate) => candidate.textContent?.trim()))
      .toEqual(['Spara', 'Avbryt'])
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(mocks.updateName).toHaveBeenCalledTimes(1)
    expect(mocks.updateName).toHaveBeenCalledWith('Åsa Test')
    expect(input.disabled).toBe(true)
    expect(button('Sparar…').getAttribute('aria-disabled')).toBe('true')
    expect(button('Avbryt').getAttribute('aria-disabled')).toBe('true')

    await act(async () => finish({ outcome: 'success', name: 'Åsa Test' }))
    expect(host.textContent).toContain('Åsa Test')
    expect(document.activeElement).toBe(button('Ändra'))
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Namnet är sparat.')
    act(() => vi.advanceTimersByTime(4_999))
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(host.querySelector('[role="status"]')).toBeNull()
  })

  it('accepts assigned multilingual Unicode and emoji in the client before saving', async () => {
    const name = 'अनन्या 😀 शर्मा'
    mocks.updateName.mockResolvedValue({ outcome: 'success', name })
    click(button('Ändra'))
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    act(() => {
      input.value = name
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', {
      bubbles: true, cancelable: true,
    })))
    expect(mocks.updateName).toHaveBeenCalledWith(name)
    expect(host.textContent).toContain(name)
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it('pauses the five-second success toast on hover/focus and resumes its remaining duration', async () => {
    vi.useFakeTimers()
    mocks.updateName.mockResolvedValue({ outcome: 'success', name: 'Alex Nytt' })
    click(button('Ändra'))
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    act(() => {
      input.value = 'Alex Nytt'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', {
      bubbles: true, cancelable: true,
    })))
    act(() => vi.advanceTimersByTime(2_000))
    const toast = host.querySelector<HTMLElement>('[role="status"]')!
    act(() => toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    act(() => vi.advanceTimersByTime(10_000))
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    act(() => toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    act(() => {
      toast.focus()
      toast.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      vi.advanceTimersByTime(10_000)
    })
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    act(() => toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    act(() => vi.advanceTimersByTime(2_999))
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(host.querySelector('[role="status"]')).toBeNull()
  })

  it('preserves the edited value after a neutral server failure', async () => {
    mocks.updateName.mockResolvedValue({ outcome: 'unavailable' })
    click(button('Ändra'))
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    act(() => {
      input.value = 'Alex Nytt'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', {
      bubbles: true, cancelable: true,
    })))
    expect(input.value).toBe('Alex Nytt')
    expect(input.disabled).toBe(false)
    expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe('Namnet kunde inte sparas. Försök igen.')
  })

  it('moves an expired name mutation to canonical session recovery instead of a save error', async () => {
    mocks.updateName.mockResolvedValue({ outcome: 'expired' })
    click(button('Ändra'))
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    act(() => {
      input.value = 'Alex Nytt'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', {
      bubbles: true, cancelable: true,
    })))
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(mocks.replace).toHaveBeenCalledWith('/aterhamta/freshcut?session=expired')
  })

  it('keeps name edit open when Escape closes the logout dialog above it', () => {
    click(button('Ändra'))
    const input = host.querySelector<HTMLInputElement>('input[name="name"]')!
    act(() => {
      input.value = 'Alex Pågående'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    click(button('Logga ut'))
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(host.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe('Alex Pågående')
  })

  it('makes profile error retry a real RSC refresh and keeps staged menu/logout functional', () => {
    act(() => root.render(
      <PortalSessionBoundary tenantSlug="freshcut">
        <CustomerProfileUnavailable logoutAvailable />
      </PortalSessionBoundary>,
    ))
    click(button('Försök igen'))
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(host.textContent).toContain('Mina uppgifter')
    expect(host.textContent).toContain('Logga ut')
  })
})
