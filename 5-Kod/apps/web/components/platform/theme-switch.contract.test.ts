import { describe, expect, it } from 'vitest'
import { themeContentCompatibility } from '@/lib/platform/theme-capabilities'

describe('themeContentCompatibility', () => {
  it('reports current content that the selected theme hides without deleting it', () => {
    const hidden = themeContentCompatibility(
      'freshcut',
      'snitt',
      ['heroTitle', 'gallery_images', 'homeSecondTitle'],
    )
    expect(hidden).toContain('galleri på startsidan')
    expect(hidden).toContain('Rubrik, mittensektionen')
    expect(hidden).not.toContain('heroTitle')
  })
})
