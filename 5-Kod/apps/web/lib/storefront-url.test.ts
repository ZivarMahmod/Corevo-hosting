import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeTenantStorefrontOrigin,
  tenantStorefrontAppUrl,
  tenantStorefrontHost,
  tenantStorefrontUrl,
} from './storefront-url'

afterEach(() => vi.unstubAllEnvs())

describe('canonical tenant storefront origin', () => {
  it('uses the exact first-level Corevo tenant host', () => {
    expect(tenantStorefrontUrl(' FreshCut ')).toBe('https://freshcut.corevo.se')
    expect(tenantStorefrontHost(' FreshCut ')).toBe('freshcut.corevo.se')
  })

  it('lets a verified customer domain win', () => {
    expect(tenantStorefrontHost('freshcut', 'freshcut.se')).toBe('freshcut.se')
  })

  it('uses localhost only for an app preview link', () => {
    expect(tenantStorefrontAppUrl('freshcut', null, 'localhost:3000')).toBe('http://localhost:3000/?tenant=freshcut')
    expect(tenantStorefrontHost('freshcut')).toBe('freshcut.corevo.se')
  })

  it('only canonicalizes its own exact Corevo host', () => {
    expect(normalizeTenantStorefrontOrigin('freshcut', 'https://freshcut.corevo.se')).toBe('https://freshcut.corevo.se')
    expect(normalizeTenantStorefrontOrigin('freshcut', 'https://freshcut.se')).toBe('https://freshcut.se')
  })
})
