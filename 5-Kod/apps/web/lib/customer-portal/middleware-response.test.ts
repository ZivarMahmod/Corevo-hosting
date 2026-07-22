import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }))
vi.mock('@/lib/supabase/middleware', () => ({ updateSession: mocks.updateSession }))

import { middleware } from '../../middleware'

function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('host', 'mina.corevo.se')
  return new NextRequest(`https://mina.corevo.se${path}`, { ...init, headers })
}

function expectPrivate(response: NextResponse) {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
}

describe('customer portal middleware response privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSession.mockResolvedValue({ response: NextResponse.next(), user: null })
  })

  it('hardens an allowed portal page response', async () => {
    const response = await middleware(request('/mina'))
    expect(response.status).toBe(200)
    expectPrivate(response)
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('hardens a denied portal-host response', async () => {
    const response = await middleware(request('/admin'))
    expect(response.status).toBe(404)
    expectPrivate(response)
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('hardens Next server-action requests on the portal host', async () => {
    const response = await middleware(request('/aterhamta/freshcut', {
      method: 'POST',
      headers: { 'next-action': 'action-id' },
    }))
    expect(response.status).toBe(200)
    expectPrivate(response)
  })

  it('does not force portal response headers onto another host', async () => {
    const response = await middleware(new NextRequest('https://demo.corevo.se/', {
      headers: { host: 'demo.corevo.se' },
    }))
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('referrer-policy')).toBeNull()
    expect(mocks.updateSession).toHaveBeenCalledOnce()
  })
})
