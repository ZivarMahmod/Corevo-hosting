import { describe, expect, it } from 'vitest'
import { contactWindowBounds } from './contact-window'

describe('operational customer contact window', () => {
  const now = new Date('2030-06-15T12:00:00.000Z')

  it('matches the existing 720h-before/24h-after contract', () => {
    const bounds = contactWindowBounds(now)
    expect(bounds.fromUtc).toBe('2030-05-16T12:00:00.000Z')
    expect(bounds.toUtc).toBe('2030-06-16T12:00:00.000Z')
  })
})
