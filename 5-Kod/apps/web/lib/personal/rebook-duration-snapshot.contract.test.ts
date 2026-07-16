import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8')

describe('personal rebooking duration snapshot', () => {
  it('preserves the duration stored on the booking instead of using the current service duration', () => {
    expect(source).toContain(".select('id, start_ts, end_ts')")
    expect(source).toContain('new Date(booking.end_ts).getTime() - new Date(booking.start_ts).getTime()')
    expect(source).not.toContain(".select('id, start_ts, services(duration_min)')")
  })
})
