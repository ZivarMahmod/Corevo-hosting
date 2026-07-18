// @vitest-environment happy-dom

import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionState } from '@/lib/platform/actions/shared'
import {
  PartnerMutationSubmit,
  useRefreshOnActionSuccess,
} from './PartnerMutationControls'

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/components/portal/ui', () => ({
  Button: ({
    children,
    buttonRef,
    variant: _variant,
    ...props
  }: {
    children: ReactNode
    buttonRef?: React.Ref<HTMLButtonElement>
    variant?: string
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button ref={buttonRef} {...props}>{children}</button>
  ),
  useToast: () => ({ notify: mocks.notify }),
}))

let root: Root
let container: HTMLDivElement

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((node) => node.textContent?.includes(label))
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

function RefreshHarness({ state, pending }: { state: ActionState; pending: boolean }) {
  useRefreshOnActionSuccess(state, pending)
  return null
}

function SubmitHarness({ state = {}, pending = false }: { state?: ActionState; pending?: boolean }) {
  const [submits, setSubmits] = useState(0)
  return (
    <form onSubmit={(event) => { event.preventDefault(); setSubmits((value) => value + 1) }}>
      <input aria-label="Namn" defaultValue="A" />
      <PartnerMutationSubmit
        state={state}
        pending={pending}
        triggerLabel="Spara partner"
        confirmLabel="Bekräfta ändring"
        pendingLabel="Sparar…"
        warning="Den öppna månaden räknas om."
      />
      <output>{submits}</output>
    </form>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mocks.notify.mockReset()
  mocks.refresh.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('partner mutation controls', () => {
  it('requires a second click before submitting a partner mutation', async () => {
    await act(async () => root.render(<SubmitHarness />))

    await act(async () => button('Spara partner').click())
    expect(container.querySelector('output')?.textContent).toBe('0')
    expect(container.textContent).toContain('Den öppna månaden räknas om.')

    await act(async () => button('Bekräfta ändring').click())
    expect(container.querySelector('output')?.textContent).toBe('1')
  })

  it('restores trigger focus after cancel and timeout', async () => {
    await act(async () => root.render(<SubmitHarness />))
    await act(async () => button('Spara partner').click())
    await act(async () => button('Avbryt').click())
    expect(document.activeElement).toBe(button('Spara partner'))

    await act(async () => button('Spara partner').click())
    await act(async () => vi.advanceTimersByTime(10_000))
    expect(document.activeElement).toBe(button('Spara partner'))
  })

  it('requires re-arming when a form value changes after the warning was shown', async () => {
    await act(async () => root.render(<SubmitHarness />))
    await act(async () => button('Spara partner').click())
    const input = container.querySelector('input')
    if (!(input instanceof HTMLInputElement)) throw new Error('Input not found')

    await act(async () => {
      input.value = 'B'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'B' }))
    })

    expect(button('Spara partner')).toBeTruthy()
    expect(container.textContent).not.toContain('Bekräfta ändring')
    expect(document.activeElement).not.toBe(button('Spara partner'))
  })

  it('refreshes after every completed submission even when the success text repeats', async () => {
    await act(async () => root.render(<RefreshHarness state={{}} pending={false} />))
    await act(async () => root.render(<RefreshHarness state={{}} pending />))
    await act(async () => root.render(<RefreshHarness state={{ success: 'Sparad.' }} pending={false} />))
    await act(async () => root.render(<RefreshHarness state={{ success: 'Sparad.' }} pending />))
    await act(async () => root.render(<RefreshHarness state={{ success: 'Sparad.' }} pending={false} />))

    expect(mocks.notify).toHaveBeenCalledTimes(2)
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  it('returns focus to the mutation trigger after a successful submission', async () => {
    await act(async () => root.render(<SubmitHarness />))
    await act(async () => button('Spara partner').click())
    expect(document.activeElement).toBe(button('Bekräfta ändring'))

    await act(async () => root.render(<SubmitHarness pending />))
    await act(async () => root.render(<SubmitHarness state={{ success: 'Sparad.' }} />))

    expect(document.activeElement).toBe(button('Spara partner'))
  })
})
