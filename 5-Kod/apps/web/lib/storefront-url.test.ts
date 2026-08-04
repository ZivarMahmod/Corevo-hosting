import { describe, expect, it } from 'vitest'
import {
  legacyTenantStorefrontHost,
  normalizeTenantStorefrontOrigin,
  tenantStorefrontAppUrl,
  tenantStorefrontHost,
  tenantStorefrontUrl,
} from './storefront-url'

describe('canonical tenant storefront origin', () => {
  it('builds the first-level tenant host as the standard production origin', () => {
    expect(tenantStorefrontUrl(' FreshCut ')).toBe('https://freshcut.boka.corevo.se')
    expect(tenantStorefrontHost(' FreshCut ')).toBe('freshcut.boka.corevo.se')
  })

  it('lets a verified custom domain win', () => {
    expect(tenantStorefrontUrl('freshcut', 'boka.freshcut.se')).toBe(
      'https://boka.freshcut.se',
    )
    expect(tenantStorefrontHost('freshcut', 'boka.freshcut.se')).toBe(
      'boka.freshcut.se',
    )
  })

  it('uses the existing tenant query seam for localhost without changing canonical display', () => {
    expect(tenantStorefrontAppUrl(' FreshCut ', null, 'localhost:3000')).toBe(
      'http://localhost:3000/?tenant=freshcut',
    )
    expect(tenantStorefrontAppUrl('freshcut', null, '127.0.0.1:3000')).toBe(
      'http://127.0.0.1:3000/?tenant=freshcut',
    )
    expect(tenantStorefrontHost('freshcut')).toBe('freshcut.boka.corevo.se')
  })

  it('keeps production app links on the canonical host', () => {
    expect(tenantStorefrontAppUrl('freshcut', null, 'corevo.se')).toBe(
      'https://freshcut.boka.corevo.se',
    )
  })

  it('keeps the old root-zone host explicit instead of treating it as canonical', () => {
    expect(legacyTenantStorefrontHost(' FreshCut ')).toBe('freshcut.corevo.se')
    expect(normalizeTenantStorefrontOrigin('freshcut', 'https://freshcut.corevo.se')).toBe(
      'https://freshcut.boka.corevo.se',
    )
    expect(normalizeTenantStorefrontOrigin('freshcut', 'https://boka.freshcut.se')).toBe(
      'https://boka.freshcut.se',
    )
  })

  it('fails closed for an empty slug when there is no custom domain', () => {
    expect(tenantStorefrontUrl('  ')).toBeNull()
    expect(tenantStorefrontAppUrl('', null, 'localhost:3000')).toBeNull()
  })
})
