import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { getPortalPublicTenant } from './public-tenant'

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return builder
}

describe('portal public tenant resolver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only the active passwordless tenant name and keeps tenant A/B isolated', async () => {
    const tenantA = query({ data: { id: 'tenant-a', name: 'FreshCut' }, error: null })
    const settingsA = query({ data: { settings: { customer_portal: { mode: 'passwordless_tenant' }, private_note: 'never-return' } }, error: null })
    const tenantB = query({ data: { id: 'tenant-b', name: 'Nordverk' }, error: null })
    const settingsB = query({ data: { settings: { customer_portal: { mode: 'passwordless_tenant' } } }, error: null })
    mocks.createServiceClient
      .mockReturnValueOnce({ from: vi.fn().mockReturnValueOnce(tenantA).mockReturnValueOnce(settingsA) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValueOnce(tenantB).mockReturnValueOnce(settingsB) })

    const first = await getPortalPublicTenant('freshcut')
    const second = await getPortalPublicTenant('nordverk')
    expect(first).toEqual({ tenantName: 'FreshCut' })
    expect(second).toEqual({ tenantName: 'Nordverk' })
    expect(JSON.stringify(first)).not.toContain('never-return')
    expect(tenantA.eq).toHaveBeenCalledWith('slug', 'freshcut')
    expect(tenantB.eq).toHaveBeenCalledWith('slug', 'nordverk')
  })

  it.each(['legacy_account', 'off', 'global_account', undefined])('fails closed for disabled mode %s', async (mode) => {
    const tenant = query({ data: { id: 'tenant-a', name: 'FreshCut' }, error: null })
    const settings = query({ data: { settings: { customer_portal: { mode } } }, error: null })
    mocks.createServiceClient.mockReturnValue({ from: vi.fn().mockReturnValueOnce(tenant).mockReturnValueOnce(settings) })
    await expect(getPortalPublicTenant('freshcut')).resolves.toBeNull()
  })

  it('rejects malformed slugs without a database call', async () => {
    await expect(getPortalPublicTenant('Bad-Slug')).resolves.toBeNull()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })

  it('uses request-scoped React cache so metadata and page share tenant resolution', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/customer-portal/public-tenant.ts'), 'utf8')
    expect(source).toMatch(/export const getPortalPublicTenant\s*=\s*cache\(/)
  })
})
