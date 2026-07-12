// goal-62 D2/D3 — FOTO-VAKTEN. Failar bygget om två mallar delar en bild, eller om ett
// mall-galleri-kort lånar en annan malls hero (galleriet renderar heroImages[0]).
//
// Bakgrund: D1 mätte att sviten drog ur en pool på 26 bilder — ett foto låg i ÅTTA mallar,
// och de fem äldre mallarna delade ETT bildmanifest. "En egen mall är en egen typ av
// branding" (Zivar) → då kan den inte ha grannens bilder. Testet håller det sant.
import { describe, expect, it } from 'vitest'
import { THEME_CONTENT } from './theme-content'
import type { StorefrontTheme } from '@/lib/tenant-data'

const fotoId = (url: string): string => /photo-([0-9a-f-]{20,})/.exec(url)?.[1] ?? url
const teman = Object.keys(THEME_CONTENT) as StorefrontTheme[]

describe('mallarnas foton', () => {
  it('ingen mall delar ett foto med en annan', () => {
    const ägare = new Map<string, string[]>()
    for (const t of teman) {
      const c = THEME_CONTENT[t]
      const bilder = [...c.heroImages, ...c.galleryImages, c.aboutImage, c.closingImage].filter(Boolean)
      for (const b of new Set(bilder.map(fotoId))) ägare.set(b, [...(ägare.get(b) ?? []), t])
    }
    const delade = [...ägare].filter(([, ts]) => ts.length > 1).map(([b, ts]) => `${b}: ${ts.join(' + ')}`)
    expect(delade).toEqual([])
  })

  it('inget mall-galleri-kort lånar en annan malls hero', () => {
    const heroer = teman.map((t) => fotoId(THEME_CONTENT[t].heroImages[0]!))
    expect(new Set(heroer).size).toBe(teman.length)
  })
})
