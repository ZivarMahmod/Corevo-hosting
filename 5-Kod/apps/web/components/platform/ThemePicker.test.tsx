// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ActionState = { error?: string; success?: string }
type ThemeAction = (previous: ActionState, formData: FormData) => Promise<ActionState>

const mocks = vi.hoisted(() => ({
  action: null as ThemeAction | null,
  formAction: vi.fn(),
  setTenantTheme: vi.fn(),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useActionState: (action: ThemeAction) => {
      mocks.action = action
      return [{}, mocks.formAction, false] as const
    },
  }
})
vi.mock('@/lib/platform/actions', () => ({
  setTenantTheme: mocks.setTenantTheme,
}))
vi.mock('./ThemeGallery', () => ({
  ThemeGallery: ({ onChange }: { onChange: (theme: string) => void }) => (
    <button type="button" onClick={() => onChange('kalla')}>Välj Kalla</button>
  ),
}))

import { ThemePicker } from './ThemePicker'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, reject, resolve }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  mocks.action = null
  mocks.formAction.mockReset()
  mocks.setTenantTheme.mockReset()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function themeFormData(theme = 'kalla') {
  const data = new FormData()
  data.set('theme', theme)
  data.set('copyMode', 'keep')
  return data
}

async function renderPicker(
  onPublishingChange: (pending: boolean) => void,
  current = 'siluett',
) {
  await act(async () => root.render(
    <ThemePicker
      tenantId="tenant-1"
      current={current}
      onPublishingChange={onPublishingChange}
    />,
  ))
  if (!mocks.action) throw new Error('Theme action was not registered')
  return mocks.action
}

describe('ThemePicker publication lifecycle', () => {
  it('announces before the server action and holds the lock until refreshed current matches', async () => {
    const pending = deferred<ActionState>()
    const events: string[] = []
    mocks.setTenantTheme.mockImplementation(() => {
      events.push('server')
      return pending.promise
    })
    const action = await renderPicker((value) => events.push(`pending:${value}`))

    const publication = action({}, themeFormData())
    expect(events).toEqual(['pending:true', 'server'])

    pending.resolve({ success: 'Mall bytt.' })
    await expect(publication).resolves.toEqual({ success: 'Mall bytt.' })
    expect(events).toEqual(['pending:true', 'server'])

    await renderPicker((value) => events.push(`pending:${value}`), 'kalla')
    expect(events).toEqual(['pending:true', 'server', 'pending:false'])
  })

  it('announces synchronously on submit and deduplicates the action fallback in the same turn', async () => {
    let locked = false
    const publishing = vi.fn((value: boolean) => { locked = value })
    const action = await renderPicker(publishing)

    await act(async () => {
      const choose = container.querySelector('button')
      if (!(choose instanceof HTMLButtonElement)) throw new Error('Theme choice missing')
      choose.click()
    })
    const copyMode = container.querySelector<HTMLInputElement>('input[name="copyMode"][value="keep"]')
    if (!copyMode) throw new Error('Copy mode missing')
    await act(async () => copyMode.click())

    const form = container.querySelector('form')
    if (!(form instanceof HTMLFormElement)) throw new Error('Theme form missing')
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      // Represents a sibling mutation attempted before React schedules the action.
      expect(locked).toBe(true)
    })
    expect(publishing.mock.calls).toEqual([[true]])

    mocks.setTenantTheme.mockResolvedValue({ error: 'Avbruten.' })
    await expect(action({}, themeFormData())).resolves.toEqual({ error: 'Avbruten.' })
    expect(publishing.mock.calls).toEqual([[true], [false]])
  })

  it('settles immediately when the server action returns an error', async () => {
    mocks.setTenantTheme.mockResolvedValue({ error: 'Avbruten.' })
    const publishing = vi.fn()
    const action = await renderPicker(publishing)

    await expect(action({}, themeFormData())).resolves.toEqual({ error: 'Avbruten.' })
    expect(publishing.mock.calls).toEqual([[true], [false]])
  })

  it('settles the parent lock when the server action throws', async () => {
    mocks.setTenantTheme.mockRejectedValue(new Error('network'))
    const publishing = vi.fn()
    const action = await renderPicker(publishing)

    await expect(action({}, themeFormData())).rejects.toThrow('network')
    expect(publishing.mock.calls).toEqual([[true], [false]])
  })

  it('settles once on unmount and does not call the parent after the request resolves', async () => {
    const pending = deferred<ActionState>()
    mocks.setTenantTheme.mockReturnValue(pending.promise)
    const publishing = vi.fn()
    const action = await renderPicker(publishing)

    const publication = action({}, themeFormData())
    expect(publishing.mock.calls).toEqual([[true]])
    await act(async () => root.render(null))
    expect(publishing.mock.calls).toEqual([[true], [false]])

    pending.resolve({ error: 'Avbruten.' })
    await publication
    expect(publishing.mock.calls).toEqual([[true], [false]])
  })
})
