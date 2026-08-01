import { describe, expect, it } from 'vitest'

import { DEFAULT_TENANT_REGION, formatTenantMoney } from './tenant-region'

describe('Swedish tenant regional contract', () => {
  it('keeps the launch defaults and money formatter in one contract', () => {
    expect(DEFAULT_TENANT_REGION).toEqual({
      countryCode: 'SE',
      locale: 'sv-SE',
      currency: 'SEK',
      defaultTimeZone: 'Europe/Stockholm',
    })
    expect(formatTenantMoney(123_400, DEFAULT_TENANT_REGION)).toMatch(/1[\s\u00a0\u202f]234.*kr/i)
  })
})
