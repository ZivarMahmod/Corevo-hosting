import { describe, it, expect } from 'vitest'
import type { ResolvedSkin } from './types'
import { shouldRenderDbSkin } from './should-render-db'

// goal-47 byte-identity gate. The ONLY combination that may flip a tenant to
// DB-render is: flag on + theme salvia + a skin with authored tenant content AND
// ≥1 section. Every other combination must fall back to the hardcoded layout —
// a leak here = changed render for a live tenant.

function skin(over: Partial<ResolvedSkin> = {}): ResolvedSkin {
  return {
    templateKey: 'salvia',
    tokens: {},
    cssVars: {},
    slots: {},
    sections: [{ sectionKey: 'hero', slots: [{ kind: 'empty', slotKey: 's' }] }],
    hasTenantContent: true,
    ...over,
  }
}

describe('shouldRenderDbSkin — byte-identity gate', () => {
  it('TRUE only for flag+salvia+authored content+sections', () => {
    expect(shouldRenderDbSkin(true, 'salvia', skin())).toBe(true)
  })

  it('FALSE when the flag is off', () => {
    expect(shouldRenderDbSkin(false, 'salvia', skin())).toBe(false)
  })

  it.each(['leander', 'zigge', 'linnea', 'edit'])('FALSE for non-salvia theme %s', (theme) => {
    expect(shouldRenderDbSkin(true, theme, skin({ templateKey: theme }))).toBe(false)
  })

  it('FALSE when skin is null (template row missing/inactive)', () => {
    expect(shouldRenderDbSkin(true, 'salvia', null)).toBe(false)
  })

  it('FALSE when the tenant authored no content (the prod-today case)', () => {
    // sections are non-empty (template defaults) but hasTenantContent=false →
    // must NOT flip. This is the exact case the brief's predicate got wrong.
    expect(shouldRenderDbSkin(true, 'salvia', skin({ hasTenantContent: false }))).toBe(false)
  })

  it('FALSE when there are no sections even if content is flagged', () => {
    expect(shouldRenderDbSkin(true, 'salvia', skin({ sections: [] }))).toBe(false)
  })
})
