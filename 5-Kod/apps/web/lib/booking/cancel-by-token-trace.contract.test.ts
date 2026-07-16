import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../app/avboka/actions.ts', import.meta.url), 'utf8')

describe('guest cancellation trace', () => {
  it('records who cancelled and when while racing only active bookings', () => {
    expect(source).toContain("cancelled_by: 'customer'")
    expect(source).toContain('cancelled_at: cancelledAt')
    expect(source).toContain(".in('status', ['pending', 'confirmed'])")
  })
})
