// goal-51 — look-registry BASELINE: the box is empty. The 13 vendor looks were
// scrapped (goal-51); goal-52 re-adds the original 5 as native looks. This proves the
// box is cleanly empty and the dispatch gate (getLook) rejects every key — so the
// gallery, preview and storefront all degrade to a safe empty state, never a crash.

import { describe, expect, it } from 'vitest'
import { LOOKS, getLook, lookMetaList } from './look-registry'

describe('look-registry — baseline (empty box)', () => {
  it('registers ZERO looks', () => {
    expect(LOOKS).toHaveLength(0)
  })

  it('lookMetaList is empty (gallery renders an empty state)', () => {
    expect(lookMetaList()).toEqual([])
  })

  it('getLook resolves nothing — any look-style key and React themes alike → undefined', () => {
    expect(getLook('demolook')).toBeUndefined()
    expect(getLook('leander')).toBeUndefined()
    expect(getLook('nope')).toBeUndefined()
  })
})
