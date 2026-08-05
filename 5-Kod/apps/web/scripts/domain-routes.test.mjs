import { describe, expect, it } from 'vitest'
import {
  REQUIRED_FIXED_ROUTES,
  assertSafeSlug,
  patternForSlug,
  readAllRoutePatternsFromText,
} from './domain-routes.mjs'

describe('tenant Worker-domain contract', () => {
  it('builds one exact Corevo hostname per tenant', () => {
    expect(patternForSlug(' Velo ')).toBe('velo.corevo.se')
  })

  it('refuses POS and platform labels', () => {
    expect(() => assertSafeSlug('booking')).toThrow(/reserved\/POS/)
    expect(() => assertSafeSlug('bad.domain')).toThrow(/valid DNS label/)
  })

  it('keeps only fixed platform doors in the committed base config', () => {
    expect(REQUIRED_FIXED_ROUTES).toEqual([
      'booking.corevo.se',
      'superbooking.corevo.se',
      'minbooking.corevo.se',
      'mina.corevo.se',
    ])
  })

  it('reads fixed routes from JSONC without treating comments as configuration', () => {
    const routes = readAllRoutePatternsFromText('{ // base\n "routes": [{"pattern":"booking.corevo.se"}] }')
    expect(routes).toEqual(['booking.corevo.se'])
  })
})
