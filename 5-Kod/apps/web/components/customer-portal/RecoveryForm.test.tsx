// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecoveryForm } from './RecoveryForm'

const navigation = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

let container: HTMLDivElement
let root: Root

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function input(value: string) {
  const field = container.querySelector<HTMLInputElement>('#kontakt')!
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

describe('RecoveryForm', () => {
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

  it('renders the exact neutral recovery form with one lookup field and no login alternative', async () => {
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={vi.fn()} sessionExpired />,
    ))

    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelector('h1')?.textContent).toBe('Kom åt dina bokningar')
    expect(container.textContent).toContain('Ange mobilnumret eller e-postadressen du bokade med hos FreshCut, så skickar vi en engångskod.')
    expect(container.querySelectorAll('input')).toHaveLength(1)
    expect(container.querySelector('label')?.textContent).toBe('Mobilnummer eller e-post')
    expect(container.querySelector('form')?.classList.contains('cp-recovery-card')).toBe(true)
    expect(container.querySelector('form h1')).toBeNull()
    expect(container.querySelector('section > h1 + p + form')).not.toBeNull()
    expect(container.textContent).toContain('Koden skickas bara till en kontaktuppgift som redan är verifierad hos FreshCut.')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Din session har gått ut. Verifiera dig igen.')
    expect(container.querySelector('.cp-toast .cp-icon')).not.toBeNull()
    expect(container.textContent).not.toMatch(/Logga in|Skapa konto/)
  })

  it('keeps the fixed session toast for five seconds of active time and pauses on hover or focus', async () => {
    vi.useFakeTimers()
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={vi.fn()} sessionExpired />,
    ))
    const toast = container.querySelector<HTMLElement>('.cp-toast')!
    await act(async () => toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    await act(async () => vi.advanceTimersByTime(6_000))
    expect(container.querySelector('.cp-toast')).not.toBeNull()
    await act(async () => toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    await act(async () => {
      toast.focus()
      toast.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })
    await act(async () => vi.advanceTimersByTime(6_000))
    expect(container.querySelector('.cp-toast')).not.toBeNull()
    await act(async () => toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    await act(async () => vi.advanceTimersByTime(5_000))
    expect(container.querySelector('.cp-toast')).toBeNull()
  })

  it('validates only format client-side and does not call the server for invalid input', async () => {
    const startAction = vi.fn()
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={startAction} />,
    ))
    await input('inte en kontakt')
    await submit()

    expect(startAction).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Ange ett giltigt mobilnummer eller en giltig e-postadress.')
    expect(container.querySelector('[role="alert"] .cp-icon')).not.toBeNull()
    expect(document.activeElement).toBe(container.querySelector('#kontakt'))
  })

  it('uses replace navigation after the neutral accepted result', async () => {
    const startAction = vi.fn().mockResolvedValue({ state: 'accepted' })
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={startAction} />,
    ))
    await input('0729408522')
    await submit()

    expect(startAction).toHaveBeenCalledWith('freshcut', '0729408522')
    expect(navigation.replace).toHaveBeenCalledWith('/verifiera/freshcut')
  })

  it('keeps the lookup value and restores the action after a server failure', async () => {
    const startAction = vi.fn().mockResolvedValue({ state: 'unavailable' })
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={startAction} />,
    ))
    await input('alex@example.se')
    await submit()

    expect(container.querySelector<HTMLInputElement>('#kontakt')?.value).toBe('alex@example.se')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Något gick fel. Försök igen.')
    expect(container.querySelector('[role="alert"] .cp-icon')).not.toBeNull()
    expect(container.querySelector('button')?.textContent).toBe('Skicka kod')
    expect(container.querySelector('[data-screen="aterhamta"]')?.getAttribute('data-state')).toBe('network_error')
  })

  it('turns a rejected start request into the same recoverable server error', async () => {
    const startAction = vi.fn().mockRejectedValue(new Error('network'))
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={startAction} />,
    ))
    await input('alex@example.se')
    await submit()
    expect(container.querySelector<HTMLInputElement>('#kontakt')?.value).toBe('alex@example.se')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Något gick fel. Försök igen.')
    expect(container.querySelector<HTMLButtonElement>('button')?.disabled).toBe(false)
  })

  it('locks the field and action with exact pending copy', async () => {
    const startAction = vi.fn(() => new Promise<never>(() => undefined))
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={startAction} />,
    ))
    await input('0729408522')
    await submit()

    expect(container.querySelector<HTMLInputElement>('#kontakt')?.disabled).toBe(true)
    expect(container.querySelector('button')?.disabled).toBe(true)
    expect(container.querySelector('button')?.textContent).toBe('Skickar…')
  })

  it.each([
    ['cooldown', 30, 'Du kan begära en ny kod om 30 s.'],
    ['max_attempts', 300, 'För många försök. Försök igen om 5 min.'],
  ] as const)('locks and counts down the neutral %s state', async (state, retryAfterSeconds, copy) => {
    const startAction = vi.fn().mockResolvedValue({ state, retryAfterSeconds })
    await act(async () => root.render(
      <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={startAction} />,
    ))
    await input('0729408522')
    await submit()

    expect(container.textContent).toContain(copy)
    expect(container.querySelector<HTMLInputElement>('#kontakt')?.disabled).toBe(true)
    expect(container.querySelector('button')?.disabled).toBe(true)
    if (state === 'max_attempts') {
      expect(container.querySelector('#recovery-error .cp-icon')).not.toBeNull()
      expect(container.querySelector<HTMLInputElement>('#kontakt')?.getAttribute('aria-describedby')).toBe('recovery-error')
    }
  })
})
