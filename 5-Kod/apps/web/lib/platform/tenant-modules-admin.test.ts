import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentState: 'live' as string | null,
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

function toggle(enabled: boolean) {
  const fd = new FormData()
  fd.set('tenantId', 'tenant-1')
  fd.set('moduleKey', 'shop')
  fd.set('binary', 'true')
  if (enabled) fd.set('enabled', 'true')
  return fd
}

describe('setModuleState', () => {
  beforeEach(() => {
    mocks.currentState = 'live'
    mocks.insert.mockReset().mockResolvedValue({ error: null })
    mocks.updateModuleEq.mockReset().mockResolvedValue({ error: null })
    mocks.updateTenantEq.mockReset().mockReturnValue({ eq: mocks.updateModuleEq })
    mocks.update.mockReset().mockReturnValue({ eq: mocks.updateTenantEq })
    mocks.upsert.mockReset().mockResolvedValue({ error: null })
  })

  it('turns a missing module on through off → live', async () => {
    mocks.currentState = null

    await expect(setModuleState({}, toggle(true))).resolves.toEqual({
      success: 'Modul "shop" är på.',
    })
    expect(mocks.insert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      module_key: 'shop',
      state: 'off',
    })
    expect(mocks.update).toHaveBeenCalledWith({ state: 'live' })
  })

  it('turns a live module off directly', async () => {
    await expect(setModuleState({}, toggle(false))).resolves.toEqual({
      success: 'Modul "shop" är av.',
    })
    expect(mocks.update).toHaveBeenCalledWith({ state: 'off' })
  })
})
