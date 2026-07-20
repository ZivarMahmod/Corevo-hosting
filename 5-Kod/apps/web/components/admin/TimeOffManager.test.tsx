/**
 * @vitest-environment happy-dom
 */

import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeOffManager } from './TimeOffManager'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/admin/schedule-actions', () => ({
  addStaffTimeOff: async () => ({}),
  removeStaffTimeOff: async () => ({}),
}))

vi.mock('@/components/portal/ui', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    type,
    disabled,
  }: {
    children: ReactNode
    type?: 'button' | 'submit'
    disabled?: boolean
  }) => (
    <button type={type} disabled={disabled}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: () => <span aria-hidden="true" />,
  useToast: () => ({ notify: vi.fn() }),
}))

const STAFF = [
  { id: 'staff-1', name: 'Anna' },
  { id: 'staff-2', name: 'Björn' },
]

const BASE_PROPS = {
  items: [],
  staffOptions: STAFF,
  staffNoun: 'medarbetare',
} satisfies ComponentProps<typeof TimeOffManager>

let container: HTMLDivElement
let root: Root

function renderManager(props: ComponentProps<typeof TimeOffManager>) {
  act(() => root.render(<TimeOffManager {...props} />))
}

function staffSelect() {
  const select = container.querySelector<HTMLSelectElement>('select[name="staff_id"]')
  if (!select) throw new Error('Personalväljaren saknas.')
  return select
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('TimeOffManager staff-scope', () => {
  it('exponerar det stabila ankaret för frånvarosektionen', () => {
    renderManager(BASE_PROPS)

    expect(container.querySelector('#franvaro')).not.toBeNull()
  })

  it('väljer ett giltigt explicit defaultStaffId', () => {
    renderManager({ ...BASE_PROPS, defaultStaffId: 'staff-2' })

    expect(staffSelect().value).toBe('staff-2')
  })

  it('visar ingen redundant personalväljare på ett staff-scopat personkort', () => {
    renderManager({
      ...BASE_PROPS,
      staffOptions: [{ id: 'staff-1', name: 'Anna' }],
      defaultStaffId: 'staff-1',
    })

    expect(container.querySelector('select[name="staff_id"]')).toBeNull()
    expect(container.querySelector<HTMLInputElement>('input[name="staff_id"]')?.value).toBe(
      'staff-1',
    )
  })

  it('väljer inte tyst en annan ensam person när explicit default saknas', () => {
    renderManager({
      ...BASE_PROPS,
      staffOptions: [{ id: 'staff-1', name: 'Anna' }],
      defaultStaffId: 'staff-missing',
    })

    expect(staffSelect().value).toBe('')
  })

  it('nollställer valet när defaultStaffId ändras efter render', () => {
    renderManager({ ...BASE_PROPS, defaultStaffId: 'staff-1' })
    expect(staffSelect().value).toBe('staff-1')

    renderManager({ ...BASE_PROPS, defaultStaffId: 'staff-2' })

    expect(staffSelect().value).toBe('staff-2')
  })

  it('nollställer valet när option-id:n ändras efter render', () => {
    renderManager(BASE_PROPS)
    const select = staffSelect()
    act(() => {
      select.value = 'staff-2'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    renderManager({
      ...BASE_PROPS,
      staffOptions: [{ id: 'staff-3', name: 'Cecilia' }],
    })

    expect(staffSelect().value).toBe('staff-3')
  })

  it('behåller manuellt val genom rerender med samma option-id:n', () => {
    renderManager({ ...BASE_PROPS, defaultStaffId: 'staff-1' })
    const select = staffSelect()

    act(() => {
      select.value = 'staff-2'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    renderManager({
      ...BASE_PROPS,
      staffOptions: STAFF.map((person) => ({ ...person })),
      defaultStaffId: 'staff-1',
    })

    expect(staffSelect().value).toBe('staff-2')
  })

  it('behåller nuvarande första-option-default när prop saknas', () => {
    renderManager(BASE_PROPS)

    expect(staffSelect().value).toBe('staff-1')
  })

  it('radbryter en lång frånvarorad på smal mobil utan horisontellt spill', () => {
    renderManager({
      ...BASE_PROPS,
      items: [
        {
          id: 'absence-1',
          staffName: 'Ett mycket långt namn',
          rangeLabel: '20 juli 2026 – 31 augusti 2026',
          reason: 'Semester',
          ongoing: false,
        },
      ],
    })

    const row = container.querySelector<HTMLLIElement>('li')
    expect(row?.style.flexWrap).toBe('wrap')
    const actions = row?.lastElementChild as HTMLElement | undefined
    expect(actions?.style.flex).toBe('1 1 auto')
    expect(actions?.style.flexWrap).toBe('wrap')
  })
})
