import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}))
vi.mock('@/lib/auth/session', () => ({
  requireAdminArea: vi.fn(async () => ({ id: 'user-1' })),
}))
vi.mock('@/lib/admin/tenant', () => ({
  getAdminTenant: vi.fn(async () => ({
    id: 'tenant-1',
    slug: 'demo',
    timeZone: 'Europe/Stockholm',
  })),
  revalidateTenant: mocks.revalidateTenant,
}))

import { saveLocationBookingSettings } from './schedule-actions'

function settingsForm(
  rows: Array<{ weekday: number; start: string; end: string }>,
  rules: { step?: string; notice?: string; advance?: string } = {},
) {
  const fd = new FormData()
  fd.set('location_id', 'location-1')
  fd.set('slot_step_min', rules.step ?? '15')
  fd.set('min_notice_min', rules.notice ?? '60')
  fd.set('max_advance_days', rules.advance ?? '90')
  for (const row of rows) {
    fd.append('weekday', String(row.weekday))
    fd.append('start_time', row.start)
    fd.append('end_time', row.end)
  }
  return fd
}

describe('saveLocationBookingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ error: null })
  })

  it('rejects overlapping or invalid opening-hour rows before the RPC', async () => {
    const state = await saveLocationBookingSettings(
      {},
      settingsForm([
        { weekday: 1, start: '09:00', end: '13:00' },
        { weekday: 1, start: '12:30', end: '17:00' },
      ]),
    )

    expect(state.error).toContain('inte överlappa')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects booking rules outside the database contract', async () => {
    const state = await saveLocationBookingSettings(
      {},
      settingsForm([{ weekday: 1, start: '09:00', end: '17:00' }], { step: '0' }),
    )

    expect(state.error).toContain('Tidsintervallet')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('nekar en tom vecka så bekräftade öppettider aldrig faller tillbaka till personalens tider', async () => {
    const state = await saveLocationBookingSettings({}, settingsForm([]))
    expect(state.error).toContain('minst ett öppet pass')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('sends sorted split intervals to the atomic RPC and revalidates every consumer', async () => {
    const state = await saveLocationBookingSettings(
      {},
      settingsForm([
        { weekday: 2, start: '13:00', end: '17:00' },
        { weekday: 1, start: '09:00', end: '12:00' },
        { weekday: 2, start: '09:00', end: '12:00' },
      ]),
    )

    expect(mocks.rpc).toHaveBeenCalledWith('save_location_booking_settings', {
      p_location: 'location-1',
      p_hours: [
        { weekday: 1, start_time: '09:00', end_time: '12:00' },
        { weekday: 2, start_time: '09:00', end_time: '12:00' },
        { weekday: 2, start_time: '13:00', end_time: '17:00' },
      ],
      p_slot_step_min: 15,
      p_min_notice_min: 60,
      p_max_advance_days: 90,
    })
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/admin/scheman',
      '/personal/arbetstider',
      '/boka',
    ])
    expect(mocks.revalidateTenant).toHaveBeenCalledWith('demo')
    expect(state).toEqual({ success: 'Öppettider och bokningsregler sparade.' })
  })
})
