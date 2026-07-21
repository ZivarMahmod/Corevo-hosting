import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const proof = readFileSync(fileURLToPath(new URL(
  '../../../../supabase/tests/concurrent_overlapping_holds.mjs',
  import.meta.url,
)), 'utf8')

describe('overlapping slot hold concurrency proof', () => {
  it('uses two clients, distinct overlapping starts and deterministic cleanup', () => {
    expect(proof).toContain('const clientA = createClient')
    expect(proof).toContain('const clientB = createClient')
    expect(proof).toContain('15 * 60 * 1000')
    expect(proof).toContain('await Promise.all([')
    expect(proof).toContain("error?.code === '23P01'")
    expect(proof).toContain("clientA.rpc('release_slot_hold'")
    expect(proof).toContain("clientB.rpc('release_slot_hold'")
  })
})
