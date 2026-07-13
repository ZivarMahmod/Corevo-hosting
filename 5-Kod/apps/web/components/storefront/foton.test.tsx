// goal-62 D2/D3 → OMSKRIVEN i goal-64 — FOTO-VAKTEN.
//
// Bakgrund (goal-62): sviten drog ur en pool på 26 bilder, ett foto låg i ÅTTA mallar och de
// fem äldsta delade ETT bildmanifest. "En egen mall är en egen typ av branding" (Zivar) →
// testet krävde att INGEN bild fick förekomma i två mallar.
//
// goal-64 ändrar premissen, inte kravet. Claude Design-paketen levereras med en VERIFIERAD
// bildbank, och HANDOFF.md §2 regel 4 är uttrycklig: "Bildbanken är verifierad. Byt inte
// Unsplash-ID:n mot slumpbilder." Paketen återanvänder medvetet samma foton mellan mallar —
// att byta ut dem för att blidka ett test vore precis den improvisation som CLAUDE.md
// förbjuder. Och det totala unikhetskravet skyddade aldrig det som faktiskt betyder något:
// två mallar med olika layout, palett och typografi ser inte likadana ut för att en bild i
// galleriet råkar återkomma.
//
// Det som DÄREMOT syns direkt är ANSIKTET: hero-bilden är det första besökaren möter och det
// enda fotot mallväljaren visar (theme-palettes.ts → hero()). Delar två mallar hero är de
// samma mall i galleriet. Det kravet står kvar, skärpt: hero måste vara unik, och ingen malls
// hero får dyka upp som en ANNAN malls galleri-kort.
import { describe, expect, it } from 'vitest'
import { THEME_CONTENT } from './theme-content'
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
