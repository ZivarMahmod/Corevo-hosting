import { describe, it, expect } from 'vitest'
import { PORTAL_MIN_LEVEL, portalHomeFor, backofficeHostKindForRole } from './roles'

// Real seeded DB role levels are {2,3,6,8}. The portal thresholds must stay pinned
// to those so that seeding a phantom level (4/5/7) can never silently shift the
// surface matrix (VÅG 1 hardening). This locks both the thresholds and the
// post-login landing for every real role.
describe('role thresholds (pinned to real DB levels {2,3,6,8})', () => {
  it('portal minimums match the seeded roles', () => {
    expect(PORTAL_MIN_LEVEL).toEqual({ kund: 2, personal: 3, admin: 6, platform: 8 })
  })

  it('portalHomeFor routes every real role to its own portal', () => {
    expect(portalHomeFor({ roleLevel: 2, platformAdmin: false })).toBe('/konto')
    expect(portalHomeFor({ roleLevel: 3, platformAdmin: false })).toBe('/personal')
    expect(portalHomeFor({ roleLevel: 6, platformAdmin: false })).toBe('/admin')
    // super_admin: the platform_admin flag drives the landing regardless of level.
    expect(portalHomeFor({ roleLevel: 8, platformAdmin: true })).toBe('/')
  })

  it('platform landing is flag-driven, not a phantom level-7 shortcut', () => {
    // A non-flag account never lands on the platform dashboard unless it meets the
    // real level-8 floor — the old admin:5/platform:7 phantoms are gone.
    expect(portalHomeFor({ roleLevel: 7, platformAdmin: false })).toBe('/admin')
    expect(portalHomeFor({ roleLevel: 6, platformAdmin: false })).not.toBe('/')
    expect(portalHomeFor({ roleLevel: 0, platformAdmin: true })).toBe('/')
  })
})

describe('goal-27 backofficeHostKindForRole — door isolation (one door per role)', () => {
  it('maps each role to its single allowed back-office door', () => {
    expect(backofficeHostKindForRole({ roleLevel: 8, platformAdmin: true })).toBe('superadmin')
    expect(backofficeHostKindForRole({ roleLevel: 6, platformAdmin: false })).toBe('platform')
    expect(backofficeHostKindForRole({ roleLevel: 3, platformAdmin: false })).toBe('staff_portal')
    expect(backofficeHostKindForRole({ roleLevel: 2, platformAdmin: false })).toBe('tenant')
    expect(backofficeHostKindForRole({ roleLevel: 0, platformAdmin: false })).toBe('tenant')
  })

  it('the platform_admin FLAG forces the superadmin door regardless of level', () => {
    // A super-admin (godmode) credential is only ever valid on superbooking, never
    // on booking/minbooking — even if its numeric level were low.
    expect(backofficeHostKindForRole({ roleLevel: 0, platformAdmin: true })).toBe('superadmin')
    expect(backofficeHostKindForRole({ roleLevel: 6, platformAdmin: true })).toBe('superadmin')
  })

  it('no role maps to two doors (super≠salon≠staff)', () => {
    const doors = [
      backofficeHostKindForRole({ roleLevel: 8, platformAdmin: true }),
      backofficeHostKindForRole({ roleLevel: 6, platformAdmin: false }),
      backofficeHostKindForRole({ roleLevel: 3, platformAdmin: false }),
    ]
    expect(new Set(doors).size).toBe(3)
  })
})
