import { describe, expect, it } from 'vitest'
import { accentForeground, accentInk, contrastRatio, injectTenantTokens } from '@corevo/ui'

describe('tenant branding contrast tokens', () => {
  it('keeps text on an arbitrary tenant primary WCAG-readable', () => {
    const foreground = accentForeground('#B5651D')
    expect(foreground).toBe('#000000')
    expect(contrastRatio(foreground!, '#B5651D')).toBeGreaterThanOrEqual(4.5)

    expect(injectTenantTokens({ color_primary: '#B5651D' })).toMatchObject({
      '--color-primary': '#B5651D',
      '--color-primary-fg': '#000000',
      '--color-accent-fg': '#000000',
      '--tenant-primary-fg': '#000000',
      '--tenant-primary-ink': 'var(--color-fg)',
    })
  })

  it('keeps primary ink readable on a medium accent-soft surface', () => {
    const ink = accentInk('#C9973F', '#89857D')
    expect(contrastRatio(ink!, '#89857D')).toBeGreaterThanOrEqual(4.5)
  })
})
