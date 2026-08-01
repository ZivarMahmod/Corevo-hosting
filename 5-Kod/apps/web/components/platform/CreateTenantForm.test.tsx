// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

const mocks = vi.hoisted(() => ({ createTenant: vi.fn() }))

vi.mock('@/lib/platform/actions', () => ({
  createTenant: mocks.createTenant,
}))

import { CreateTenantForm } from './CreateTenantForm'

const presets: VerticalPresetData = {
  verticals: [],
  modules: [],
  templatesByVertical: {},
}

let container: HTMLDivElement
let root: Root

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((node) => node.textContent?.includes(label))
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

async function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mocks.createTenant.mockReset().mockResolvedValue({})
  await act(async () => root.render(<CreateTenantForm presets={presets} />))
  for (let step = 0; step < 5; step += 1) {
    await act(async () => button('Fortsätt').click())
  }
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('CreateTenantForm owner email', () => {
  it('has a real required label and blocks empty or malformed submission', async () => {
    const label = [...container.querySelectorAll('label')].find(
      (candidate) => candidate.textContent === 'Ägarens e-post',
    )
    const email = container.querySelector<HTMLInputElement>('input[type="email"]')
    const form = email?.form
    const submit = button('Skapa kund')
    const submitted = vi.fn((event: Event) => event.preventDefault())

    expect(label).toBeInstanceOf(HTMLLabelElement)
    expect(email).toBeInstanceOf(HTMLInputElement)
    expect(label?.htmlFor).toBe(email?.id)
    expect(email?.required).toBe(true)
    expect(form).toBeInstanceOf(HTMLFormElement)

    form?.addEventListener('submit', submitted)
    expect(form?.checkValidity()).toBe(false)
    await act(async () => submit.click())
    expect(submitted).not.toHaveBeenCalled()

    await setInput(email!, 'inte-en-epost')
    expect(email?.validity.typeMismatch).toBe(true)
    await act(async () => submit.click())
    expect(submitted).not.toHaveBeenCalled()

    await setInput(email!, 'owner@example.se')
    expect(form?.checkValidity()).toBe(true)
    await act(async () => submit.click())
    expect(submitted).toHaveBeenCalledTimes(1)
  })
})
