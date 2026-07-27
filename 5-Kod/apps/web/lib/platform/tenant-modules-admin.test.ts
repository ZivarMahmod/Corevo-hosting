import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentState: 'paused' as string | null,
  insert: vi.fn(),
  update: vi.fn(),
  updateTenantEq: vi.fn(),
  updateModuleEq: vi.fn(),
  upsert: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
  logPlatformAction: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/admin/tenant', () => ({
  revalidateTenant: mocks.revalidateTenant,
}))
vi.mock('@/lib/platform/audit', () => ({
  logPlatformAction: mocks.logPlatformAction,
}))
vi.mock('@/lib/platform/guard', () => ({
  platformCtx: async () => ({
    user: { id: 'operator-1' },
    supabase: {
      from: (table: string) => {
        if (table === 'modules') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { key: 'shop' }, error: null }) }),
            }),
          }
        }
        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({ single: async () => ({ data: { slug: 'demo' }, error: null }) }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mocks.currentState ? { state: mocks.currentState } : null,
                  error: null,
                }),
              }),
            }),
          }),
          insert: mocks.insert,
          update: mocks.update,
          upsert: mocks.upsert,
        }
      },
    },
  }),
}))

import { setModuleState } from '@/lib/platform/tenant-modules-admin'

function form(state: string) {
  const fd = new FormData()
  fd.set('tenantId', 'tenant-1')
  fd.set('moduleKey', 'shop')
  fd.set('state', state)
  return fd
}

describe('setModuleState', () => {
  beforeEach(() => {
    mocks.currentState = 'paused'
    mocks.insert.mockReset().mockResolvedValue({ error: null })
    mocks.updateModuleEq.mockReset().mockResolvedValue({ error: null })
    mocks.updateTenantEq.mockReset().mockReturnValue({ eq: mocks.updateModuleEq })
    mocks.update.mockReset().mockReturnValue({ eq: mocks.updateTenantEq })
    mocks.upsert.mockReset().mockResolvedValue({ error: null })
  })

  it('rejects an illegal shortcut before writing', async () => {
    await expect(setModuleState({}, form('off'))).resolves.toEqual({
      error: 'Otillåten ändring av modul-läge.',
    })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('allows the canonical paused → live transition', async () => {
    await expect(setModuleState({}, form('live'))).resolves.toEqual({
      success: 'Modul "shop" satt till live.',
    })
    expect(mocks.update).toHaveBeenCalledWith({ state: 'live' })
    expect(mocks.updateTenantEq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(mocks.updateModuleEq).toHaveBeenCalledWith('module_key', 'shop')
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('creates missing modules at off before the legal off → draft transition', async () => {
    mocks.currentState = null

    await expect(setModuleState({}, form('draft'))).resolves.toEqual({
      success: 'Modul "shop" satt till draft.',
    })
    expect(mocks.insert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      module_key: 'shop',
      state: 'off',
    })
    expect(mocks.update).toHaveBeenCalledWith({ state: 'draft' })
    expect(mocks.updateTenantEq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(mocks.updateModuleEq).toHaveBeenCalledWith('module_key', 'shop')
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
