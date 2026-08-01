import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./StudioPanels.tsx', import.meta.url), 'utf8')
const tenantActions = readFileSync(
  new URL('../../../lib/platform/actions/tenants.ts', import.meta.url),
  'utf8',
)

describe('Onboarding Studio slug input', () => {
  it('preserves DNS-valid hyphens when the operator edits the slug', () => {
    expect(source).toContain("replace(/[^a-z0-9-]/g, '')")
  })

  it('checks the same validated slug for uniqueness', () => {
    expect(tenantActions).toContain('const checked = validateSlug(slug)')
    expect(tenantActions).toContain("if (!checked.ok) return false")
    expect(tenantActions).toContain(".eq('slug', checked.slug)")
  })
})
