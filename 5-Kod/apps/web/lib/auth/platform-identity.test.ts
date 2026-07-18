import { describe, expect, it } from 'vitest'
import { isRejectedPartnerIdentity, resolvePlatformIdentity } from './platform-identity'

const activeGlobalRole = {
  accountAuthorized: true,
  roleTenantId: null,
  appPlatformAdmin: false,
  membership: null,
}

describe('resolvePlatformIdentity', () => {
  it('requires the exact active super_admin role and verified app claim for global scope', () => {
    expect(
      resolvePlatformIdentity({
        ...activeGlobalRole,
        roleLevel: 8,
        roleName: 'super_admin',
        appPlatformAdmin: true,
      }),
    ).toEqual({ platformAdmin: true, partnerAdmin: false, partnerId: null })

    expect(
      resolvePlatformIdentity({
        ...activeGlobalRole,
        roleLevel: 8,
        roleName: 'super_admin',
        appPlatformAdmin: false,
      }).platformAdmin,
    ).toBe(false)
  })

  it('never upgrades a generic level-7 role from a stale platform_admin claim', () => {
    expect(
      resolvePlatformIdentity({
        ...activeGlobalRole,
        roleLevel: 7,
        roleName: 'partner_admin',
        appPlatformAdmin: true,
      }),
    ).toEqual({ platformAdmin: false, partnerAdmin: false, partnerId: null })
  })

  it('requires an active partner membership and active partner for partner scope', () => {
    const base = {
      ...activeGlobalRole,
      roleLevel: 7,
      roleName: 'partner_admin',
    }
    expect(
      resolvePlatformIdentity({
        ...base,
        membership: { partnerId: 'partner-a', memberStatus: 'active', partnerStatus: 'active' },
      }),
    ).toEqual({ platformAdmin: false, partnerAdmin: true, partnerId: 'partner-a' })

    expect(
      resolvePlatformIdentity({
        ...base,
        membership: { partnerId: 'partner-a', memberStatus: 'inactive', partnerStatus: 'active' },
      }).partnerAdmin,
    ).toBe(false)
    expect(
      resolvePlatformIdentity({
        ...base,
        membership: { partnerId: 'partner-a', memberStatus: 'active', partnerStatus: 'paused' },
      }).partnerAdmin,
    ).toBe(false)
  })

  it('denies both scopes for an inactive account or tenant-bound role', () => {
    expect(
      resolvePlatformIdentity({
        ...activeGlobalRole,
        accountAuthorized: false,
        roleLevel: 8,
        roleName: 'super_admin',
        appPlatformAdmin: true,
      }),
    ).toEqual({ platformAdmin: false, partnerAdmin: false, partnerId: null })

    expect(
      resolvePlatformIdentity({
        ...activeGlobalRole,
        roleTenantId: 'tenant-a',
        roleLevel: 7,
        roleName: 'partner_admin',
        membership: { partnerId: 'partner-a', memberStatus: 'active', partnerStatus: 'active' },
      }),
    ).toEqual({ platformAdmin: false, partnerAdmin: false, partnerId: null })
  })
})

describe('isRejectedPartnerIdentity', () => {
  it('rejects an exact global partner role whose live partner access is inactive', () => {
    expect(isRejectedPartnerIdentity({
      accountAuthorized: true,
      roleLevel: 7,
      roleName: 'partner_admin',
      roleTenantId: null,
      partnerAdmin: false,
    })).toBe(true)
  })

  it('does not reject a verified partner or tenant admin', () => {
    expect(isRejectedPartnerIdentity({
      accountAuthorized: true,
      roleLevel: 7,
      roleName: 'partner_admin',
      roleTenantId: null,
      partnerAdmin: true,
    })).toBe(false)
    expect(isRejectedPartnerIdentity({
      accountAuthorized: true,
      roleLevel: 6,
      roleName: 'salon_admin',
      roleTenantId: 'tenant-a',
      partnerAdmin: false,
    })).toBe(false)
  })
})
