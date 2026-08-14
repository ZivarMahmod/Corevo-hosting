import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAdminTenant: vi.fn(),
  listServices: vi.fn(),
  requireActiveTenantMutation: vi.fn(),
  requireAdminArea: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth/session', () => ({ requireAdminArea: mocks.requireAdminArea }))
vi.mock('@/lib/admin/tenant', () => ({
  getAdminTenant: mocks.getAdminTenant,
  requireActiveTenantMutation: mocks.requireActiveTenantMutation,
  revalidateTenant: mocks.revalidateTenant,
}))
vi.mock('@/lib/admin/data', () => ({ listServices: mocks.listServices }))

import { listServicesResource, updateService } from './actions'

const user = { id: 'user-1', tenantId: 'tenant-session' }
const tenant = {
  id: 'tenant-session',
  slug: 'demo',
  name: 'Demo',
  locationId: 'location-1',
}

function serviceForm(id: string) {
  const formData = new FormData()
  formData.set('id', id)
  formData.set('name', 'Klippning')
  formData.set('category', 'Hår')
  formData.set('duration_min', '30')
  formData.set('price', '450')
  return formData
}

describe('service server-action boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminArea.mockResolvedValue(user)
    mocks.getAdminTenant.mockResolvedValue(tenant)
    mocks.requireActiveTenantMutation.mockResolvedValue(undefined)
    mocks.listServices.mockResolvedValue([])
  })

  it('reads through the authenticated tenant without applying the mutation-only guard', async () => {
    await expect(listServicesResource()).resolves.toEqual({ records: [] })

    expect(mocks.requireAdminArea).toHaveBeenCalledWith('tjanster')
    expect(mocks.getAdminTenant).toHaveBeenCalledWith(user)
    expect(mocks.listServices).toHaveBeenCalledWith('tenant-session')
    expect(mocks.requireActiveTenantMutation).not.toHaveBeenCalled()
  })

  it('keeps update IDs fenced to the server-derived tenant', async () => {
    const query = {
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(async () => ({ data: null, error: { code: 'PGRST116' } })),
    }
    query.eq.mockReturnValue(query)
    query.select.mockReturnValue(query)
    const update = vi.fn(() => query)
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => ({ update })) })

    await expect(updateService({}, serviceForm('service-other-tenant'))).resolves.toEqual({
      error: 'Något gick fel. Försök igen.',
    })

    expect(mocks.requireActiveTenantMutation).toHaveBeenCalledWith(user, 'tenant-session')
    expect(query.eq.mock.calls).toEqual([
      ['id', 'service-other-tenant'],
      ['tenant_id', 'tenant-session'],
    ])
  })
})
