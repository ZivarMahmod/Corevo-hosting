// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenLinkExchange } from './OpenLinkExchange'

const mocks = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))

const id = '123e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)
let container: HTMLDivElement
let root: Root

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('OpenLinkExchange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('clears the fragment before POST and replaces navigation after success', async () => {
    window.history.replaceState({}, '', `/oppna/freshcut?utm_source=sms#v1.${id}.${secret}`)
    const fetchMock = vi.fn(async () => {
      expect(window.location.hash).toBe('')
      expect(window.location.search).toBe('')
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<OpenLinkExchange tenantSlug="freshcut" />))
    await act(async () => Promise.resolve())

    expect(fetchMock).toHaveBeenCalledWith('/api/customer-portal/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantSlug: 'freshcut', linkPublicId: id, secret, keyVersion: 1 }),
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    })
    expect(mocks.replace).toHaveBeenCalledWith('/mina')
  })

  it('shows only neutral bootstrap/error copy and never POSTs malformed fragments', async () => {
    window.history.replaceState({}, '', '/oppna/freshcut#bad')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<OpenLinkExchange tenantSlug="freshcut" />))

    expect(window.location.hash).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Länken kan inte användas')
    expect(container.textContent).not.toContain('bad')
  })
})
