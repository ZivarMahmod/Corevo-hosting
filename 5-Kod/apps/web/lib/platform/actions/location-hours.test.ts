import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platformCtx: vi.fn(),
  assertPlatformTenantAccess: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenantById: vi.fn(),
  audit: vi.fn(),
  report: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('../guard', () => ({
  platformCtx: () => mocks.platformCtx(),
  assertPlatformTenantAccess: (...args: unknown[]) => mocks.assertPlatformTenantAccess(...args),
}))
vi.mock('../audit', () => ({ logPlatformAction: (...args: unknown[]) => mocks.audit(...args) }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenantById: mocks.revalidateTenantById }))
vi.mock('./observe', () => ({ reportActionError: (...args: unknown[]) => mocks.report(...args) }))

import { savePlatformLocationBookingSettings } from './location-hours'

function form(locationId = 'location-1', tenantId: string | null = 'tenant-1') {
  const fd = new FormData()
  fd.set('location_id', locationId)
  if (tenantId) fd.set('tenant_id', tenantId)
  fd.set('weekday', '1')
  fd.set('start_time', '09:00')
  fd.set('end_time', '17:00')
  fd.set('slot_step_min', '15')
  fd.set('min_notice_min', '60')
  fd.set('max_advance_days', '90')
  return fd
}

function client(
  location: { id: string; tenant_id: string } | null,
  locationError: { message: string } | null = null,
) {
  const rpc = vi.fn(async () => ({ error: null }))
  const eq = vi.fn(() => chain)
  const maybeSingle = vi.fn(async () => ({ data: location, error: locationError }))
  const chain = { select: vi.fn(() => chain), eq, maybeSingle }
  return { from: vi.fn(() => chain), rpc, locationEq: eq }
}

describe('savePlatformLocationBookingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.assertPlatformTenantAccess.mockResolvedValue(undefined)
  })

  it('rejects a missing tenant before reading a location', async () => {
    const supabase = client({ id: 'location-1', tenant_id: 'tenant-1' })
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    await expect(
      savePlatformLocationBookingSettings({}, form('location-1', null)),
    ).resolves.toEqual({ error: 'Saknar kund.' })
    expect(mocks.assertPlatformTenantAccess).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fences a location from another tenant before the booking settings RPC', async () => {
    const supabase = client(null)
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    await expect(savePlatformLocationBookingSettings({}, form())).resolves.toEqual({
      error: 'Platsen finns inte hos den här kunden.',
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('saves a tenant-visible location through the existing atomic RPC', async () => {
    const supabase = client({ id: 'location-1', tenant_id: 'tenant-1' })
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    await expect(savePlatformLocationBookingSettings({}, form())).resolves.toEqual({
      success: 'Öppettider och bokningsregler sparade.',
    })
    expect(supabase.from).toHaveBeenCalledWith('locations')
    expect(mocks.assertPlatformTenantAccess).toHaveBeenCalledWith(supabase, 'tenant-1')
    expect(supabase.locationEq).toHaveBeenCalledWith('id', 'location-1')
    expect(supabase.locationEq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(supabase.locationEq).toHaveBeenCalledWith('active', true)
    expect(supabase.rpc).toHaveBeenCalledWith('save_location_booking_settings', {
      p_location: 'location-1',
      p_hours: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      p_slot_step_min: 15,
      p_min_notice_min: 60,
      p_max_advance_days: 90,
    })
    expect(mocks.revalidateTenantById).toHaveBeenCalledWith(supabase, 'tenant-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/kunder/tenant-1')
    expect(mocks.audit).toHaveBeenCalledWith(supabase, expect.objectContaining({
      action: 'tenant.location_hours_save', tenantId: 'tenant-1', entityId: 'location-1',
    }))
  })

  it('returns a generic error when the scoped location query fails', async () => {
    const supabase = client(null, { message: 'location query failed' })
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })

    await expect(savePlatformLocationBookingSettings({}, form())).resolves.toEqual({
      error: 'Något gick fel. Försök igen.',
    })
    expect(mocks.report).toHaveBeenCalledWith(
      'savePlatformLocationBookingSettings.location',
      { message: 'location query failed' },
      { tenantId: 'tenant-1' },
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns an anonymous inline error before any query when tenant scope is denied', async () => {
    const supabase = client({ id: 'location-1', tenant_id: 'tenant-foreign' })
    mocks.platformCtx.mockResolvedValue({ user: { id: 'admin-1' }, supabase })
    mocks.assertPlatformTenantAccess.mockRejectedValue(new Error('scope denied'))

    await expect(savePlatformLocationBookingSettings({}, form())).resolves.toEqual({
      error: 'Platsen finns inte hos den här kunden.',
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
