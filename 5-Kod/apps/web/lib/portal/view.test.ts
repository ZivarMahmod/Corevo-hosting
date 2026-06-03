import { describe, it, expect } from 'vitest'
import { pickPersistedView } from './view'

const VIEWS = ['lista', 'vecka'] as const

describe('pickPersistedView', () => {
  it('returns the saved value when it is a currently-valid key', () => {
    expect(pickPersistedView('vecka', VIEWS, 'lista')).toBe('vecka')
  })

  it('falls back when nothing is saved (null / undefined / empty)', () => {
    expect(pickPersistedView(null, VIEWS, 'lista')).toBe('lista')
    expect(pickPersistedView(undefined, VIEWS, 'lista')).toBe('lista')
    expect(pickPersistedView('', VIEWS, 'lista')).toBe('lista')
  })

  it('falls back when the saved value is stale / removed / tampered', () => {
    // "tavla" used to be a Bokningar view; after it was dropped the operator
    // must not land on it.
    expect(pickPersistedView('tavla', VIEWS, 'lista')).toBe('lista')
    expect(pickPersistedView('<script>', VIEWS, 'lista')).toBe('lista')
  })
})
