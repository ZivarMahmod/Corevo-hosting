import { describe, expect, it } from 'vitest'
import { resolveThemeContent } from './theme-content'

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
})
