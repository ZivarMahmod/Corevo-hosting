// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/aterhamta/freshcut',
  useRouter: () => ({ replace: vi.fn() }),
}))

import { PortalShell } from './PortalShell'
import { RecoveryForm } from './RecoveryForm'

let container: HTMLDivElement
let root: Root

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('PortalShell recovery focus ownership', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('preserves RecoveryForm autofocus instead of moving focus to the route main', async () => {
    await act(async () => root.render(
      <PortalShell variant="recovery">
        <RecoveryForm tenantSlug="freshcut" tenantName="FreshCut" startAction={vi.fn()} />
      </PortalShell>,
    ))

    expect(document.activeElement).toBe(container.querySelector('#kontakt'))
    expect(document.activeElement).not.toBe(container.querySelector('#huvudinnehall'))
  })
})
