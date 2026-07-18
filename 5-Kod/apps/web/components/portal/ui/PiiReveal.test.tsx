/**
 * @vitest-environment happy-dom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PiiReveal, type PiiRevealLoadResult } from './PiiReveal'

const MASKED_EMAIL = '•••••@•••'
const MASKED_PHONE = '070- •• •• ••'
const RAW_EMAIL = 'anna@example.se'
const RAW_PHONE = '070-123 45 67'

let root: Root | null = null
let container: HTMLDivElement | null = null

function success(): PiiRevealLoadResult {
  return {
    ok: true,
    contact: { email: RAW_EMAIL, phone: RAW_PHONE },
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  }
}

async function renderReveal(loadContact: () => Promise<PiiRevealLoadResult>) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <PiiReveal
        maskedEmail={MASKED_EMAIL}
        maskedPhone={MASKED_PHONE}
        loadContact={loadContact}
      />,
    )
  })
  return container
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-18T10:00:00.000Z'))
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.useRealTimers()
})

describe('PiiReveal lazy, tidsbunden PII', () => {
  it('hämtar först vid klick, visar svaret och maskerar automatiskt vid serverns expiry', async () => {
    const loadContact = vi.fn(async () => success())
    const view = await renderReveal(loadContact)

    expect(view.textContent).toContain(MASKED_EMAIL)
    expect(view.textContent).toContain(MASKED_PHONE)
    expect(view.textContent).not.toContain(RAW_EMAIL)
    expect(view.textContent).not.toContain(RAW_PHONE)
    expect(loadContact).not.toHaveBeenCalled()

    await act(async () => {
      view.querySelector<HTMLButtonElement>('button')?.click()
    })

    expect(loadContact).toHaveBeenCalledTimes(1)
    expect(view.textContent).toContain(RAW_EMAIL)
    expect(view.textContent).toContain(RAW_PHONE)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000)
    })

    expect(view.textContent).toContain(MASKED_EMAIL)
    expect(view.textContent).toContain(MASKED_PHONE)
    expect(view.textContent).not.toContain(RAW_EMAIL)
    expect(view.textContent).not.toContain(RAW_PHONE)
  })

  it('stannar maskerad och visar ett ärligt fel när servern vägrar reveal', async () => {
    const loadContact = vi.fn(async (): Promise<PiiRevealLoadResult> => ({
      ok: false,
      error: 'Kontaktuppgifterna är inte tillgängliga utanför driftfönstret.',
    }))
    const view = await renderReveal(loadContact)

    await act(async () => {
      view.querySelector<HTMLButtonElement>('button')?.click()
    })

    expect(view.textContent).toContain(MASKED_EMAIL)
    expect(view.textContent).toContain(MASKED_PHONE)
    expect(view.textContent).not.toContain(RAW_EMAIL)
    expect(view.textContent).toContain('inte tillgängliga utanför driftfönstret')
  })

  it('rensar rådata direkt när operatören väljer Dölj', async () => {
    const view = await renderReveal(async () => success())

    await act(async () => view.querySelector<HTMLButtonElement>('button')?.click())
    expect(view.textContent).toContain(RAW_EMAIL)

    await act(async () => view.querySelector<HTMLButtonElement>('button')?.click())
    expect(view.textContent).not.toContain(RAW_EMAIL)
    expect(view.textContent).toContain(MASKED_EMAIL)
  })

  it('nollställer parent-state och timern när en reveald komponent avmonteras', async () => {
    let parentContact: { email: string | null; phone: string | null } | null = null
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <PiiReveal
          maskedEmail={MASKED_EMAIL}
          maskedPhone={MASKED_PHONE}
          loadContact={async () => success()}
          onContactChange={(contact) => {
            parentContact = contact
          }}
        />,
      )
    })

    await act(async () => container?.querySelector<HTMLButtonElement>('button')?.click())
    expect(parentContact).toEqual({ email: RAW_EMAIL, phone: RAW_PHONE })
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => root?.unmount())
    root = null

    expect(parentContact).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})
