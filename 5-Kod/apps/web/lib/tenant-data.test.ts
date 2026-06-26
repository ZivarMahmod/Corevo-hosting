import { describe, it, expect } from 'vitest'
import { tenantSiteEditorEnabled } from './tenant-data'

// Task 3 — per-tenant site-editor gate. The load-bearing property is DEFAULT OFF:
// anything that isn't an explicit `true` must read as disabled (a missing flag, a
// truthy-but-not-true value, garbage jsonb) so no salon gets the editor by accident.
describe('tenantSiteEditorEnabled (default OFF)', () => {
  it('true ONLY for an explicit boolean true', () => {
    expect(tenantSiteEditorEnabled({ sajtbyggare_enabled: true })).toBe(true)
  })

  it('false for absent / non-true / garbage', () => {
    expect(tenantSiteEditorEnabled({})).toBe(false) // absent → off (the default)
    expect(tenantSiteEditorEnabled({ sajtbyggare_enabled: false })).toBe(false)
    expect(tenantSiteEditorEnabled({ sajtbyggare_enabled: 'true' })).toBe(false) // string, not true
    expect(tenantSiteEditorEnabled({ sajtbyggare_enabled: 1 })).toBe(false)
    expect(tenantSiteEditorEnabled(null)).toBe(false)
    expect(tenantSiteEditorEnabled(undefined)).toBe(false)
    expect(tenantSiteEditorEnabled('nope')).toBe(false)
  })
})
