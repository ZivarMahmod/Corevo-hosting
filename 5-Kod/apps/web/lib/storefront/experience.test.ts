import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  isMotiontestPublicPath,
  storefrontExperienceForHost,
  storefrontExperienceFromHeader,
} from './experience'

const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }))
vi.mock('@/lib/supabase/middleware', () => ({ updateSession: mocks.updateSession }))

import { middleware } from '../../middleware'

describe('FreshCut motiontest storefront experience', () => {
  it('accepts only the exact trusted middleware header value', () => {
    expect(storefrontExperienceFromHeader('freshcut-motiontest')).toBe('freshcut-motiontest')

    for (const value of [
      null,
      undefined,
      '',
      'FreshCut-motiontest',
      'freshcut-motiontest ',
      'motiontest.corevo.se',
      '/?experience=freshcut-motiontest',
      'unknown',
    ]) {
      expect(storefrontExperienceFromHeader(value), String(value)).toBeNull()
    }
  })

  it('maps only the exact production and local aliases to FreshCut', () => {
    expect(storefrontExperienceForHost('motiontest.corevo.se')).toEqual({
      experience: 'freshcut-motiontest',
      tenantSlug: 'freshcut',
    })
    expect(storefrontExperienceForHost('MOTIONTEST.LOCALHOST:3000')).toEqual({
      experience: 'freshcut-motiontest',
      tenantSlug: 'freshcut',
    })
  })

  it('does not let ordinary or deceptive hosts select the prototype', () => {
    expect(storefrontExperienceForHost('freshcut.corevo.se')).toBeNull()
    expect(storefrontExperienceForHost('motiontest.corevo.se.attacker.test')).toBeNull()
    expect(storefrontExperienceForHost('evil-motiontest.localhost')).toBeNull()
  })

  it('accepts only an exact motiontest authority with an optional valid numeric port', () => {
    expect(storefrontExperienceForHost('MOTIONTEST.COREVO.SE:443')).not.toBeNull()
    expect(storefrontExperienceForHost('motiontest.localhost:3000')).not.toBeNull()

    for (const host of [
      'motiontest.corevo.se:',
      'motiontest.corevo.se:https',
      'motiontest.corevo.se:0',
      'motiontest.corevo.se:65536',
      'motiontest.corevo.se:443.attacker.test',
      'motiontest.localhost:3000.attacker.test',
      'motiontest.corevo.se:443:444',
      'user@motiontest.corevo.se',
      ' motiontest.corevo.se',
      'motiontest.corevo.se ',
    ]) {
      expect(storefrontExperienceForHost(host), host).toBeNull()
    }
  })

  it('allows only the home page and its explicit public metadata and assets', () => {
    for (const pathname of [
      '/',
      '/robots.txt',
      '/favicon.ico',
      '/icon.svg',
      '/_next/static/chunks/app.js',
      '/images/freshcut/freshcut-hero.webp',
    ]) {
      expect(isMotiontestPublicPath(pathname), pathname).toBe(true)
    }
  })

  it('allows image optimization only for an exact local FreshCut source', () => {
    expect(
      isMotiontestPublicPath(
        '/_next/image',
        new URLSearchParams('url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75'),
      ),
    ).toBe(true)
  })

  it('rejects missing, remote, deceptive, and traversal image sources', () => {
    for (const url of [
      null,
      'https://attacker.test/image.webp',
      '//attacker.test/image.webp',
      '/images/freshcut-evil/image.webp',
      '/images/other-tenant.webp',
      '/images/freshcut/../other-tenant.webp',
      '/images/freshcut/%2e%2e/other-tenant.webp',
      '/images/freshcut/%252e%252e/other-tenant.webp',
    ]) {
      const search = url === null ? new URLSearchParams() : new URLSearchParams({ url })
      expect(isMotiontestPublicPath('/_next/image', search), String(url)).toBe(false)
    }
  })

  it('fails closed for alternate pages, APIs, and unrelated public files', () => {
    for (const pathname of [
      '/admin',
      '/api/anything',
      '/boka',
      '/login',
      '/sitemap.xml',
      '/images/other-tenant.webp',
      '/_next/data/build-id/index.json',
    ]) {
      expect(isMotiontestPublicPath(pathname), pathname).toBe(false)
    }
  })
})

describe('FreshCut motiontest middleware boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSession.mockResolvedValue({ response: NextResponse.next(), user: null })
  })

  it('rejects an alternate application route directly before auth routing', async () => {
    const response = await middleware(
      new NextRequest('https://motiontest.corevo.se/admin', {
        headers: { host: 'motiontest.corevo.se' },
      }),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('replaces client-supplied tenant and experience headers from the exact host', async () => {
    await middleware(
      new NextRequest('https://motiontest.corevo.se/', {
        headers: {
          host: 'motiontest.corevo.se',
          'x-corevo-storefront-experience': 'attacker-experience',
          'x-corevo-tenant-kind': 'platform',
          'x-corevo-tenant-slug': 'attacker-tenant',
          'x-corevo-reserved-subdomain': 'admin',
        },
      }),
    )

    const trustedHeaders = mocks.updateSession.mock.calls[0]?.[1] as Headers
    expect(trustedHeaders.get('x-corevo-storefront-experience')).toBe('freshcut-motiontest')
    expect(trustedHeaders.get('x-corevo-tenant-kind')).toBe('tenant')
    expect(trustedHeaders.get('x-corevo-tenant-slug')).toBe('freshcut')
    expect(trustedHeaders.get('x-corevo-reserved-subdomain')).toBeNull()
  })
})
