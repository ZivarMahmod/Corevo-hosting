import { describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '@/lib/auth/session'
import * as tenantModule from './tenant'

const createClient = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({ createClient }))

type ActiveTenantGuard = (
  user: CurrentUser,
  tenantId: string,
  client?: unknown,
) => Promise<void>

const guard = (tenantModule as unknown as {
  requireActiveTenantMutation?: ActiveTenantGuard
}).requireActiveTenantMutation

const tenantUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  platformAdmin: false,
  partnerAdmin: false,
  partnerId: null,
} as CurrentUser

function tenantStatusClient(status: string | null, error: unknown = null) {
  const maybeSingle = vi.fn(async () => ({
    data: status === null ? null : { status },
    error,
  }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from }, from, select, eq, maybeSingle }
}

function tenantReadQuery(data: unknown) {
  const maybeSingle = vi.fn(async () => ({ data, error: null }))
  const eq = vi.fn(() => ({ eq, maybeSingle }))
  return { select: vi.fn(() => ({ eq })) }
}

describe('requireActiveTenantMutation', () => {
  it('exposes one shared tenant-mutation guard', () => {
    expect(guard).toBeTypeOf('function')
  })

  it('allows an active tenant member to mutate the verified session tenant', async () => {
    expect(guard).toBeTypeOf('function')
    if (!guard) return
    const lookup = tenantStatusClient('active')

    await expect(guard(tenantUser, 'tenant-1', lookup.client)).resolves.toBeUndefined()

    expect(lookup.from).toHaveBeenCalledWith('tenants')
    expect(lookup.eq).toHaveBeenCalledWith('id', 'tenant-1')
  })

  it.each(['provisioning', 'suspended', 'deleted'])(
    'denies tenant-owned mutations while tenant status is %s',
    async (status) => {
      expect(guard).toBeTypeOf('function')
      if (!guard) return

      await expect(
        guard(tenantUser, 'tenant-1', tenantStatusClient(status).client),
      ).rejects.toThrow('tenant_mutation_requires_active_tenant')
    },
  )

  it('fails closed on a tenant lookup error or a cross-tenant target', async () => {
    expect(guard).toBeTypeOf('function')
    if (!guard) return

    await expect(
      guard(tenantUser, 'tenant-1', tenantStatusClient(null, new Error('db')).client),
    ).rejects.toThrow('tenant_mutation_requires_active_tenant')
    await expect(
      guard(tenantUser, 'tenant-2', tenantStatusClient('active').client),
    ).rejects.toThrow('tenant_mutation_requires_active_tenant')
  })

  it('keeps the existing verified platform and partner operator bypass explicit', async () => {
    expect(guard).toBeTypeOf('function')
    if (!guard) return
    const unusedClient = tenantStatusClient('suspended')

    await expect(
      guard({ ...tenantUser, tenantId: null, platformAdmin: true }, 'tenant-2', unusedClient.client),
    ).resolves.toBeUndefined()
    await expect(
      guard(
        { ...tenantUser, tenantId: null, partnerAdmin: true, partnerId: 'partner-1' },
        'tenant-2',
        unusedClient.client,
      ),
    ).resolves.toBeUndefined()
    expect(unusedClient.from).not.toHaveBeenCalled()
  })
})

describe('inactive tenant read context', () => {
  it('preserves the existing admin read context for a deleted tenant', async () => {
    const queries = {
      tenants: tenantReadQuery({
        id: 'tenant-1',
        slug: 'tenant-one',
        name: 'Tenant One',
        status: 'deleted',
        vertical_id: null,
        stripe_charges_enabled: false,
      }),
      locations: tenantReadQuery(null),
      tenant_settings: tenantReadQuery(null),
    }
    const from = vi.fn((table: keyof typeof queries) => queries[table])
    createClient.mockResolvedValue({ from })

    await expect(tenantModule.loadAdminTenantById('tenant-1')).resolves.toMatchObject({
      id: 'tenant-1',
      slug: 'tenant-one',
      name: 'Tenant One',
    })
    expect(from).toHaveBeenCalledWith('tenants')
  })
})
