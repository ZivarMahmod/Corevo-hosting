import { describe, expect, it } from 'vitest'
import { contactWindowBounds, isWithinContactWindow } from './contact-window'

describe('operational customer contact window', () => {
  const now = new Date('2030-06-15T12:00:00.000Z')

  it('matches the existing 720h-before/24h-after contract', () => {
    const bounds = contactWindowBounds(now)
    expect(bounds.fromUtc).toBe('2030-05-16T12:00:00.000Z')
    expect(bounds.toUtc).toBe('2030-06-16T12:00:00.000Z')
    expect(isWithinContactWindow('2030-05-16T12:00:00.000Z', now)).toBe(true)
    expect(isWithinContactWindow('2030-06-16T12:00:00.000Z', now)).toBe(true)
  })

  it('keeps a far-historical booking phone out of the client payload', () => {
    expect(isWithinContactWindow('2029-01-01T10:00:00.000Z', now)).toBe(false)
  })
})
