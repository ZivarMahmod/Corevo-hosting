import { describe, it, expect } from 'vitest'
import { mergeBranding } from './merge'
import type { TenantBranding } from '@corevo/ui'

// B1 regression: tenant_settings.branding is ONE jsonb co-owned by M6 (colours +
// storefront media) and M7 (platform colours/logo). The bug was M7 building a
// fresh object and clobbering the whole column, wiping the owner's
// hero/gallery/about/closing/team/stats + color_accent. mergeBranding is the only
// way to compute a new branding object, so these tests pin the contract that
// closed the bug class.

// A fully-populated owner branding: colours + accent + every storefront-media slot.
const ownerBranding: TenantBranding = {
  color_primary: '#15281f',
  color_bg: '#ffffff',
  color_fg: '#15281f',
  color_accent: '#f5a623',
  font_body: 'Inter',
  logo_url: 'https://pub-test.r2.dev/tenants/t1/branding/old-logo.png',
  hero_images: [
    'https://pub-test.r2.dev/tenants/t1/storefront/hero1.png',
    'https://pub-test.r2.dev/tenants/t1/storefront/hero2.png',
  ],
  gallery_images: ['https://pub-test.r2.dev/tenants/t1/storefront/g1.png'],
  about_image: 'https://pub-test.r2.dev/tenants/t1/storefront/about.png',
  closing_image: 'https://pub-test.r2.dev/tenants/t1/storefront/closing.png',
  team: [{ name: 'Anna', role: 'Frisör', img: 'https://pub-test.r2.dev/tenants/t1/storefront/anna.png' }],
  stats: [
    ['12', 'år'],
    ['4.9', 'betyg'],
  ],
}

describe('mergeBranding — B1 data-loss regression', () => {
  it('an M7 platform-branding save (colours + logo only) PRESERVES owner media + accent', () => {
    // Exactly the M7 patch shape: the five fields M7 owns. No media, no accent.
    const out = mergeBranding(ownerBranding, {
      color_primary: '#0b3d2e',
      color_bg: '#fafafa',
      color_fg: '#111111',
      font_body: 'Playfair Display',
      logo_url: 'https://pub-test.r2.dev/tenants/t1/branding/new-logo.png',
    })

    // The fields M7 set are updated…
    expect(out.color_primary).toBe('#0b3d2e')
    expect(out.color_bg).toBe('#fafafa')
    expect(out.color_fg).toBe('#111111')
    expect(out.font_body).toBe('Playfair Display')
    expect(out.logo_url).toBe('https://pub-test.r2.dev/tenants/t1/branding/new-logo.png')

    // …and every field M7 did NOT touch survives (this is the bug being closed).
    expect(out.color_accent).toBe('#f5a623')
    expect(out.hero_images).toEqual(ownerBranding.hero_images)
    expect(out.gallery_images).toEqual(ownerBranding.gallery_images)
    expect(out.about_image).toBe(ownerBranding.about_image)
    expect(out.closing_image).toBe(ownerBranding.closing_image)
    expect(out.team).toEqual(ownerBranding.team)
    expect(out.stats).toEqual(ownerBranding.stats)
  })

  it('an M6 storefront-media save PRESERVES colours/font/logo/accent', () => {
    const newHero = ['https://pub-test.r2.dev/tenants/t1/storefront/hero-new.png']
    const out = mergeBranding(ownerBranding, {
      hero_images: newHero,
      gallery_images: [],
      about_image: null,
      closing_image: null,
      team: [],
      stats: [],
    })

    // Media is replaced by the patch…
    expect(out.hero_images).toEqual(newHero)
    expect(out.gallery_images).toEqual([])
    expect(out.about_image).toBeNull()

    // …and colours/font/logo/accent (owned by M6 saveBranding) are untouched.
    expect(out.color_primary).toBe('#15281f')
    expect(out.color_accent).toBe('#f5a623')
    expect(out.font_body).toBe('Inter')
    expect(out.logo_url).toBe(ownerBranding.logo_url)
  })

  it('writes an explicit null (logo removed) but keeps prev for undefined keys', () => {
    const out = mergeBranding(ownerBranding, {
      logo_url: null, // explicit clear → written through
      color_primary: undefined, // not set → keep prev
    })
    expect(out.logo_url).toBeNull()
    expect(out.color_primary).toBe('#15281f') // prev preserved, not overwritten with undefined
    // undefined must NOT leak into the object as a key (would serialise to jsonb).
    expect(Object.prototype.hasOwnProperty.call(out, 'color_primary')).toBe(true)
    expect(out.color_primary).not.toBeUndefined()
  })

  it('does not mutate the prev object (returns a fresh object)', () => {
    const snapshot = structuredClone(ownerBranding)
    const out = mergeBranding(ownerBranding, { color_primary: '#000000' })
    expect(ownerBranding).toEqual(snapshot) // prev unchanged
    expect(out).not.toBe(ownerBranding)
  })

  it('treats null/undefined prev as an empty object', () => {
    expect(mergeBranding(null, { color_primary: '#abcdef' })).toEqual({ color_primary: '#abcdef' })
    expect(mergeBranding(undefined, {})).toEqual({})
  })
})
