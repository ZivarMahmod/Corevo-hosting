// goal-50 — look-registry: the BOX. ONE canonical list of the render-bron looks
// (väg A). The onboarding gallery + preview + storefront dispatch all read THIS,
// never tags.bransch and never the 5 React themes. Additive: goal-36 appends looks.
//
// This proves the registry is COMPLETE + WELL-FORMED, not a stub:
//   - exactly the built render-bron looks are registered (identities, not count)
//   - every entry's manifest.templateKey === its key (no mis-wire)
//   - every entry weaves a real booking marker (väg A, not an empty token-row)
//   - getLook resolves known keys + rejects unknown (the dispatch gate)

import { describe, expect, it } from 'vitest'
import { LOOKS, getLook, type LookEntry } from './look-registry'
import { moduleMarkerTypes } from './_optimize/proof-kit'

const EXPECTED_KEYS = [
  'haircare', 'hairsal', 'haircut', 'alotan', 'barberx', 'barberz',
  'restoran', 'klinik', 'drivin', 'carserv',
  'dentcare', 'keto', 'feane',
] as const

describe('look-registry — the box of render-bron looks', () => {
  it('registers exactly the built render-bron looks (identities, not just count)', () => {
    expect([...LOOKS.map((l) => l.key)].sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  it('has no duplicate keys', () => {
    const keys = LOOKS.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every entry: manifest.templateKey === key (no mis-wire)', () => {
    for (const l of LOOKS) {
      expect(l.manifest.templateKey, `mismatch for ${l.key}`).toBe(l.key)
    }
  })

  it('every entry carries non-empty html + name + thumbnail + cssHrefs', () => {
    for (const l of LOOKS) {
      expect(typeof l.html, l.key).toBe('string')
      expect(l.html.length, l.key).toBeGreaterThan(100)
      expect(l.name.length, l.key).toBeGreaterThan(0)
      expect(l.thumbnail.length, l.key).toBeGreaterThan(0)
      expect(Array.isArray(l.cssHrefs), l.key).toBe(true)
      expect(l.cssHrefs.length, l.key).toBeGreaterThan(0)
    }
  })

  it('every entry weaves exactly one booking marker (väg A, not a token-row stub)', () => {
    for (const l of LOOKS) {
      expect(moduleMarkerTypes(l.html).filter((t) => t === 'booking'), l.key).toHaveLength(1)
    }
  })

  it('bookingPos matches the marker pos the template actually mounts', () => {
    const expected: Record<string, string> = {
      restoran: 'reservation',
      klinik: 'appointment',
      drivin: 'appointment',
      carserv: 'booking',
      haircare: 'booking',
      hairsal: 'booking',
      haircut: 'booking',
      alotan: 'booking',
      barberx: 'contact',
      barberz: 'booking',
      dentcare: 'appointment',
      keto: 'booking',
      feane: 'book',
    }
    for (const l of LOOKS) {
      expect(l.bookingPos, l.key).toBe(expected[l.key])
    }
  })

  it('getLook resolves a known key and rejects an unknown one', () => {
    const got: LookEntry | undefined = getLook('carserv')
    expect(got?.key).toBe('carserv')
    expect(getLook('leander')).toBeUndefined() // a React THEME is never in the box
    expect(getLook('nope')).toBeUndefined()
  })
})
