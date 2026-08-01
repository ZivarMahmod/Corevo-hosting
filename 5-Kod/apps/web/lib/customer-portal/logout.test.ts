import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { logoutCurrentPortalSession } from './logout'

const sessionId = '123e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)

describe('current portal session logout', () => {
  const rpc = vi.fn()
  const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    store.get.mockReturnValue({ value: `v1.${sessionId}.${secret}` })
    mocks.cookies.mockResolvedValue(store)
    mocks.createServiceClient.mockReturnValue({ rpc })
  })

  it('revokes first and clears the cookie only after database success', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ok', snapshot: { tenantSlug: 'freshcut' }, recovery_tenant_slug: null }],
      error: null,
    })
    rpc.mockResolvedValueOnce({ data: 'ok', error: null })

    await expect(logoutCurrentPortalSession()).resolves.toEqual({ ok: true, tenantSlug: 'freshcut' })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'customer_portal_session_snapshot',
      'customer_portal_revoke_session',
    ])
    expect(store.set).toHaveBeenCalledWith('__Host-corevo-portal', '', {
      secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0,
    })
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(store.set.mock.invocationCallOrder[0]!)
  })

  it('retains the cookie on snapshot or revoke failure', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    await expect(logoutCurrentPortalSession()).resolves.toEqual({ ok: false })
    expect(store.set).not.toHaveBeenCalled()

    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ok', snapshot: { tenantSlug: 'freshcut' }, recovery_tenant_slug: null }],
      error: null,
    })
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    await expect(logoutCurrentPortalSession()).resolves.toEqual({ ok: false })
    expect(store.set).not.toHaveBeenCalled()
  })

  it('retains a present malformed local credential and view without touching the backend', async () => {
    store.get.mockReturnValue({ value: 'malformed-local-cookie' })
    await expect(logoutCurrentPortalSession()).resolves.toEqual({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
    expect(store.set).not.toHaveBeenCalled()
  })

  it('treats an already missing cookie as idempotent success without database access', async () => {
    store.get.mockReturnValue(undefined)
    await expect(logoutCurrentPortalSession()).resolves.toEqual({ ok: true, tenantSlug: null })
    expect(rpc).not.toHaveBeenCalled()
    expect(store.set).not.toHaveBeenCalled()
  })

  it('treats an already revoked session as idempotent success when its digest still proves tenant', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'expired', snapshot: null, recovery_tenant_slug: 'freshcut' }],
      error: null,
    })
    rpc.mockResolvedValueOnce({ data: 'ok', error: null })
    await expect(logoutCurrentPortalSession()).resolves.toEqual({ ok: true, tenantSlug: 'freshcut' })
    expect(store.set).toHaveBeenCalledOnce()
  })
})
