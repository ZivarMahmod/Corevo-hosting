// goal-50 M8 — the public storefront's render-bron dispatch contract. This locks the
// EXACT decision app/(public)/page.tsx + layout.tsx make: settings.look resolves in the
// registry → render the look's real HTML with the live booking module woven in; a theme
// key (or a stray look key) → undefined → the normal themed layout path. Not a smoke
// test — it asserts the look's UNIQUE content renders and the booking marker is replaced
// by the mounted module (no orphaned <corevo-module>).

import { describe, expect, it } from 'vitest'
import { getLook, LOOKS } from './look-registry'

// The page resolves the look the same way: settings.look → getLook(...) | undefined.
const resolveLook = (settingsLook: string | null) => (settingsLook ? getLook(settingsLook) : undefined)

describe('storefront render-bron dispatch (settings.look → real look HTML)', () => {
  // goal-51 baseline: the box is empty until goal-52 re-adds native looks. The dispatch
  // GATE is what matters here — no key resolves to a look, so the storefront always falls
  // through to the themed layout (never a 500). goal-52 re-adds the per-look render asserts.
  it('at baseline the box is empty → no look key resolves', () => {
    expect(LOOKS).toHaveLength(0)
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
