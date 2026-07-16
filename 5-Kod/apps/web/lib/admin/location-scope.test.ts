import { describe, expect, it } from 'vitest'
import { requiredLocationId } from './location-scope'

describe('requiredLocationId', () => {
  const allowed = ['plats-a', 'plats-b']

  it('använder ett uttryckligt giltigt platsval', () => {
    expect(requiredLocationId('plats-b', allowed, 'plats-a')).toBe('plats-b')
  })

  it('gör Alla platser till användarens giltiga primärplats på mutationsytor', () => {
    expect(requiredLocationId('alla', allowed, 'plats-b')).toBe('plats-b')
    expect(requiredLocationId('', allowed, 'plats-b')).toBe('plats-b')
  })

  it('litar aldrig på en ogiltig primärplats eller URL', () => {
    expect(requiredLocationId('annan-tenant', allowed, 'plats-x')).toBeNull()
  })

  it('nekar när en platsbegränsad användare saknar medlemskap', () => {
    expect(requiredLocationId(undefined, [], 'plats-a')).toBeNull()
  })
})
