// @vitest-environment happy-dom

import { act, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KunderBoard, buildKunderCsv, type KundCardVM } from './KunderBoard'

const mocks = vi.hoisted(() => ({
  pathname: '/kunder',
  refresh: vi.fn(),
  push: vi.fn(),
  notify: vi.fn(),
  setTenantStatus: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/portal/ui', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Icon: () => <span aria-hidden="true" />,
  useToast: () => ({ notify: mocks.notify }),
}))

vi.mock('@/lib/platform/actions', () => ({ setTenantStatus: mocks.setTenantStatus }))

const TENANTS: KundCardVM[] = [
  {
    id: 'tenant-a',
    slug: 'alpha',
    name: 'Alpha AB',
    markColor: '#123456',
    owner: 'Ada Admin',
    bookings: 11,
    completed: 8,
    staff: 3,
    displayStatus: 'active',
    lastLabel: 'för 1 dag',
    storefrontUrl: 'https://alpha.boka.corevo.se',
    storefrontHost: 'alpha.boka.corevo.se',
    storefrontPublished: true,
  },
  {
    id: 'tenant-b',
    slug: 'beta',
    name: 'Beta AB',
    markColor: '#654321',
    owner: 'Bea Boss',
    themeLabel: 'Edit',
    variantLabel: 'Lugn',
    level: 2,
    bookings: 0,
    completed: 0,
    staff: 1,
    displayStatus: 'suspended',
    lastLabel: '—',
    storefrontUrl: 'https://beta.boka.corevo.se',
    storefrontHost: 'beta.boka.corevo.se',
    storefrontPublished: false,
  },
]

let root: Root
let container: HTMLDivElement

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (node) => node.textContent?.includes(label) || node.getAttribute('aria-label')?.includes(label),
  )
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return found
}

async function render(children: ReactNode = <div data-testid="detail">Detalj</div>) {
  await act(async () => root.render(<KunderBoard tenants={TENANTS}>{children}</KunderBoard>))
}

async function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  await act(async () => {
    setter?.call(input, value)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }))
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  mocks.pathname = '/kunder'
  mocks.refresh.mockReset()
  mocks.push.mockReset()
  mocks.notify.mockReset()
  mocks.setTenantStatus.mockReset().mockResolvedValue({ success: 'Kunden är borttagen.' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('goal-72 customer board behavior', () => {
  it.each([
    ['/kunder', 'list'],
    ['/kunder/tenant-b', 'card'],
    ['/kunder/ny', 'card'],
  ])('derives mobile view from route %s', async (pathname, expected) => {
    mocks.pathname = pathname
    await render()
    expect(container.firstElementChild?.getAttribute('data-mobile-view')).toBe(expected)
  })

  it('marks only the selected master row', async () => {
    mocks.pathname = '/kunder/tenant-b'
    await render()

    expect(
      container.querySelector('a[href="/kunder/tenant-b"]')?.getAttribute('aria-current'),
    ).toBe('page')
    expect(
      container.querySelector('a[href="/kunder/tenant-a"]')?.hasAttribute('aria-current'),
    ).toBe(false)
  })

  it('searches name, owner and subdomain and filters status without losing detail', async () => {
    await render()
    const input = container.querySelector('input[aria-label="Sök kund"]') as HTMLInputElement

    for (const term of ['Beta AB', 'bea boss', 'beta']) {
      await setInput(input, term)
      expect(container.textContent).not.toContain('Alpha AB')
      expect(container.textContent).toContain('Beta AB')
      expect(container.textContent).toContain('Detalj')
    }

    await setInput(input, '')
    await act(async () => {
      button('Aktiv').click()
    })
    expect(container.textContent).toContain('Alpha AB')
    expect(container.textContent).not.toContain('Beta AB')

    await act(async () => {
      button('Pausad').click()
    })
    expect(container.textContent).not.toContain('Alpha AB')
    expect(container.textContent).toContain('Beta AB')
  })

  it('builds CSV from the filtered rows with honest fields', () => {
    const csv = buildKunderCsv([TENANTS[1]!])
    expect(csv).toBe(
      'Namn,Subdomän,Ägare,Status,Bokningar,Genomförda,Personal,Senast,Tema,Variant,Nivå\r\n' +
        'Beta AB,beta.boka.corevo.se,Bea Boss,Pausad,0,0,1,—,Edit,Lugn,Nivå 2',
    )
  })

  it('preserves storefront access and submits soft-delete only after explicit confirmation', async () => {
    await render()
    expect(container.querySelector('a[href="https://alpha.boka.corevo.se"]')).not.toBeNull()
    expect(container.querySelector('a[href="https://beta.boka.corevo.se"]')).toBeNull()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    const removeItem = button('Ta bort kund')
    expect(document.activeElement).toBe(removeItem)
    await act(async () => removeItem.click())
    expect(mocks.setTenantStatus).not.toHaveBeenCalled()

    const confirm = button('Bekräfta borttagning')
    expect(document.activeElement).toBe(confirm)
    await act(async () => confirm.click())
    expect(mocks.setTenantStatus).toHaveBeenCalledTimes(1)
    const form = mocks.setTenantStatus.mock.calls[0]?.[1] as FormData
    expect(form.get('tenantId')).toBe('tenant-a')
    expect(form.get('status')).toBe('deleted')
  })

  it('keeps a failed delete armed for retry and preserves confirm focus', async () => {
    mocks.setTenantStatus.mockResolvedValueOnce({ error: 'Försök igen.' })
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    const confirm = button('Bekräfta borttagning')
    expect(mocks.notify).toHaveBeenCalledWith('Försök igen.', 'warning')
    expect(confirm.disabled).toBe(false)
    expect(document.activeElement).toBe(confirm)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('turns a rejected delete into a retryable warning without leaking the rejection', async () => {
    mocks.setTenantStatus.mockRejectedValueOnce(new Error('network down'))
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    const confirm = button('Bekräfta borttagning')
    expect(mocks.notify).toHaveBeenCalledWith(
      'Kunde inte ta bort kunden. Försök igen.',
      'warning',
    )
    expect(confirm.disabled).toBe(false)
    expect(document.activeElement).toBe(confirm)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('does not redirect away from a newer selection when delete resolves late', async () => {
    const action = deferred<{ success: string }>()
    mocks.pathname = '/kunder/tenant-a'
    mocks.setTenantStatus.mockReturnValueOnce(action.promise)
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    mocks.pathname = '/kunder/tenant-b'
    await render()
    await act(async () => action.resolve({ success: 'Kunden är borttagen.' }))

    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(
      container.querySelector('a[href="/kunder/tenant-b"]')?.getAttribute('aria-current'),
    ).toBe('page')
  })

  it('invalidates a pending delete as soon as a newer customer link is clicked', async () => {
    const action = deferred<{ success: string }>()
    mocks.pathname = '/kunder/tenant-a'
    mocks.setTenantStatus.mockReturnValueOnce(action.promise)
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    const newerCustomer = container.querySelector('a[href="/kunder/tenant-b"]')
    if (!(newerCustomer instanceof HTMLAnchorElement)) throw new Error('Customer link missing')
    await act(async () => newerCustomer.click())
    await act(async () => action.resolve({ success: 'Kunden är borttagen.' }))

    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the delete redirect when the already-selected customer link is clicked', async () => {
    const action = deferred<{ success: string }>()
    mocks.pathname = '/kunder/tenant-a'
    mocks.setTenantStatus.mockReturnValueOnce(action.promise)
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    const selectedCustomer = container.querySelector('a[href="/kunder/tenant-a"]')
    if (!(selectedCustomer instanceof HTMLAnchorElement)) throw new Error('Customer link missing')
    await act(async () => selectedCustomer.click())
    await act(async () => action.resolve({ success: 'Kunden är borttagen.' }))

    expect(mocks.push).toHaveBeenCalledWith('/kunder')
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('does not re-arm an old customer when a late delete fails after navigation', async () => {
    const action = deferred<{ error: string }>()
    mocks.pathname = '/kunder/tenant-a'
    mocks.setTenantStatus.mockReturnValueOnce(action.promise)
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    mocks.pathname = '/kunder/tenant-b'
    await render()
    await act(async () => action.resolve({ error: 'Försök igen.' }))

    expect(container.textContent).not.toContain('Bekräfta borttagning')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('navigates away from a deleted selected customer and refreshes the master list', async () => {
    mocks.pathname = '/kunder/tenant-a'
    await render()

    await act(async () => button('Fler åtgärder för Alpha AB').click())
    await act(async () => button('Ta bort kund').click())
    await act(async () => button('Bekräfta borttagning').click())

    expect(mocks.push).toHaveBeenCalledWith('/kunder')
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('auto-disarms a row deletion and restores its own kebab focus', async () => {
    await render()
    const trigger = button('Fler åtgärder för Alpha AB')
    await act(async () => trigger.click())
    await act(async () => button('Ta bort kund').click())

    await act(async () => vi.advanceTimersByTime(10_000))

    expect(container.textContent).not.toContain('Bekräfta borttagning')
    expect(document.activeElement).toBe(trigger)
    expect(vi.getTimerCount()).toBe(0)
  })
})
