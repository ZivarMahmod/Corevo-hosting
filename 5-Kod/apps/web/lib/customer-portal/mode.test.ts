import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_PORTAL_MODES,
  isCustomerPortalMode,
  readCustomerPortalMode,
  resolveCustomerPortalCapabilities,
  resolveLegacyPortalModeChange,
  type CustomerPortalMode,
} from './mode'

describe('customer portal mode', () => {
  it.each(CUSTOMER_PORTAL_MODES)('reads the known mode %s', (mode) => {
    expect(isCustomerPortalMode(mode)).toBe(true)
    expect(readCustomerPortalMode({ customer_portal: { mode } })).toBe(mode)
  })

  it.each([
    null,
    undefined,
    'legacy_account',
    [],
    {},
    { customer_portal: null },
    { customer_portal: [] },
    { customer_portal: {} },
    { customer_portal: { mode: 'unknown' } },
  ])('fails closed for malformed settings %#', (settings) => {
    expect(readCustomerPortalMode(settings)).toBeNull()
    expect(resolveCustomerPortalCapabilities(settings)).toEqual({
      mode: null,
      legacyAccount: false,
      passwordless: false,
    })
  })

  it('returns mutually exclusive capabilities', () => {
    expect(resolveCustomerPortalCapabilities({
      customer_portal: { mode: 'legacy_account' },
    })).toEqual({ mode: 'legacy_account', legacyAccount: true, passwordless: false })
    expect(resolveCustomerPortalCapabilities({
      customer_portal: { mode: 'passwordless_tenant' },
    })).toEqual({ mode: 'passwordless_tenant', legacyAccount: false, passwordless: true })
    expect(resolveCustomerPortalCapabilities({
      customer_portal: { mode: 'global_account' },
    })).toEqual({ mode: 'global_account', legacyAccount: false, passwordless: false })
  })

  it('infers the mode union from the canonical tuple', () => {
    const mode: CustomerPortalMode = CUSTOMER_PORTAL_MODES[1]
    expect(mode).toBe('legacy_account')
  })

  it('lets tenant admins change only off and legacy modes', () => {
    expect(resolveLegacyPortalModeChange('off', true)).toEqual({
      ok: true,
      nextMode: 'legacy_account',
    })
    expect(resolveLegacyPortalModeChange('legacy_account', false)).toEqual({
      ok: true,
      nextMode: 'off',
    })
    expect(resolveLegacyPortalModeChange('passwordless_tenant', false)).toEqual({
      ok: true,
      nextMode: null,
    })
    expect(resolveLegacyPortalModeChange('passwordless_tenant', true)).toEqual({ ok: false })
    expect(resolveLegacyPortalModeChange(null, true)).toEqual({ ok: false })
  })
})
