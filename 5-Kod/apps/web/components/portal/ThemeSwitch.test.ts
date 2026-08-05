import { describe, expect, it } from 'vitest'
import { nextThemeMode } from './ThemeSwitch'

describe('nextThemeMode', () => {
  it('cycles through the three supported modes', () => {
    expect(nextThemeMode('auto')).toBe('light')
    expect(nextThemeMode('light')).toBe('dark')
    expect(nextThemeMode('dark')).toBe('auto')
  })
})
