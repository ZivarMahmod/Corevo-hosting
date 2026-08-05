import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANCELLATION_CUTOFF_HOURS,
  getCancellationCutoffHours,
  withinCancellationWindow,
} from './settings'

function settingsClient(value: unknown) {
  const query = {
    eq: () => query,
    maybeSingle: async () => ({ data: { settings: { cancellation_cutoff_hours: value } } }),
    select: () => query,
  }
  return { from: () => query }
}

describe('customer cancellation policy reader', () => {
  it('blocks the exact cutoff boundary and allows time strictly beyond it', () => {
    const now = new Date('2030-01-01T10:00:00.000Z')
    expect(withinCancellationWindow('2030-01-02T10:00:00.000Z', 24, now)).toBe(false)
    expect(withinCancellationWindow('2030-01-02T10:00:00.001Z', 24, now)).toBe(true)
  })

  it.each([1.5, 8761, -1, '24', null])(
    'falls back for a non-integer or out-of-range stored cutoff: %p',
    async (value) => {
      await expect(
        getCancellationCutoffHours(settingsClient(value) as never, 'tenant-id'),
      ).resolves.toBe(DEFAULT_CANCELLATION_CUTOFF_HOURS)
    },
  )

  it('accepts an integer cutoff from zero through 8760', async () => {
    await expect(getCancellationCutoffHours(settingsClient(0) as never, 'tenant-id')).resolves.toBe(0)
    await expect(getCancellationCutoffHours(settingsClient(8760) as never, 'tenant-id')).resolves.toBe(8760)
  })
})
