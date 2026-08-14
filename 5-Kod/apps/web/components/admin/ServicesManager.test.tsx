/**
 * @vitest-environment happy-dom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  records: [] as Array<Record<string, unknown>>,
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  toggle: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/admin/actions', () => ({
  listServicesResource: mocks.list,
  createService: mocks.create,
  updateService: mocks.update,
  toggleServiceActive: mocks.toggle,
  deleteService: mocks.remove,
}))

import type { ServiceRow } from '@/lib/admin/data'
import { CorevoRefineProvider } from '@/components/motor/CorevoRefineProvider'
import { ServicesManager } from './ServicesManager'

const service = (id: string, name: string): ServiceRow => ({
  id,
  name,
  active: true,
  badge: null,
  buffer_min: null,
  category: 'Hår',
  created_at: '2026-08-14T00:00:00Z',
  description: null,
  duration_min: 30,
  image_url: null,
  location_id: 'location-1',
  price_cents: 45000,
  sale_price_cents: null,
  slot_step_min: null,
  sort_order: 0,
  tenant_id: 'tenant-1',
  updated_at: null,
})

const allCapabilities = { list: true, create: true, edit: true, delete: true }

let container: HTMLDivElement
let root: Root
let telemetryUrls: string[]
let originalImage: typeof Image

function button(label: string, scope: ParentNode = document) {
  const match = [...scope.querySelectorAll('button')].find((node) =>
    node.textContent?.includes(label),
  )
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Knappen saknas: ${label}`)
  return match
}

function input(name: string, scope: ParentNode = document) {
  const match = scope.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (!match) throw new Error(`Fältet saknas: ${name}`)
  return match
}

function setInput(name: string, value: string, scope: ParentNode = document) {
  const field = input(name, scope)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!setter) throw new Error('Input-settern saknas.')
  setter.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

async function waitFor(check: () => void) {
  await act(async () => {
    await vi.waitFor(check)
  })
}

function render(capabilities = allCapabilities) {
  return act(async () => {
    root.render(
      <CorevoRefineProvider capabilities={capabilities}>
        <ServicesManager
          initialServices={mocks.records as ServiceRow[]}
          tenantName="Demo"
          capabilities={capabilities}
        />
      </CorevoRefineProvider>,
    )
  })
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  mocks.records = [service('service-1', 'Klippning')]
  mocks.list.mockImplementation(async () => ({ records: [...mocks.records] }))
  mocks.create.mockImplementation(async (_state, formData: FormData) => {
    const record = service('service-2', String(formData.get('name')))
    mocks.records.push(record)
    return { record }
  })
  mocks.update.mockImplementation(async (_state, formData: FormData) => {
    const id = String(formData.get('id'))
    const record = mocks.records.find((item) => item.id === id)!
    record.name = String(formData.get('name'))
    return { record }
  })
  mocks.toggle.mockImplementation(async (_state, formData: FormData) => {
    const id = String(formData.get('id'))
    const record = mocks.records.find((item) => item.id === id)!
    record.active = formData.get('active') === 'true'
    return { record }
  })
  mocks.remove.mockImplementation(async (_state, formData: FormData) => {
    const id = String(formData.get('id'))
    const record = mocks.records.find((item) => item.id === id)!
    mocks.records = mocks.records.filter((item) => item.id !== id)
    return { record }
  })
  telemetryUrls = []
  originalImage = globalThis.Image
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      set src(value: string) {
        telemetryUrls.push(value)
      }
    },
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: originalImage })
})

describe('ServicesManager Refine connection', () => {
  it('uses SSR data, refreshes every mutation and sends no Refine telemetry', async () => {
    await render()
    expect(mocks.list).not.toHaveBeenCalled()
    expect(telemetryUrls.filter((url) => url.includes('telemetry.refine.dev'))).toEqual([])

    await act(async () => button('Ny tjänst', container).click())
    setInput('name', 'Färgning')
    setInput('category', 'Färg')
    setInput('duration_min', '60')
    setInput('price', '900')
    await submit(document.querySelector<HTMLFormElement>('#create-service')!)
    await waitFor(() => expect(container.textContent).toContain('Färgning'))

    await act(async () => button('Dölj', container).click())
    await waitFor(() => expect(button('Visa', container)).toBeTruthy())

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Redigera Klippning"]')!.click(),
    )
    setInput('name', 'Klippning premium')
    await submit(document.querySelector<HTMLFormElement>('form[id^="edit-service-"]')!)
    await waitFor(() => expect(container.textContent).toContain('Klippning premium'))

    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Redigera Klippning premium"]')!
        .click(),
    )
    await act(async () => button('Ta bort').click())
    await act(async () => button('Säker? Ta bort permanent').click())
    await waitFor(() => expect(container.textContent).not.toContain('Klippning premium'))

    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.toggle).toHaveBeenCalledOnce()
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.remove).toHaveBeenCalledOnce()
    expect(mocks.list).toHaveBeenCalledTimes(4)
  })

  it('hides every mutation control when the capability snapshot denies it', async () => {
    await render({ list: true, create: false, edit: false, delete: false })

    expect(container.textContent).not.toContain('Ny tjänst')
    expect(container.querySelector('[aria-label="Redigera Klippning"]')).toBeNull()
    expect(container.textContent).not.toContain('Dölj')
    expect(container.textContent).not.toContain('Visa')
  })

  it('blocks delete while an edit is pending', async () => {
    let finishUpdate!: (value: { record: ServiceRow }) => void
    mocks.update.mockImplementationOnce(
      () => new Promise((resolve) => (finishUpdate = resolve as typeof finishUpdate)),
    )
    await render()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Redigera Klippning"]')!.click(),
    )

    await submit(document.querySelector<HTMLFormElement>('form[id^="edit-service-"]')!)
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())

    expect(button('Ta bort').disabled).toBe(true)
    expect(button('Spara').disabled).toBe(true)
    finishUpdate({ record: mocks.records[0] as ServiceRow })
  })
})
