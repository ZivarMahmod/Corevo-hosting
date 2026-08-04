import { describe, it, expect } from 'vitest'
import {
  canonicalPlatformCustomerUrl,
  decideBackofficeRoute,
  type BackofficeHostKind,
} from './host-routing'
import { PLATFORM_ROUTE_PREFIXES } from './platform-routes'

// Production host policy: superbooking = platform, booking = admin + staff.
// Cross-door surfaces redirect to the owning host; the rest bounce home.
const HOSTS = {
  superadmin: 'superbooking.corevo.se',
  platform: 'booking.corevo.se',
}
const decide = (hostKind: BackofficeHostKind, path: string) =>
  decideBackofficeRoute({ hostKind, path, hosts: HOSTS })

describe('superadmin host (superbooking) — platform surfaces only', () => {
  it('serves the dashboard at / via rewrite to /platform', () => {
    expect(decide('superadmin', '/')).toEqual({ action: 'rewrite', to: '/platform' })
  })
  it('never exposes the internal /platform prefix (→ clean /)', () => {
    expect(decide('superadmin', '/platform')).toEqual({ action: 'redirect', to: '/' })
    expect(decide('superadmin', '/platform/x')).toEqual({ action: 'redirect', to: '/' })
  })
  it('passes every platform surface', () => {
    for (const p of PLATFORM_ROUTE_PREFIXES.filter((path) => path !== '/platform')) {
      expect(decide('superadmin', p), p).toEqual({ action: 'pass' })
      expect(decide('superadmin', `${p}/nested`), `${p}/nested`).toEqual({ action: 'pass' })
    }
  })
  it('redirects salon-admin + staff surfaces to their own hosts', () => {
    expect(decide('superadmin', '/admin')).toEqual({
      action: 'redirectHost',
      host: HOSTS.platform,
      to: '/admin',
    })
    expect(decide('superadmin', '/admin/installningar')).toEqual({
      action: 'redirectHost',
      host: HOSTS.platform,
      to: '/admin/installningar',
    })
    expect(decide('superadmin', '/personal')).toEqual({
      action: 'redirectHost',
      host: HOSTS.platform,
      to: '/personal',
    })
  })
  it('bounces anything else (storefront) to the dashboard home', () => {
    expect(decide('superadmin', '/boka')).toEqual({ action: 'redirect', to: '/' })
    expect(decide('superadmin', '/konto')).toEqual({ action: 'redirect', to: '/' })
  })
})

describe('platform host (booking) — admin and staff', () => {
  it('passes the salon-admin surface', () => {
    expect(decide('platform', '/admin')).toEqual({ action: 'pass' })
    expect(decide('platform', '/admin/tjanster')).toEqual({ action: 'pass' })
  })
  it('redirects platform surfaces to superbooking', () => {
    expect(decide('platform', '/kunder')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/kunder',
    })
    expect(decide('platform', '/slutkunder')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/slutkunder',
    })
    expect(decide('platform', '/fakturering')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/fakturering',
    })
  })
  it('serves the staff surfaces too (roll-separation: personalen loggar in här)', () => {
    expect(decide('platform', '/personal')).toEqual({ action: 'pass' })
    expect(decide('platform', '/personal/arbetstider')).toEqual({ action: 'pass' })
  })
  it('sends / (and unknown paths) to the salon-admin entry', () => {
    expect(decide('platform', '/')).toEqual({ action: 'redirect', to: '/admin' })
    expect(decide('platform', '/boka')).toEqual({ action: 'redirect', to: '/admin' })
  })
  it('does NOT confuse /personal-plattform (platform) with /personal (staff)', () => {
    expect(decide('platform', '/personal-plattform')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/personal-plattform',
    })
  })
})

describe('staff compatibility host (minbooking) — published staff contract only', () => {
  it('serves staff routes without creating another staff implementation', () => {
    expect(decide('staff_portal', '/personal')).toEqual({ action: 'pass' })
    expect(decide('staff_portal', '/personal/arbetstider')).toEqual({ action: 'pass' })
  })

  it('moves admin and platform routes to their canonical hosts', () => {
    expect(decide('staff_portal', '/admin')).toEqual({
      action: 'redirectHost',
      host: HOSTS.platform,
      to: '/admin',
    })
    expect(decide('staff_portal', '/kunder')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/kunder',
    })
  })

  it('lands unknown paths on the existing staff surface', () => {
    expect(decide('staff_portal', '/')).toEqual({ action: 'redirect', to: '/personal' })
    expect(decide('staff_portal', '/konto')).toEqual({ action: 'redirect', to: '/personal' })
  })
})

describe('published /salonger compatibility URL', () => {
  const canonical = (
    raw: string,
    hostKind: BackofficeHostKind | null = 'superadmin',
    preview = false,
  ) =>
    canonicalPlatformCustomerUrl(new URL(raw), {
      hostKind,
      preview,
      superadminHost: HOSTS.superadmin,
    })

  it.each([
    ['https://superbooking.corevo.se/salonger', 'https://superbooking.corevo.se/kunder'],
    [
      'https://booking.corevo.se/salonger/tenant-id?tab=drift',
      'https://superbooking.corevo.se/kunder/tenant-id?tab=drift',
    ],
    [
      'https://minbooking.corevo.se/salonger/ny?from=staff',
      'https://superbooking.corevo.se/kunder/ny?from=staff',
    ],
  ])('maps %s in one redirect without losing suffix or query', (legacy, expected) => {
    expect(canonical(legacy)?.toString()).toBe(expected)
  })

  it('keeps preview on its current host', () => {
    expect(
      canonical('http://booking.localhost:3000/salonger/id?tab=drift', 'platform', true)?.toString(),
    ).toBe('http://booking.localhost:3000/kunder/id?tab=drift')
  })

  it.each(['/kunder', '/slutkunder', '/salonger-arkiv', '/admin/salonger'])(
    'does not rewrite unrelated path %s',
    (path) => {
      expect(canonical(`https://superbooking.corevo.se${path}`)).toBeNull()
    },
  )

  it('never maps the alias for a tenant/custom/unknown host', () => {
    expect(canonical('https://freshcut.corevo.se/salonger', null)).toBeNull()
  })
})

describe('auth + api are always allowed on every back-office host', () => {
  const hosts: BackofficeHostKind[] = ['superadmin', 'platform', 'staff_portal']
  for (const h of hosts) {
    it(`${h}: auth recovery pages and /api/* pass`, () => {
      expect(decide(h, '/login')).toEqual({ action: 'pass' })
      expect(decide(h, '/ingen-atkomst')).toEqual({ action: 'pass' })
      expect(decide(h, '/glomt-losenord')).toEqual({ action: 'pass' })
      expect(decide(h, '/aterstall-losenord')).toEqual({ action: 'pass' })
      expect(decide(h, '/fortsatt')).toEqual({ action: 'pass' })
      expect(decide(h, '/api/stripe/webhook')).toEqual({ action: 'pass' })
      expect(decide(h, '/api')).toEqual({ action: 'pass' })
    })
  }
})
