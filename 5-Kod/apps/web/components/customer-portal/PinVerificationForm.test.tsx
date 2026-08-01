// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinVerificationForm } from './PinVerificationForm'

const navigation = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

let container: HTMLDivElement
let root: Root

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function setCode(value: string) {
  const field = container.querySelector<HTMLInputElement>('#engangskod')!
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return field
}

async function submit() {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

describe('PinVerificationForm recovery mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('always renders only the neutral channel line and one semantic OTP input', async () => {
    await act(async () => root.render(
      <PinVerificationForm
        mode="recovery"
        tenantSlug="freshcut"
        initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 30 }}
        verifyAction={vi.fn()}
        resendAction={vi.fn()}
      />,
    ))

    expect(container.querySelector('h1')?.textContent).toBe('Ange koden')
    expect(container.querySelector('form')?.classList.contains('cp-recovery-card')).toBe(true)
    expect(container.querySelector('form h1')).toBeNull()
    expect(container.querySelector('section > h1 + p + form')).not.toBeNull()
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Om uppgiften finns hos oss har vi skickat en kod.')
    expect(container.querySelectorAll('input')).toHaveLength(1)
    const field = container.querySelector<HTMLInputElement>('#engangskod')!
    expect(field.inputMode).toBe('numeric')
    expect(field.autocomplete).toBe('one-time-code')
    expect(field.maxLength).toBe(6)
    expect(document.activeElement).toBe(field)
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('cooldown')
    expect(container.textContent).not.toMatch(/SMS|e-post till|maskerad|provider/i)
  })

  it('keeps an invalid code, reports attempts and restores focus to the field', async () => {
    const verifyAction = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid', attemptsRemaining: 3 })
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={verifyAction} resendAction={vi.fn()} />,
    ))
    await setCode('123456')
    await submit()

    expect(verifyAction).toHaveBeenCalledWith('freshcut', '123456')
    expect(container.querySelector<HTMLInputElement>('#engangskod')?.value).toBe('123456')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Fel kod. Du har 3 försök kvar.')
    expect(container.querySelector('[role="alert"] .cp-icon')).not.toBeNull()
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('invalid')
    expect(document.activeElement).toBe(container.querySelector('#engangskod'))
  })

  it('announces verification and replaces navigation without exposing result details', async () => {
    vi.useFakeTimers()
    const verifyAction = vi.fn().mockResolvedValue({ ok: true })
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={verifyAction} resendAction={vi.fn()} />,
    ))
    await setCode('589511')
    await submit()

    expect(container.querySelector('[role="status"]')?.textContent).toBe('Verifierad')
    expect(navigation.replace).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(160))
    expect(navigation.replace).toHaveBeenCalledWith('/mina')
  })

  it('locks the field and verify action with exact pending copy', async () => {
    const verifyAction = vi.fn(() => new Promise<never>(() => undefined))
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={verifyAction} resendAction={vi.fn()} />,
    ))
    await setCode('123456')
    await submit()
    expect(container.querySelector<HTMLInputElement>('#engangskod')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe('Verifierar…')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('pending')
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe('Verifierar…')
  })

  it('keeps the code after a neutral verification failure', async () => {
    const verifyAction = vi.fn().mockResolvedValue({ ok: false })
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={verifyAction} resendAction={vi.fn()} />,
    ))
    await setCode('123456')
    await submit()
    expect(container.querySelector<HTMLInputElement>('#engangskod')?.value).toBe('123456')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden kunde inte kontrolleras. Försök igen.')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('resend_ready')
    expect(container.textContent).not.toContain('Koden kunde inte skickas. Försök igen.')
    expect(container.querySelector('[role="alert"] .cp-icon')).not.toBeNull()
  })

  it('turns a rejected verify request into CP-PIN-21 without clearing the code', async () => {
    const verifyAction = vi.fn().mockRejectedValue(new Error('network'))
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 30 }} verifyAction={verifyAction} resendAction={vi.fn()} />,
    ))
    await setCode('123456')
    await submit()
    expect(container.querySelector<HTMLInputElement>('#engangskod')?.value).toBe('123456')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden kunde inte kontrolleras. Försök igen.')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('cooldown')
    expect(container.textContent).toContain('Skicka ny kod om 00:30')
    expect(container.textContent).not.toContain('Koden kunde inte skickas. Försök igen.')
  })

  it('never resends an expired credential and offers a fresh recovery challenge', async () => {
    const resendAction = vi.fn()
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'expired' }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden har gått ut. Begär en ny kod.')
    expect(container.querySelector('[role="alert"] .cp-icon')).not.toBeNull()
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('expired')
    expect(container.querySelector<HTMLInputElement>('#engangskod')?.disabled).toBe(true)
    const freshLink = container.querySelector<HTMLAnchorElement>('.cp-resend a')!
    expect(freshLink.textContent).toBe('Skicka ny kod')
    expect(freshLink.getAttribute('href')).toBe('/aterhamta/freshcut')
    freshLink.click()
    expect(resendAction).not.toHaveBeenCalled()
  })

  it('transitions a max-attempt lock to the fresh recovery path without resending the locked credential', async () => {
    vi.useFakeTimers()
    const resendAction = vi.fn()
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'max_attempts', retryAfterSeconds: 2 }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('För många försök. Försök igen om 1 min.')
    expect(container.querySelector<HTMLInputElement>('#engangskod')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    expect(container.querySelector('.cp-resend a')).toBeNull()
    await act(async () => vi.advanceTimersByTime(2_000))
    expect(container.querySelector<HTMLAnchorElement>('.cp-resend a')?.getAttribute('href')).toBe('/aterhamta/freshcut')
    expect(container.querySelector('.cp-resend a')?.textContent).toBe('Skicka ny kod')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden har gått ut. Begär en ny kod.')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('expired')
    expect(resendAction).not.toHaveBeenCalled()
  })

  it('starts on the fresh recovery path when a max-attempt lock has already elapsed', async () => {
    const resendAction = vi.fn()
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'max_attempts', retryAfterSeconds: 0 }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    expect(container.querySelector<HTMLAnchorElement>('.cp-resend a')?.getAttribute('href')).toBe('/aterhamta/freshcut')
    expect(container.querySelector('.cp-resend button')).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden har gått ut. Begär en ny kod.')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('expired')
    expect(resendAction).not.toHaveBeenCalled()
  })

  it('confirms resend neutrally and applies the server cooldown', async () => {
    const resendAction = vi.fn().mockResolvedValue({ state: 'accepted', retryAfterSeconds: 42 })
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('.cp-resend button')!.click())
    expect(resendAction).toHaveBeenCalledWith('freshcut')
    expect(container.querySelector('.cp-channel-note')?.textContent).toBe('En ny kod har skickats.')
    expect(container.textContent).toContain('Skicka ny kod om 00:42')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('cooldown')
  })

  it('keeps resend available after a neutral resend failure', async () => {
    const resendAction = vi.fn().mockResolvedValue({ state: 'unavailable' })
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('.cp-resend button')!.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden kunde inte skickas. Försök igen.')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('delivery_failed')
    expect(container.querySelector<HTMLButtonElement>('.cp-resend button')?.disabled).toBe(false)
  })

  it('turns a rejected resend into the same channel-neutral failure with retry available', async () => {
    const resendAction = vi.fn().mockRejectedValue(new Error('network'))
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 0 }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('.cp-resend button')!.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden kunde inte skickas. Försök igen.')
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('delivery_failed')
    expect(container.querySelector<HTMLButtonElement>('.cp-resend button')?.disabled).toBe(false)
  })

  it('uses only canonical cooldown, resend_ready and sending selectors across resend transitions', async () => {
    vi.useFakeTimers()
    const resendAction = vi.fn(() => new Promise<never>(() => undefined))
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 1 }} verifyAction={vi.fn()} resendAction={resendAction} />,
    ))
    const screen = () => container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')
    expect(screen()).toBe('cooldown')
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(screen()).toBe('resend_ready')
    await act(async () => container.querySelector<HTMLButtonElement>('.cp-resend button')!.click())
    expect(screen()).toBe('sending')
    expect(container.innerHTML).not.toMatch(/sent_neutral|pending|network_error/)
  })

  it('maps an unavailable challenge to the canonical delivery_failed selector', async () => {
    await act(async () => root.render(
      <PinVerificationForm mode="recovery" tenantSlug="freshcut" initialState={{ state: 'unavailable' }} verifyAction={vi.fn()} resendAction={vi.fn()} />,
    ))
    expect(container.querySelector('[data-screen="verifiera"]')?.getAttribute('data-state')).toBe('delivery_failed')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Koden kunde inte skickas. Försök igen.')
    expect(container.querySelector('[role="alert"] .cp-icon')).not.toBeNull()
  })
})
