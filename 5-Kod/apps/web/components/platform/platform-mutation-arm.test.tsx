// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DomainManager } from './DomainManager'
import { StatusControl } from './StatusControl'
import styles from './platform.module.css'

const mocks = vi.hoisted(() => ({
  setTenantStatus: vi.fn(),
  removeCustomDomain: vi.fn(),
  addCustomDomain: vi.fn(),
  verifyCustomDomain: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/components/portal/ui', () => ({
  useToast: () => ({ notify: mocks.notify }),
}))

vi.mock('@/lib/platform/actions', () => ({
  setTenantStatus: mocks.setTenantStatus,
  removeCustomDomain: mocks.removeCustomDomain,
  addCustomDomain: mocks.addCustomDomain,
  verifyCustomDomain: mocks.verifyCustomDomain,
}))

const DOMAIN_A = {
  id: 'domain-a',
  domain: 'a.example.se',
  verified: true,
  isPrimary: false,
  createdAt: '2026-07-18T10:00:00.000Z',
}
const DOMAIN_B = { ...DOMAIN_A, id: 'domain-b', domain: 'b.example.se' }

let root: Root | null
let container: HTMLDivElement

function button(scope: ParentNode, label: string): HTMLButtonElement {
  const match = [...scope.querySelectorAll('button')].find((node) => node.textContent?.includes(label))
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

function domainRow(domain: string): HTMLLIElement {
  const match = [...container.querySelectorAll('li')].find((node) => node.textContent?.includes(domain))
  if (!(match instanceof HTMLLIElement)) throw new Error(`Domain row not found: ${domain}`)
  return match
}

async function render(node: ReactNode): Promise<void> {
  await act(async () => {
    root!.render(node)
  })
}

async function armPause(): Promise<void> {
  await act(async () => button(container, 'Pausa kund').click())
}

async function armDomain(domain: string): Promise<void> {
  await act(async () => button(domainRow(domain), 'Ta bort').click())
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mocks.setTenantStatus.mockReset().mockResolvedValue({ success: 'Status uppdaterad.' })
  mocks.removeCustomDomain.mockReset().mockResolvedValue({ success: 'Domän borttagen.' })
  mocks.addCustomDomain.mockReset().mockResolvedValue({})
  mocks.verifyCustomDomain.mockReset().mockResolvedValue({})
  mocks.notify.mockReset()
  mocks.refresh.mockReset()
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
    root = null
  }
  container.remove()
  vi.useRealTimers()
})

describe('goal-72 S3/2d: platform mutation arms', () => {
  it('shows a disabled publish action while provisioning is incomplete', async () => {
    await render(
      <StatusControl tenantId="tenant-1" status="provisioning" canActivate={false} />,
    )

    const publish = button(container, 'Publicera kund')
    expect(publish.disabled).toBe(true)
    expect(mocks.setTenantStatus).not.toHaveBeenCalled()
  })

  it('publishes a ready provisioning tenant without a destructive confirmation step', async () => {
    await render(
      <StatusControl tenantId="tenant-1" status="provisioning" canActivate />,
    )

    await act(async () => button(container, 'Publicera kund').click())

    expect(mocks.setTenantStatus).toHaveBeenCalledTimes(1)
    const form = mocks.setTenantStatus.mock.calls[0]?.[1] as FormData
    expect(form.get('tenantId')).toBe('tenant-1')
    expect(form.get('status')).toBe('active')
  })

  it('submits suspension only on the second click and does not restore focus after the result', async () => {
    await render(<StatusControl tenantId="tenant-1" status="active" />)

    await armPause()
    expect(mocks.setTenantStatus).not.toHaveBeenCalled()
    const confirm = button(container, 'Bekräfta paus')
    expect(confirm.getAttribute('aria-describedby')).toBe('suspend-tenant-warning')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('publika sajten blockeras')

    await act(async () => confirm.click())

    expect(mocks.setTenantStatus).toHaveBeenCalledTimes(1)
    const trigger = button(container, 'Pausa kund')
    expect(document.activeElement).not.toBe(trigger)
  })

  it('keeps a slow suspension armed beyond the timeout while progress is pending', async () => {
    let resolveAction!: (result: { success: string }) => void
    mocks.setTenantStatus.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    await render(<StatusControl tenantId="tenant-1" status="active" />)
    await armPause()

    act(() => button(container, 'Bekräfta paus').click())
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => vi.advanceTimersByTime(10_001))
    expect(button(container, 'Uppdaterar…')).toBeTruthy()

    await act(async () => resolveAction({ success: 'Status uppdaterad.' }))
    expect(button(container, 'Pausa kund')).toBeTruthy()
  })

  it.each(['cancel', 'escape', 'timeout'] as const)(
    'restores pause-trigger focus after %s',
    async (exit) => {
      await render(<StatusControl tenantId="tenant-1" status="active" />)
      await armPause()

      if (exit === 'cancel') {
        await act(async () => button(container, 'Avbryt').click())
      } else if (exit === 'escape') {
        await act(async () => {
          button(container, 'Bekräfta paus').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          )
        })
      } else {
        await act(async () => vi.advanceTimersByTime(10_000))
      }

      expect(document.activeElement).toBe(button(container, 'Pausa kund'))
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('disarms pause on tenant selection change without stealing focus', async () => {
    await render(<StatusControl tenantId="tenant-1" status="active" />)
    await armPause()

    await render(<StatusControl tenantId="tenant-2" status="active" />)

    const trigger = button(container, 'Pausa kund')
    expect(document.activeElement).not.toBe(trigger)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes a domain only on the second click and keeps destructive touch classes', async () => {
    await render(
      <DomainManager slug="demo" tenantId="tenant-1" initialDomains={[DOMAIN_A, DOMAIN_B]} />,
    )
    const initial = button(domainRow(DOMAIN_B.domain), 'Ta bort')
    expect(initial.classList.contains(styles.btn!)).toBe(true)
    expect(initial.classList.contains(styles.btnDanger!)).toBe(true)

    await armDomain(DOMAIN_B.domain)
    expect(mocks.removeCustomDomain).not.toHaveBeenCalled()
    const confirm = button(domainRow(DOMAIN_B.domain), 'Säker?')
    expect(confirm.classList.contains(styles.btn!)).toBe(true)
    expect(confirm.classList.contains(styles.btnDanger!)).toBe(true)
    expect(confirm.getAttribute('aria-describedby')).toBe(`remove-domain-warning-${DOMAIN_B.id}`)
    expect(domainRow(DOMAIN_B.domain).querySelector('[role="status"]')?.textContent).toContain(
      'slutar fungera direkt',
    )

    await act(async () => confirm.click())

    expect(mocks.removeCustomDomain).toHaveBeenCalledTimes(1)
  })

  it('keeps a slow domain removal armed beyond the timeout while progress is pending', async () => {
    let resolveAction!: (result: { success: string }) => void
    mocks.removeCustomDomain.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    await render(
      <DomainManager slug="demo" tenantId="tenant-1" initialDomains={[DOMAIN_A, DOMAIN_B]} />,
    )
    await armDomain(DOMAIN_B.domain)

    act(() => button(domainRow(DOMAIN_B.domain), 'Säker?').click())
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => vi.advanceTimersByTime(10_001))
    expect(button(domainRow(DOMAIN_B.domain), '…')).toBeTruthy()

    await act(async () => resolveAction({ success: 'Domän borttagen.' }))
    expect(container.textContent).not.toContain(DOMAIN_B.domain)
  })

  it('does not steal trigger focus after a domain action error', async () => {
    mocks.removeCustomDomain.mockResolvedValueOnce({ error: 'Domänen kunde inte tas bort.' })
    await render(
      <DomainManager slug="demo" tenantId="tenant-1" initialDomains={[DOMAIN_A, DOMAIN_B]} />,
    )
    await armDomain(DOMAIN_B.domain)

    await act(async () => button(domainRow(DOMAIN_B.domain), 'Säker?').click())

    const trigger = button(domainRow(DOMAIN_B.domain), 'Ta bort')
    expect(document.activeElement).not.toBe(trigger)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['cancel', 'escape', 'timeout'] as const)(
    'restores the correct domain trigger after %s',
    async (exit) => {
      await render(
        <DomainManager slug="demo" tenantId="tenant-1" initialDomains={[DOMAIN_A, DOMAIN_B]} />,
      )
      await armDomain(DOMAIN_B.domain)

      if (exit === 'cancel') {
        await act(async () => button(domainRow(DOMAIN_B.domain), 'Ångra').click())
      } else if (exit === 'escape') {
        await act(async () => {
          button(domainRow(DOMAIN_B.domain), 'Säker?').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          )
        })
      } else {
        await act(async () => vi.advanceTimersByTime(10_000))
      }

      expect(document.activeElement).not.toBe(button(domainRow(DOMAIN_A.domain), 'Ta bort'))
      expect(document.activeElement).toBe(button(domainRow(DOMAIN_B.domain), 'Ta bort'))
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('cleans the pause timer when StatusControl unmounts', async () => {
    await render(<StatusControl tenantId="tenant-1" status="active" />)
    await armPause()
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => root?.unmount())
    root = null

    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans the domain timer when DomainManager unmounts', async () => {
    await render(
      <DomainManager slug="demo" tenantId="tenant-1" initialDomains={[DOMAIN_A, DOMAIN_B]} />,
    )
    await armDomain(DOMAIN_A.domain)
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => root?.unmount())
    root = null

    expect(vi.getTimerCount()).toBe(0)
  })
})
