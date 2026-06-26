// Drift-tripwire: SALVIA_REGION_MANIFEST (kod) ↔ migration 0040 (DB template_slots).
//
// 0040_salvia_slots_canonical.sql hand-skriver salvias template_slots ur manifestet.
// Det är exakt den klass av kod↔DB-drift som brände en hel session (249 out-of-band
// slots). Detta test pinnar de två: ändrar någon manifestets editerbara regioner
// (lägger till/tar bort en text/image/logo-region) divergerar den G1-filtrerade
// nyckelmängden från de 10 raderna 0040 insertar → testet failar i CI → tvingar fram
// en ny migration. Color/font räknas bort (G1: de bor i templates.tokens + branding,
// inte som slots).

import { describe, it, expect } from 'vitest'
import { SALVIA_REGION_MANIFEST } from './salvia'

// De EXAKTA slot_key:erna migration 0040 deklarerar för salvia. Ändras denna lista
// MÅSTE 0040 (eller en efterföljande migration) ändras i takt — och tvärtom.
const MIGRATION_0040_SLOT_KEYS = [
  'hero.eyebrow',
  'hero.title',
  'hero.lede',
  'hero.image',
  'about.copy',
  'about.italic',
  'about.image',
  'closing.image',
  'footer.tagline',
  'logo',
].sort()

describe('salvia template_slots ↔ SALVIA_REGION_MANIFEST (migration 0040 drift-guard)', () => {
  it('G1-filtrerade manifest-regioner = de slot_keys 0040 insertar', () => {
    // G1: color/font är INTE slots (tokens/branding). Resten (text/image/logo) blir slots.
    const manifestSlotKeys = SALVIA_REGION_MANIFEST.regions
      .filter((r) => r.type !== 'color' && r.type !== 'font')
      .map((r) => r.key)
      .sort()

    expect(manifestSlotKeys).toEqual(MIGRATION_0040_SLOT_KEYS)
  })

  it('inga dubblettnycklar i manifestet (unik per slot, som DB-constraintet kräver)', () => {
    const keys = SALVIA_REGION_MANIFEST.regions.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
