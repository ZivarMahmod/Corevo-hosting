import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../app/(personal)/personal/page.tsx', import.meta.url), 'utf8')

describe('personal rebooking duration snapshot', () => {
  it('preserves the duration stored on the booking instead of using the current service duration', () => {
    expect(source).toContain(".select('id, start_ts, end_ts, staff_id')")
    expect(source).toContain('new Date(booking.end_ts).getTime() - new Date(booking.start_ts).getTime()')
    expect(source).toContain('staff.find((member) => member.id === booking.staff_id)?.timeZone')
    expect(source).not.toContain(".select('id, start_ts, services(duration_min)')")
    expect(page).toContain('mine.find((member) => member.id === selectedStaffId)?.timeZone')
  })
})
