import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TENANT_REGION,
  formatTenantMoney,
  parseTenantMoneyInput,
  parseTenantLegal,
  parseTenantLegalInput,
  tenantMoneyInputValue,
} from './tenant-region'

describe('Swedish tenant regional contract', () => {
  it('keeps the launch defaults and money formatter in one contract', () => {
    expect(DEFAULT_TENANT_REGION).toEqual({
      countryCode: 'SE',
      locale: 'sv-SE',
      currency: 'SEK',
      defaultTimeZone: 'Europe/Stockholm',
    })
    expect(formatTenantMoney(123_400, DEFAULT_TENANT_REGION)).toMatch(/1[\s\u00a0\u202f]234.*kr/i)
    expect(parseTenantMoneyInput('1 234,50')).toBe(123_450)
    expect(parseTenantMoneyInput('-1')).toBeNull()
    expect(tenantMoneyInputValue(123_450)).toBe('1234.5')
    expect(tenantMoneyInputValue(null)).toBe('')
  })
})

describe('tenant legal settings', () => {
  it('parses the stored JSON contract consistently', () => {
    expect(parseTenantLegal({ legal: { org_nr: ' 559000-0000 ', vat_rate: '25' } })).toEqual({
      orgNr: '559000-0000',
      vatRate: 25,
    })
    expect(parseTenantLegal({ legal: { org_nr: '', vat_rate: '' } })).toEqual({
      orgNr: null,
      vatRate: null,
    })
    expect(parseTenantLegal({ legal: { vat_rate: 101 } }).vatRate).toBeNull()
  })

  it('normalizes both legal forms through one boundary', () => {
    expect(parseTenantLegalInput(' 559000-0000 ', '25,5')).toEqual({
      orgNr: '559000-0000',
      vatRate: 25.5,
    })
    expect(parseTenantLegalInput('', '')).toEqual({ orgNr: null, vatRate: null })
    expect(parseTenantLegalInput('', '101')).toBeNull()
  })
})
