// Mallarnas designpaket får dela galleribilder. Hero-bilden är däremot mallväljarens
// identitet och ska vara unik mellan mallarna.
import { describe, expect, it } from 'vitest'
import { THEME_CONTENT } from '@/lib/storefront/theme-content'
import type { StorefrontTheme } from '@/lib/tenant-data'

const fotoId = (url: string): string => /photo-([0-9a-f-]{20,})/.exec(url)?.[1] ?? url
const teman = Object.keys(THEME_CONTENT) as StorefrontTheme[]

describe('mallarnas foton', () => {
  it('ingen mall delar hero-bild med en annan (mallväljarens ansikte är unikt)', () => {
    const ägare = new Map<string, string[]>()
    for (const t of teman) {
      const hero = THEME_CONTENT[t].heroImages[0]
      if (!hero) continue
      const id = fotoId(hero)
      ägare.set(id, [...(ägare.get(id) ?? []), t])
    }
    const delade = [...ägare].filter(([, ts]) => ts.length > 1).map(([b, ts]) => `${b}: ${ts.join(' + ')}`)
    expect(delade).toEqual([])
  })

  it('varje mall har faktiskt en hero — ingen tom bildruta i galleriet', () => {
    for (const t of teman) {
      expect(THEME_CONTENT[t].heroImages[0], `${t} saknar hero-bild`).toBeTruthy()
    }
  })
})
