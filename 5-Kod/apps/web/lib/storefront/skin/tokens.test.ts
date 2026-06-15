import { describe, it, expect } from 'vitest'
import { parseTokens, tokensToCssVars, cssVarsToStyle } from './tokens'
import type { TemplateTokens } from './types'

// Template-skin token layer. The load-bearing guarantees: a `{}`/garbage
// templates.tokens parses to `{}` (prod reality), only STRING leaves survive, and
// the flatten emits the documented template-scoped `--sf-<group>-<key>` namespace
// (NOT the bare `--color-*`/`--font-*` that @corevo/ui's tenant-branding layer owns).

describe('parseTokens — defensive coercion of templates.tokens', () => {
  it('empty object → {} (the prod reality: tokens = {})', () => {
    expect(parseTokens({})).toEqual({})
  })

  it('null / undefined → {}', () => {
    expect(parseTokens(null)).toEqual({})
    expect(parseTokens(undefined)).toEqual({})
  })

  it('garbage (string / number / array) → {}', () => {
    expect(parseTokens('nope')).toEqual({})
    expect(parseTokens(42)).toEqual({})
    expect(parseTokens(['color'])).toEqual({})
  })

  it('nested color + font groups are kept verbatim', () => {
    const out = parseTokens({ color: { bg: '#111' }, font: { heading: 'Inter' } })
    expect(out).toEqual({ color: { bg: '#111' }, font: { heading: 'Inter' } })
  })

  it('the third group (layout) is read too', () => {
    expect(parseTokens({ layout: { radius: '8px' } })).toEqual({ layout: { radius: '8px' } })
  })

  it('non-string leaves are ignored (number/object/null/array dropped)', () => {
    const out = parseTokens({
      color: { bg: '#111', size: 12, nested: { x: 1 }, nil: null, arr: ['a'] },
    })
    expect(out).toEqual({ color: { bg: '#111' } })
  })

  it('a group with no usable string leaves is omitted entirely', () => {
    expect(parseTokens({ color: { size: 12 }, font: {} })).toEqual({})
  })

  it('unknown groups are dropped, known groups survive alongside them', () => {
    const out = parseTokens({ color: { bg: '#000' }, spacing: { lg: '2rem' } })
    expect(out).toEqual({ color: { bg: '#000' } })
  })

  it('a non-object group value is skipped', () => {
    expect(parseTokens({ color: 'red', font: { body: 'Georgia' } })).toEqual({
      font: { body: 'Georgia' },
    })
  })
})

describe('tokensToCssVars — flatten to --sf-* custom properties', () => {
  it('empty tokens → {}', () => {
    expect(tokensToCssVars({})).toEqual({})
  })

  it('color.bg + font.heading → correct --sf-… vars', () => {
    const tokens: TemplateTokens = { color: { bg: '#111' }, font: { heading: 'Inter' } }
    expect(tokensToCssVars(tokens)).toEqual({
      '--sf-color-bg': '#111',
      '--sf-font-heading': 'Inter',
    })
  })

  it('layout.radius → --sf-layout-radius', () => {
    expect(tokensToCssVars({ layout: { radius: '8px' } })).toEqual({
      '--sf-layout-radius': '8px',
    })
  })

  it('all three groups flatten together', () => {
    const tokens: TemplateTokens = {
      color: { bg: '#111', fg: '#eee' },
      font: { heading: 'Inter', body: 'Georgia' },
      layout: { radius: '8px' },
    }
    expect(tokensToCssVars(tokens)).toEqual({
      '--sf-color-bg': '#111',
      '--sf-color-fg': '#eee',
      '--sf-font-heading': 'Inter',
      '--sf-font-body': 'Georgia',
      '--sf-layout-radius': '8px',
    })
  })

  it('uses the --sf-* namespace, NOT the bare --color-*/--font-* (no clobber of tenant branding)', () => {
    const vars = tokensToCssVars({ color: { bg: '#111' }, font: { body: 'Inter' } })
    const keys = Object.keys(vars)
    expect(keys.every((k) => k.startsWith('--sf-'))).toBe(true)
    expect(vars['--color-bg']).toBeUndefined()
    expect(vars['--font-body']).toBeUndefined()
  })
})

describe('parseTokens → tokensToCssVars end to end', () => {
  it('garbage in still produces a usable empty var map (never throws)', () => {
    expect(tokensToCssVars(parseTokens('garbage'))).toEqual({})
  })
})

describe('cssVarsToStyle — React style passthrough', () => {
  it('empty → {}', () => {
    expect(cssVarsToStyle({})).toEqual({})
  })

  it('returns the CSS-var entries usable as a style object', () => {
    const vars = { '--sf-color-bg': '#111' }
    expect(cssVarsToStyle(vars)).toEqual({ '--sf-color-bg': '#111' })
  })

  it('returns a copy, not the same reference (mutating the result is safe)', () => {
    const vars = { '--sf-color-bg': '#111' }
    const style = cssVarsToStyle(vars)
    expect(style).not.toBe(vars)
    style['--sf-color-bg'] = '#222'
    expect(vars['--sf-color-bg']).toBe('#111')
  })
})
