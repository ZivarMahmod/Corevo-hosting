import { describe, it, expect } from 'vitest'
import { decideNoShowRefund } from './no-show-refund'

// No-show-refund DORMANT contract (M8 §2.4): the logic is built + proven, but it is
// NOT wired into any no_show transition — marking a no-show today has zero payment
// side-effect. These tests pin the decision so activation is a wiring change only.
describe('decideNoShowRefund (DORMANT, M8 §2.4)', () => {
  it('refunds only when policy=refund AND the payment succeeded', () => {
    expect(decideNoShowRefund('refund', 'succeeded')).toBe('refund')
  })

  it('keeps the money when policy=keep_as_fee even for a succeeded payment', () => {
    expect(decideNoShowRefund('keep_as_fee', 'succeeded')).toBe('keep')
  })

  it('keeps when there was no successful charge (pending/failed/refunded/none)', () => {
    for (const status of ['pending', 'failed', 'refunded', null, undefined]) {
      expect(decideNoShowRefund('refund', status)).toBe('keep')
    }
  })

  it('keeps for a salong utan online-betalning (null payment) under either policy', () => {
    expect(decideNoShowRefund('refund', null)).toBe('keep')
    expect(decideNoShowRefund('keep_as_fee', null)).toBe('keep')
  })
})
