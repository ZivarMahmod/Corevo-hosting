import { describe, expect, it } from 'vitest'
import { parseLocationBookingSettings } from './location-settings-form'

function form(rows: Array<{ weekday: number; start: string; end: string }>) {
  const fd = new FormData()
  fd.set('location_id', 'location-1')
  fd.set('slot_step_min', '15')
  fd.set('min_notice_min', '60')
  fd.set('max_advance_days', '90')
  for (const row of rows) {
    fd.append('weekday', String(row.weekday))
    fd.append('start_time', row.start)
    fd.append('end_time', row.end)
  }
  return fd
}

describe('parseLocationBookingSettings', () => {
  it('sorts valid split intervals for the shared booking-settings RPC contract', () => {
    expect(parseLocationBookingSettings(form([
      { weekday: 2, start: '13:00', end: '17:00' },
      { weekday: 1, start: '09:00', end: '12:00' },
    ]))).toMatchObject({
      locationId: 'location-1',
      hours: [
        { weekday: 1, start_time: '09:00', end_time: '12:00' },
        { weekday: 2, start_time: '13:00', end_time: '17:00' },
      ],
    })
  })

  it('rejects overlapping intervals before either admin action can call the RPC', () => {
    expect(parseLocationBookingSettings(form([
      { weekday: 1, start: '09:00', end: '13:00' },
      { weekday: 1, start: '12:30', end: '17:00' },
    ]))).toEqual({ error: 'Öppettider samma dag får inte överlappa varandra.' })
  })
})
