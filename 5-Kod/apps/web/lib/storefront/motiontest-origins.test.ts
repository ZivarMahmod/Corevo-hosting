import { describe, expect, it } from 'vitest'

async function loadOrigins() {
  return import('./motiontest-origins').catch(() => null)
}

describe('motiontest E2E origins', () => {
  it('exposes an exact live FreshCut origin resolver', async () => {
    const origins = await loadOrigins()
    expect(typeof origins?.resolveLiveFreshCutOrigin).toBe('function')
  })

  it('accepts only the exact HTTPS FreshCut origin', async () => {
    const origins = await loadOrigins()
    const resolve = origins?.resolveLiveFreshCutOrigin
    if (!resolve) {
      expect(resolve).toBeTypeOf('function')
      return
    }

    expect(resolve(undefined)).toBeNull()
    expect(resolve('https://freshcut.corevo.se')).toBe('https://freshcut.corevo.se')

    for (const value of [
      'http://freshcut.corevo.se',
      'https://freshcut.corevo.se:443',
      'https://freshcut.corevo.se/path',
      'https://freshcut.corevo.se?preview=1',
      'https://other.corevo.se',
      'https://example.com',
      'https://motiontest.corevo.se',
    ]) {
      expect(() => resolve(value), value).toThrow(/exact https:\/\/freshcut\.corevo\.se origin/i)
    }
  })
})
