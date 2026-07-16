import { describe, expect, it, vi } from 'vitest'
import { loadLocationAvailability } from './location-rules'

type Result = { data: unknown; error: { message: string } | null }

function clientWith(results: Result[]) {
  return {
    from: vi.fn(() => {
      const result = results.shift() ?? { data: null, error: null }
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        maybeSingle: async () => result,
        then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return chain
    }),
  }
}

const LOCATION = {
  id: 'location-1',
  timezone: 'Europe/Stockholm',
  slot_step_min: 15,
  min_notice_min: 0,
  max_advance_days: 90,
}

describe('loadLocationAvailability', () => {
  it('kastar vid platsfel i stället för att visa falska tider', async () => {
    const client = clientWith([{ data: null, error: { message: 'db down' } }])
    await expect(loadLocationAvailability(client, 'tenant-1', 'location-1')).rejects.toThrow(
      'loadLocationAvailability.location',
    )
  })

  it('kastar vid öppettidsfel i stället för att falla tillbaka till personalens schema', async () => {
    const client = clientWith([
      { data: LOCATION, error: null },
      { data: null, error: { message: 'policy error' } },
    ])
    await expect(loadLocationAvailability(client, 'tenant-1', 'location-1')).rejects.toThrow(
      'loadLocationAvailability.hours',
    )
  })
})
