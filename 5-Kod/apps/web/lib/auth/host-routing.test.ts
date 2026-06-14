import { describe, it, expect } from 'vitest'
import { decideBackofficeRoute, type BackofficeHostKind } from './host-routing'

// goal-27 — 3-door back-office grind. These lock the PRODUCTION host policy:
// superbooking = platform surfaces, booking = salon admin, minbooking = staff.
// Cross-door surfaces redirect to the owning host; the rest bounce home.
const HOSTS = {
  superadmin: 'superbooking.corevo.se',
  platform: 'booking.corevo.se',
  staff: 'minbooking.corevo.se',
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
    for (const p of [
      '/salonger',
      '/salonger/abc',
      '/fakturering',
      '/kunder',
      '/roller',
      '/installningar',
      '/drift-och-logg',
      '/integrationer',
      '/personal-plattform',
    ]) {
      expect(decide('superadmin', p), p).toEqual({ action: 'pass' })
    }
  })
  it('redirects salon-admin + staff surfaces to their own hosts', () => {
    expect(decide('superadmin', '/admin')).toEqual({ action: 'redirectHost', host: HOSTS.platform, to: '/admin' })
    expect(decide('superadmin', '/admin/installningar')).toEqual({
      action: 'redirectHost',
      host: HOSTS.platform,
      to: '/admin/installningar',
    })
    expect(decide('superadmin', '/personal')).toEqual({ action: 'redirectHost', host: HOSTS.staff, to: '/personal' })
  })
  it('bounces anything else (storefront) to the dashboard home', () => {
    expect(decide('superadmin', '/boka')).toEqual({ action: 'redirect', to: '/' })
    expect(decide('superadmin', '/konto')).toEqual({ action: 'redirect', to: '/' })
  })
})

describe('platform host (booking) — salon admin only', () => {
  it('passes the salon-admin surface', () => {
    expect(decide('platform', '/admin')).toEqual({ action: 'pass' })
    expect(decide('platform', '/admin/tjanster')).toEqual({ action: 'pass' })
  })
  it('redirects platform surfaces to superbooking', () => {
    expect(decide('platform', '/salonger')).toEqual({ action: 'redirectHost', host: HOSTS.superadmin, to: '/salonger' })
    expect(decide('platform', '/fakturering')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/fakturering',
    })
  })
  it('redirects staff surfaces to minbooking', () => {
    expect(decide('platform', '/personal')).toEqual({ action: 'redirectHost', host: HOSTS.staff, to: '/personal' })
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

describe('staff_portal host (minbooking) — staff schedule only', () => {
  it('passes the staff surface', () => {
    expect(decide('staff_portal', '/personal')).toEqual({ action: 'pass' })
    expect(decide('staff_portal', '/personal/arbetstider')).toEqual({ action: 'pass' })
  })
  it('redirects platform + admin surfaces to their hosts', () => {
    expect(decide('staff_portal', '/salonger')).toEqual({
      action: 'redirectHost',
      host: HOSTS.superadmin,
      to: '/salonger',
    })
    expect(decide('staff_portal', '/admin')).toEqual({ action: 'redirectHost', host: HOSTS.platform, to: '/admin' })
  })
  it('sends / (and unknown paths) to /personal', () => {
    expect(decide('staff_portal', '/')).toEqual({ action: 'redirect', to: '/personal' })
    expect(decide('staff_portal', '/konto')).toEqual({ action: 'redirect', to: '/personal' })
  })
})

describe('auth + api are always allowed on every back-office host', () => {
  const hosts: BackofficeHostKind[] = ['superadmin', 'platform', 'staff_portal']
  for (const h of hosts) {
    it(`${h}: /login, /ingen-atkomst, /api/* pass`, () => {
      expect(decide(h, '/login')).toEqual({ action: 'pass' })
      expect(decide(h, '/ingen-atkomst')).toEqual({ action: 'pass' })
      expect(decide(h, '/api/stripe/webhook')).toEqual({ action: 'pass' })
      expect(decide(h, '/api')).toEqual({ action: 'pass' })
    })
  }
})
