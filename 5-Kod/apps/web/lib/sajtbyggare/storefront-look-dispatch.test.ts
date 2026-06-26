// goal-50 M8 — the public storefront's render-bron dispatch contract. This locks the
// EXACT decision app/(public)/page.tsx + layout.tsx make: settings.look resolves in the
// registry → render the look's real HTML with the live booking module woven in; a theme
// key (or a stray look key) → undefined → the normal themed layout path. Not a smoke
// test — it asserts the look's UNIQUE content renders and the booking marker is replaced
// by the mounted module (no orphaned <corevo-module>).

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getLook, LOOKS } from './look-registry'
import { renderTemplate } from './render-bridge'

// The page resolves the look the same way: settings.look → getLook(...) | undefined.
const resolveLook = (settingsLook: string | null) => (settingsLook ? getLook(settingsLook) : undefined)

describe('storefront render-bron dispatch (settings.look → real look HTML)', () => {
  it('a registered look key resolves → the look renders with the booking module woven in', () => {
    for (const entry of LOOKS) {
      const look = resolveLook(entry.key)
      expect(look, entry.key).toBeDefined()
      const out = renderToStaticMarkup(
        createElement(
          Fragment,
          null,
          renderTemplate(look!.html, { booking: createElement('div', { 'data-testid': 'booking-mounted' }) }),
        ),
      )
      expect(out, `${entry.key} booking not woven`).toContain('data-testid="booking-mounted"')
      expect(out, `${entry.key} left an orphan marker`).not.toContain('<corevo-module')
      expect(out.length, `${entry.key} rendered thin`).toBeGreaterThan(1000)
    }
  })

  it('a React theme key (not a look) resolves to undefined → the themed layout path', () => {
    expect(resolveLook('salvia')).toBeUndefined()
    expect(resolveLook('leander')).toBeUndefined()
  })

  it('a null / stray look key resolves to undefined (safe fallback to the theme)', () => {
    expect(resolveLook(null)).toBeUndefined()
    expect(resolveLook('not-a-real-look')).toBeUndefined()
  })
})
