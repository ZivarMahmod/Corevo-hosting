import { describe, expect, it } from 'vitest'
import { effectiveLocationValue, locationSelectionTarget } from './location-switcher-state'

const locationIds = ['linkoping', 'tornby'] as const

describe('effectiveLocationValue', () => {
  it('låter en giltig URL-plats vinna över cookie-valet', () => {
    expect(effectiveLocationValue('tornby', 'linkoping', locationIds)).toBe('tornby')
  })

  it('låter URL-sentineln alla vinna över cookie-valet', () => {
    expect(effectiveLocationValue('alla', 'linkoping', locationIds)).toBe('')
  })

  it('faller tillbaka till ett giltigt cookie-val när URL-parametern saknas eller är ogiltig', () => {
    expect(effectiveLocationValue(null, 'linkoping', locationIds)).toBe('linkoping')
    expect(effectiveLocationValue('okand', 'linkoping', locationIds)).toBe('linkoping')
  })
})

describe('locationSelectionTarget', () => {
  it('ersätter plats men bevarar sidans övriga query-parametrar', () => {
    expect(
      locationSelectionTarget(
        '/admin/bokningar',
        'vy=vecka&datum=2026-07-16&plats=linkoping',
        'tornby',
      ),
    ).toBe('/admin/bokningar?vy=vecka&datum=2026-07-16&plats=tornby')
  })

  it('skriver alla-sentineln när alla platser väljs', () => {
    expect(locationSelectionTarget('/admin/bokningar', 'vy=dag&plats=tornby', '')).toBe(
      '/admin/bokningar?vy=dag&plats=alla',
    )
  })
})
