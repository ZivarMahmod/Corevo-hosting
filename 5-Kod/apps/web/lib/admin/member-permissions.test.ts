import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MEMBER_PERMISSIONS,
  memberGrantsArea,
  type MemberPermissions,
} from './member-permissions'

const manager: MemberPermissions = {
  ...DEFAULT_MEMBER_PERMISSIONS,
  operationalRole: 'manager',
}

describe('memberGrantsArea', () => {
  it('ger platschef vardagsdrift men inte ägarens känsliga ytor', () => {
    expect(memberGrantsArea('kunder', manager)).toBe(true)
    expect(memberGrantsArea('tjanster', manager)).toBe(true)
    expect(memberGrantsArea('scheman', manager)).toBe(true)
    expect(memberGrantsArea('installningar', manager)).toBe(false)
    expect(memberGrantsArea('betalning' as never, manager)).toBe(false)
  })

  it('ger frisör bara uttryckliga individuella tillägg', () => {
    const custom: MemberPermissions = {
      ...DEFAULT_MEMBER_PERMISSIONS,
      canManageCustomers: true,
      canEditSite: true,
      canViewDailyMetrics: true,
    }
    expect(memberGrantsArea('kunder', custom)).toBe(true)
    expect(memberGrantsArea('sida', custom)).toBe(true)
    expect(memberGrantsArea('statistik', custom)).toBe(true)
    expect(memberGrantsArea('tjanster', custom)).toBe(false)
  })

  it('är fail-closed utan rad', () => {
    for (const area of ['kunder', 'tjanster', 'scheman', 'sida', 'statistik'] as const) {
      expect(memberGrantsArea(area, DEFAULT_MEMBER_PERMISSIONS)).toBe(false)
    }
  })
})
