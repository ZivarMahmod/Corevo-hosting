import { describe, expect, it } from 'vitest'
import { buildPortalRebookUrl, validatePortalBookingOrigin } from './rebook'

const tenant = {
  tenantSlug: 'freshcut',
  bookingOrigin: 'https://freshcut.boka.corevo.se',
}

describe('portal rebook origin firewall', () => {
  it.each([
    ['canonical tenant booking host', 'freshcut', 'https://freshcut.boka.corevo.se'],
    ['verified external custom domain', 'freshcut', 'https://boka.freshcut.se'],
  ])('accepts the %s', (_name, tenantSlug, origin) => {
    expect(validatePortalBookingOrigin({ tenantSlug, bookingOrigin: origin })).toBe(origin)
  })

  it.each([
    ['legacy tenant host', 'https://freshcut.corevo.se'],
    ['other tenant', 'https://other.boka.corevo.se'],
    ['platform root', 'https://corevo.se'],
    ['internal host', 'https://internal.example.se'],
    ['admin host', 'https://admin.example.se'],
    ['portal host', 'https://portal.example.se'],
    ['sms host', 'https://sms.example.se'],
    ['localhost', 'https://localhost'],
    ['localhost suffix', 'https://x.localhost'],
    ['IPv4', 'https://127.0.0.1'],
    ['IPv6', 'https://[::1]'],
    ['userinfo', 'https://user@boka.freshcut.se'],
    ['password', 'https://user:pass@boka.freshcut.se'],
    ['port', 'https://boka.freshcut.se:444'],
    ['http', 'http://boka.freshcut.se'],
    ['protocol-relative', '//boka.freshcut.se'],
    ['path', 'https://boka.freshcut.se/boka'],
    ['query', 'https://boka.freshcut.se?x=1'],
    ['fragment', 'https://boka.freshcut.se#x'],
    ['punycode', 'https://xn--freshct-5za.se'],
    ['corevo subdomain claim', 'https://evil.corevo.se'],
    ['corevo suffix lookalike', 'https://freshcut.boka.corevo.se.evil.test'],
    ['corevo label lookalike', 'https://corevo-se.example'],
  ])('rejects %s', (_name, bookingOrigin) => {
    expect(validatePortalBookingOrigin({ tenantSlug: 'freshcut', bookingOrigin })).toBeNull()
  })

  it.each(['', '-freshcut', 'freshcut-', 'FreshCut', 'fresh.cut', 'xn--freshct-5za'])('rejects tenant slug %s', (tenantSlug) => {
    expect(validatePortalBookingOrigin({
      tenantSlug,
      bookingOrigin: 'https://freshcut.boka.corevo.se',
    })).toBeNull()
  })
})

describe('buildPortalRebookUrl', () => {
  it('builds the empty-state target from the bound session origin', () => {
    expect(buildPortalRebookUrl(tenant)).toBe('https://freshcut.boka.corevo.se/boka')
  })

  it.each([
    'https://freshcut.boka.corevo.se/boka',
    'https://freshcut.boka.corevo.se/boka?tjanst=123e4567-e89b-42d3-a456-426614174000',
    'https://freshcut.boka.corevo.se/boka?plats=223e4567-e89b-42d3-a456-426614174000',
    'https://freshcut.boka.corevo.se/boka?plats=223e4567-e89b-42d3-a456-426614174000&tjanst=123e4567-e89b-42d3-a456-426614174000',
  ])('accepts a canonical same-origin booking target: %s', (bookingUrl) => {
    expect(buildPortalRebookUrl({ ...tenant, bookingUrl })).toBe(bookingUrl)
  })

  it.each([
    ['missing booking URL', null],
    ['other tenant', 'https://other.boka.corevo.se/boka'],
    ['other custom origin', 'https://booking.attacker.example/boka'],
    ['legacy host', 'https://freshcut.corevo.se/boka'],
    ['internal route', 'https://freshcut.boka.corevo.se/admin'],
    ['portal route', 'https://freshcut.boka.corevo.se/mina'],
    ['fragment', 'https://freshcut.boka.corevo.se/boka#x'],
    ['unknown query', 'https://freshcut.boka.corevo.se/boka?next=https://evil.example'],
    ['duplicate service', 'https://freshcut.boka.corevo.se/boka?tjanst=123e4567-e89b-42d3-a456-426614174000&tjanst=223e4567-e89b-42d3-a456-426614174000'],
    ['duplicate location', 'https://freshcut.boka.corevo.se/boka?plats=123e4567-e89b-42d3-a456-426614174000&plats=223e4567-e89b-42d3-a456-426614174000'],
    ['invalid service', 'https://freshcut.boka.corevo.se/boka?tjanst=not-a-uuid'],
    ['invalid location', 'https://freshcut.boka.corevo.se/boka?plats=not-a-uuid'],
    ['reversed context order', 'https://freshcut.boka.corevo.se/boka?tjanst=123e4567-e89b-42d3-a456-426614174000&plats=223e4567-e89b-42d3-a456-426614174000'],
    ['userinfo', 'https://freshcut.boka.corevo.se@evil.example/boka'],
    ['port', 'https://freshcut.boka.corevo.se:443/boka'],
    ['protocol-relative', '//freshcut.boka.corevo.se/boka'],
  ] as const)('hides %s', (_name, bookingUrl) => {
    expect(buildPortalRebookUrl({ ...tenant, bookingUrl })).toBeNull()
  })

  it('keeps custom-domain targets bound to the same verified session origin', () => {
    expect(buildPortalRebookUrl({
      tenantSlug: 'freshcut',
      bookingOrigin: 'https://boka.freshcut.se',
      bookingUrl: 'https://boka.freshcut.se/boka',
    })).toBe('https://boka.freshcut.se/boka')
  })
})
