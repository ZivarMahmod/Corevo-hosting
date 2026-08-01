import { describe, expect, it } from 'vitest'
import { materializeThemeCopy, resolveThemeContent } from './theme-content'
import { THEME_OWNS_COPY } from '@/lib/platform/theme-capabilities'
import { COREVO_12_THEME_KEYS } from '@/lib/platform/theme-palettes'

describe('resolveThemeContent theme-owned extra defaults', () => {
  it('keeps exact Kalla and Snitt defaults when the tenant has no override', () => {
    const kalla = resolveThemeContent('kalla', null, null)
    expect(kalla.contactTitle).toBe('Kontakt')
    expect(kalla.shopTitle).toBe('Apoteket')
    expect(kalla.blogTitle).toBe('Anteckningar')
  })

  it('still lets a non-empty tenant value override the theme default', () => {
    expect(resolveThemeContent('kalla', null, { contactTitle: 'Hitta oss' }).contactTitle)
      .toBe('Hitta oss')
  })

  it('materializes the text currently shown before a template switch', () => {
    const visible = materializeThemeCopy('leander', { heroTitle: 'Kundens rubrik' })

    expect(visible.heroTitle).toBe('Kundens rubrik')
    expect(visible.aboutTitle).toBe(resolveThemeContent('leander', null).aboutTitle)
    expect(resolveThemeContent('kalla', null, visible).aboutTitle)
      .toBe(resolveThemeContent('leander', null).aboutTitle)
  })

  it('keeps derived copy fields linked and selectable-template preview parity explicit', () => {
    const visible = materializeThemeCopy('leander', {
      aboutCopy: 'Kundens berättelse',
      galleryEyebrow: 'Kundens galleri',
    })

    expect(visible.aboutCopyHome).toBeUndefined()
    expect(visible.homeGalleryEyebrow).toBeUndefined()
    expect(COREVO_12_THEME_KEYS.every((theme) => THEME_OWNS_COPY.has(theme))).toBe(true)
  })
})
