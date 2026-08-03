import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcResult = vi.hoisted(() => ({
  value: {
    data: [] as { module_key: string; state: string }[] | null,
    error: null as { message: string } | null,
  },
}))

vi.mock('next/cache', () => ({
  unstable_cache: (load: () => unknown) => load,
}))

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    rpc: vi.fn(async () => rpcResult.value),
  }),
}))

import {
  getTenantModuleStates,
  isModuleLive,
  moduleState,
} from '@/lib/tenant-modules'

describe('getTenantModuleStates', () => {
  beforeEach(() => {
    rpcResult.value = { data: [], error: null }
  })

  it('fails closed for both missing rows and RPC failures', async () => {
    const missing = await getTenantModuleStates('tenant-1', 'demo')
    expect(missing).toEqual({})
    expect(moduleState(missing, 'booking')).toBe('off')

    rpcResult.value = { data: null, error: { message: 'unavailable' } }
    const failed = await getTenantModuleStates('tenant-1', 'demo')
    expect(failed).toEqual({})
    expect(isModuleLive(failed, 'booking')).toBe(false)
  })
})
