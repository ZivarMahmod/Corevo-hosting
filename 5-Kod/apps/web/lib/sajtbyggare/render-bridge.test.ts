// goal-50 / de-risk R2 — renderTemplate must NEVER throw at render time.
// A broken/missing template (null html, or input html-react-parser chokes on) must
// degrade to a safe fallback node, never bubble an SSR 500 on Workers. The happy
// path (marker swap) must keep working unchanged.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from './render-bridge'

const render = (node: ReturnType<typeof renderTemplate>) =>
  renderToStaticMarkup(createElement(Fragment, null, node))

describe('renderTemplate — happy path (regression: try/catch must not break it)', () => {
  it('swaps a booking marker for the provided module node', () => {
    const html = '<section><h1>Hej</h1><corevo-module type="booking"></corevo-module></section>'
    const out = render(renderTemplate(html, { booking: createElement('div', { 'data-testid': 'b' }) }))
    expect(out).toContain('<h1>Hej</h1>')
    expect(out).toContain('data-testid="b"')
    expect(out).not.toContain('<corevo-module')
    expect(out).not.toContain('data-corevo-module-missing')
  })

  it('an unknown marker degrades to the inert greppable placeholder (no crash)', () => {
    const out = render(renderTemplate('<corevo-module type="ufo"></corevo-module>', {}))
    expect(out).toContain('data-corevo-module-missing="ufo"')
  })
})

describe('renderTemplate — R2 safe fallback (never a 500)', () => {
  it('null html → fallback node, does not throw', () => {
    let out = ''
    expect(() => {
      out = render(renderTemplate(null as unknown as string, {}))
    }).not.toThrow()
    expect(out).toContain('data-corevo-render-error')
  })

  it('non-string html → fallback node, does not throw', () => {
    expect(() => render(renderTemplate({} as unknown as string, {}))).not.toThrow()
  })
})
