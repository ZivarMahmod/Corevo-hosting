import { describe, expect, it } from 'vitest'
import { createCartToken } from './CartProvider'

describe('createCartToken', () => {
  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    const source = {
      getRandomValues<T extends ArrayBufferView>(target: T): T {
        const bytes = new Uint8Array(target.buffer, target.byteOffset, target.byteLength)
        bytes.set(Array.from({ length: bytes.length }, (_, index) => index))
        return target
      },
    }

    expect(createCartToken(source)).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })
})
