import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_PORTAL_ROUTE_PATTERNS,
  decideCustomerPortalHostRoute,
  isStaticRequestPath,
} from './host-routing'

const portal = (pathname: string) =>
  decideCustomerPortalHostRoute({ hostKind: 'customer_portal', pathname, preview: false })

describe('customer portal host route firewall', () => {
  it('allows exactly the 11 canonical page-route families on mina.corevo.se', () => {
    expect(CUSTOMER_PORTAL_ROUTE_PATTERNS).toHaveLength(11)
    for (const pathname of [
      '/oppna/freshcut',
      '/aterhamta/freshcut',
      '/verifiera/freshcut',
      '/hjalp',
      '/mina',
      '/mina/historik',
      '/mina/bokningar/booking-1',
      '/mina/profil',
      '/mina/sakerhet',
      '/mina/installera',
      '/mina/integritet',
    ]) {
      expect(portal(pathname), pathname).toBe('allow')
      expect(portal(`${pathname}/`), `${pathname}/`).toBe('allow')
    }
  })

  it('allows only the portal API and explicit Next/PWA assets on mina.corevo.se', () => {
    for (const pathname of [
      '/api/customer-portal/exchange',
      '/api/customer-portal/bookings/b1/calendar',
      '/_next/static/chunks/app.js',
      '/_next/static/css/app.css',
      '/pwa/customer-portal-icon-192.png',
      '/pwa/customer-portal-icon-512.png',
      '/favicon.ico',
      '/icon.svg',
    ]) {
      expect(portal(pathname), pathname).toBe('allow')
    }
  })

  it('fails closed for every other route or asset on mina.corevo.se', () => {
    for (const pathname of [
      '/',
      '/konto',
      '/admin',
      '/api/booking/health',
      '/robots.txt',
      '/logo.png',
      '/pwa/admin-icon.svg',
      '/_next/image',
      '/mina/okand',
      '/mina/bokningar/a/b',
      '/oppna/a/b',
    ]) {
      expect(portal(pathname), pathname).toBe('deny')
    }
  })

  it('denies portal page/API namespaces on every non-preview production host', () => {
    for (const hostKind of [
      'tenant',
      'platform',
      'superadmin',
      'staff_portal',
      'root',
      'reserved',
      'unknown',
    ] as const) {
      expect(
        decideCustomerPortalHostRoute({ hostKind, pathname: '/mina', preview: false }),
        hostKind,
      ).toBe('deny')
      expect(
        decideCustomerPortalHostRoute({
          hostKind,
          pathname: '/api/customer-portal/exchange',
          preview: false,
        }),
        hostKind,
      ).toBe('deny')
      expect(
        decideCustomerPortalHostRoute({ hostKind, pathname: '/konto', preview: false }),
        hostKind,
      ).toBe('allow')
    }
  })

  it('lets localhost/workers.dev exercise canonical portal routes but rejects malformed portal paths', () => {
    expect(
      decideCustomerPortalHostRoute({ hostKind: 'root', pathname: '/mina', preview: true }),
    ).toBe('allow')
    expect(
      decideCustomerPortalHostRoute({
        hostKind: 'unknown',
        pathname: '/api/customer-portal/exchange',
        preview: true,
      }),
    ).toBe('allow')
    expect(
      decideCustomerPortalHostRoute({ hostKind: 'tenant', pathname: '/mina/okand', preview: true }),
    ).toBe('deny')
    expect(
      decideCustomerPortalHostRoute({ hostKind: 'root', pathname: '/konto', preview: true }),
    ).toBe('allow')
  })

  it('preserves the old non-portal static bypass without swallowing other Next routes', () => {
    expect(isStaticRequestPath('/_next/static/chunks/app.js')).toBe(true)
    expect(isStaticRequestPath('/_next/image')).toBe(true)
    expect(isStaticRequestPath('/logo.png')).toBe(true)
    expect(isStaticRequestPath('/_next/data/build-id/mina.json')).toBe(false)
    expect(isStaticRequestPath('/_next/webpack-hmr')).toBe(false)
  })
})
