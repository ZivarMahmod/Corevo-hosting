import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (route: string) =>
  readFileSync(new URL(`./${route}/page.tsx`, import.meta.url), 'utf8')

describe('previewens mallsidor', () => {
  it('använder samma mallägda om-, kontakt- och tjänstesidor som public', () => {
    for (const route of ['om', 'kontakt', 'tjanster']) {
      expect(read(route)).toContain(`themePages(theme).${route}`)
    }
    expect(read('tjanster')).toContain('loadLayoutModuleTeasers(')
    expect(read('om')).not.toContain('<StylistSpotlights')
  })
})
