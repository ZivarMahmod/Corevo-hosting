import { describe, it, expect } from 'vitest'
import { getTenantFromHost, isExternalHost, isPreviewHost, RESERVED_SUBDOMAINS } from './tenant'

// Explicit opts so these don't depend on NEXT_PUBLIC_* env in the test runner.
const OPTS = {
  rootDomain: 'corevo.se',
  platformHost: 'booking.corevo.se',
  superadminHost: 'superbooking.corevo.se',
  staffHost: 'minbooking.corevo.se',
  customerPortalHost: 'mina.corevo.se',
  tenantHostSuffix: 'boka.corevo.se',
}

describe('getTenantFromHost — host suffix classification', () => {
  it('resolves a real subdomain to its tenant slug', () => {
    expect(getTenantFromHost('freshcut.corevo.se', OPTS)).toEqual({ kind: 'tenant', slug: 'freshcut' })
  })

  it('classifies the platform host', () => {
    expect(getTenantFromHost('booking.corevo.se', OPTS)).toEqual({ kind: 'platform' })
  })

  it('classifies the bare apex as root', () => {
    expect(getTenantFromHost('corevo.se', OPTS)).toEqual({ kind: 'root' })
  })

  it('classifies a reserved subdomain (not a tenant)', () => {
    expect(getTenantFromHost('admin.corevo.se', OPTS)).toEqual({ kind: 'reserved', subdomain: 'admin' })
  })

  it('goal-27: classifies the three back-office doors by exact host', () => {
    expect(getTenantFromHost('superbooking.corevo.se', OPTS)).toEqual({ kind: 'superadmin' })
    expect(getTenantFromHost('minbooking.corevo.se', OPTS)).toEqual({ kind: 'staff_portal' })
    expect(getTenantFromHost('booking.corevo.se', OPTS)).toEqual({ kind: 'platform' })
  })

  it('classifies mina.corevo.se as the customer portal before tenant matching', () => {
    expect(getTenantFromHost('mina.corevo.se')).toEqual({ kind: 'customer_portal' })
    expect(
      getTenantFromHost('mina.corevo.se', {
        ...OPTS,
        search: new URLSearchParams('tenant=evil'),
      }),
    ).toEqual({ kind: 'customer_portal' })
  })

  it('goal-27: superbooking/minbooking resolve to their door kind, NOT reserved', () => {
    // The host-equality check must win over classify()'s reserved branch even
    // though both names are in the reserved list (for the slug validator).
    expect(getTenantFromHost('superbooking.corevo.se', OPTS)).not.toMatchObject({ kind: 'reserved' })
    expect(getTenantFromHost('minbooking.corevo.se', OPTS)).not.toMatchObject({ kind: 'reserved' })
  })

  it('returns unknown for an external custom domain (→ goal-16 fallback territory)', () => {
    expect(getTenantFromHost('boka.minsalong.se', OPTS)).toEqual({ kind: 'unknown' })
  })

  it('goal-28: <slug>.boka.corevo.se resolves to the salon storefront tenant', () => {
    expect(getTenantFromHost('demo.boka.corevo.se', OPTS)).toEqual({ kind: 'tenant', slug: 'demo' })
    expect(getTenantFromHost('freshcut.boka.corevo.se', OPTS)).toEqual({
      kind: 'tenant',
      slug: 'freshcut',
    })
  })

  it('goal-28: the bare boka.corevo.se branch apex is NOT a tenant', () => {
    expect(getTenantFromHost('boka.corevo.se', OPTS)).toEqual({ kind: 'reserved', subdomain: 'boka' })
    expect(getTenantFromHost('boka.corevo.se', OPTS)).not.toMatchObject({ kind: 'tenant' })
  })

  it('fix-29: a non-reserved subdomain that merely STARTS with "boka" is still a tenant', () => {
    // 'boka' is reserved, but 'xboka' is not — the bare apex check is exact, so
    // xboka.corevo.se must resolve to tenant(xboka), never collide with the branch.
    expect(getTenantFromHost('xboka.corevo.se', OPTS)).toEqual({ kind: 'tenant', slug: 'xboka' })
  })

  it('fix-29: an external custom domain never becomes a tenant via the boka branch', () => {
    expect(getTenantFromHost('app.evil.com', OPTS)).toEqual({ kind: 'unknown' })
    expect(getTenantFromHost('boka.evil.com', OPTS)).toEqual({ kind: 'unknown' })
  })

  it('fix-29: slug "boka" is reserved (cannot be registered as a salon)', () => {
    expect(RESERVED_SUBDOMAINS).toContain('boka')
  })

  it('customer portal label "mina" is reserved (cannot be registered as a salon)', () => {
    expect(RESERVED_SUBDOMAINS).toContain('mina')
  })

  it('goal-28: the boka branch is read from env, not hardcoded (suffix override honored)', () => {
    expect(getTenantFromHost('demo.book.example.com', { ...OPTS, tenantHostSuffix: 'book.example.com' })).toEqual({
      kind: 'tenant',
      slug: 'demo',
    })
  })

  it('POS-SAFETY: a bare *.corevo.se subdomain is unchanged by the boka branch', () => {
    // The boka block must NEVER hijack a plain POS subdomain on the shared zone.
    expect(getTenantFromHost('admin.corevo.se', OPTS)).toEqual({ kind: 'reserved', subdomain: 'admin' })
    expect(getTenantFromHost('kiosk.corevo.se', OPTS)).toEqual({ kind: 'reserved', subdomain: 'kiosk' })
    expect(getTenantFromHost('superadmin.corevo.se', OPTS)).toEqual({
      kind: 'reserved',
      subdomain: 'superadmin',
    })
    expect(getTenantFromHost('corevo.se', OPTS)).toEqual({ kind: 'root' })
    // The three back-office doors stay on their own kinds.
    expect(getTenantFromHost('booking.corevo.se', OPTS)).toEqual({ kind: 'platform' })
    expect(getTenantFromHost('superbooking.corevo.se', OPTS)).toEqual({ kind: 'superadmin' })
    expect(getTenantFromHost('minbooking.corevo.se', OPTS)).toEqual({ kind: 'staff_portal' })
  })

  it('REGRESSION: demo.corevo.se classifies as a .corevo.se subdomain BEFORE any custom-domain lookup', () => {
    // goal-16 recon: the custom-domain RPC branch must never be reached for our own
    // suffix; demo.corevo.se is a subdomain match (kind:tenant), not 'unknown'.
    expect(getTenantFromHost('demo.corevo.se', OPTS)).toEqual({ kind: 'tenant', slug: 'demo' })
  })
})

describe('isExternalHost — custom-domain lookup candidacy', () => {
  it('is TRUE for a real external domain', () => {
    expect(isExternalHost('boka.minsalong.se', OPTS)).toBe(true)
    expect(isExternalHost('kund.se', OPTS)).toBe(true)
  })

  it('is FALSE for our own apex / platform / subdomains', () => {
    expect(isExternalHost('corevo.se', OPTS)).toBe(false)
    expect(isExternalHost('booking.corevo.se', OPTS)).toBe(false)
    expect(isExternalHost('freshcut.corevo.se', OPTS)).toBe(false)
  })

  it('is FALSE for staging/dev noise (workers.dev, localhost, IP)', () => {
    expect(isExternalHost('bokningsplatformen.abc.workers.dev', OPTS)).toBe(false)
    expect(isExternalHost('localhost', OPTS)).toBe(false)
    expect(isExternalHost('localhost:3000', OPTS)).toBe(false)
    expect(isExternalHost('127.0.0.1', OPTS)).toBe(false)
    expect(isExternalHost('freshcut.localhost', OPTS)).toBe(false)
  })

  it('is FALSE for null/undefined/bare-label hosts', () => {
    expect(isExternalHost(null, OPTS)).toBe(false)
    expect(isExternalHost(undefined, OPTS)).toBe(false)
    expect(isExternalHost('justalabel', OPTS)).toBe(false)
  })

  it('strips the port before classifying an external host', () => {
    expect(isExternalHost('minsalong.se:443', OPTS)).toBe(true)
  })
})

describe('?tenant= / /t/ override is gated to preview hosts (tenant-confusion fix)', () => {
  const qs = (s: string) => new URLSearchParams(s)

  it('IGNORES ?tenant= on a real production tenant host (serves the host subdomain)', () => {
    expect(getTenantFromHost('freshcut.corevo.se', { ...OPTS, search: qs('tenant=evil') })).toEqual({
      kind: 'tenant',
      slug: 'freshcut',
    })
  })

  it('IGNORES ?tenant= on the production platform host', () => {
    expect(getTenantFromHost('booking.corevo.se', { ...OPTS, search: qs('tenant=evil') })).toEqual({
      kind: 'platform',
    })
  })

  it('HONORS ?tenant= on preview/dev hosts (workers.dev, localhost)', () => {
    expect(getTenantFromHost('app.abc.workers.dev', { ...OPTS, search: qs('tenant=demo') })).toEqual({
      kind: 'tenant',
      slug: 'demo',
    })
    expect(getTenantFromHost('localhost:3000', { ...OPTS, search: qs('tenant=demo') })).toEqual({
      kind: 'tenant',
      slug: 'demo',
    })
  })

  it('isPreviewHost: true only for localhost/127.0.0.1/*.localhost/*.workers.dev/empty', () => {
    expect(isPreviewHost('localhost:3000')).toBe(true)
    expect(isPreviewHost('x.localhost')).toBe(true)
    expect(isPreviewHost('app.abc.workers.dev')).toBe(true)
    expect(isPreviewHost('127.0.0.1')).toBe(true)
    expect(isPreviewHost(null)).toBe(true)
    expect(isPreviewHost('freshcut.corevo.se')).toBe(false)
    expect(isPreviewHost('corevo.se')).toBe(false)
  })
})
