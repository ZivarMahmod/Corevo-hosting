import { describe, expect, it } from 'vitest'
import {
  finalizeCustomerRebookSafely,
  isDefinitiveRebookFinalizationError,
  isFinalizedCustomerRebook,
} from './rebook-finalization'

describe('customer rebook finalization result', () => {
  it.each(['finalized', 'already_finalized'] as const)('accepts the strict %s result', (outcome) => {
    expect(isFinalizedCustomerRebook({ outcome, payment_carried: outcome === 'finalized' })).toBe(true)
  })

  it.each([null, {}, { outcome: 'finalized' }, { outcome: 'unknown', payment_carried: false }])(
    'rejects ambiguous RPC data: %j',
    (value) => expect(isFinalizedCustomerRebook(value)).toBe(false),
  )

  it('retries after commit-then-response-loss and accepts the idempotent result', async () => {
    const calls: string[] = []
    const responses = [
      { data: null, error: { message: 'fetch failed' } },
      { data: { outcome: 'already_finalized', payment_carried: true }, error: null },
    ]

    const result = await finalizeCustomerRebookSafely({
      finalize: async () => {
        calls.push('finalize')
        return responses.shift()!
      },
      compensate: async () => {
        calls.push('compensate')
        return { data: null, error: null }
      },
    })

    expect(result).toEqual({
      ok: true,
      finalization: { outcome: 'already_finalized', payment_carried: true },
    })
    expect(calls).toEqual(['finalize', 'finalize'])
  })

  it('preserves a committed mapping when both finalize responses are ambiguous', async () => {
    let finalizeCalls = 0
    const result = await finalizeCustomerRebookSafely({
      finalize: async () => {
        finalizeCalls += 1
        return { data: {}, error: null }
      },
      compensate: async () => ({
        data: { outcome: 'preserved_finalized', payment_carried: true },
        error: null,
      }),
    })

    expect(finalizeCalls).toBe(2)
    expect(result).toEqual({
      ok: true,
      finalization: { outcome: 'already_finalized', payment_carried: true },
    })
  })

  it('does not retry a definitive domain rejection and uses DB-owned compensation', async () => {
    const calls: string[] = []
    const result = await finalizeCustomerRebookSafely({
      finalize: async () => {
        calls.push('finalize')
        return {
          data: null,
          error: { code: '55000', message: 'rebook_payment_not_settled' },
        }
      },
      compensate: async () => {
        calls.push('compensate')
        return { data: { outcome: 'compensated' }, error: null }
      },
    })

    expect(result).toEqual({ ok: false })
    expect(calls).toEqual(['finalize', 'compensate'])
  })

  it('classifies only named database domain rejections as definitive', () => {
    expect(isDefinitiveRebookFinalizationError({
      code: '55000',
      message: 'rebook_payment_not_settled',
    })).toBe(true)
    expect(isDefinitiveRebookFinalizationError({ code: '55000', message: 'unknown' })).toBe(false)
    expect(isDefinitiveRebookFinalizationError({ message: 'fetch failed' })).toBe(false)
  })
})
