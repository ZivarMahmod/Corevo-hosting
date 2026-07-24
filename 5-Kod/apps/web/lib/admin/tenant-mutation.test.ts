import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CurrentUser } from '@/lib/auth/session'
import * as tenantModule from './tenant'

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
  it('does not erase the existing admin read context for a deleted tenant', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/admin/tenant.ts'), 'utf8')
    expect(source).not.toContain("if (tenant.status === 'deleted') return null")
  })
})
