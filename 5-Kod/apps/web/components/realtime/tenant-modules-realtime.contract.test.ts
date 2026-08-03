import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('tenant module realtime contract', () => {
  it('refreshes customer, customer-admin and platform surfaces from a safe signal', () => {
    const subscriber = read('./RealtimeTenantModules.tsx')
    const storefront = read('../../app/(public)/layout.tsx')
    const admin = read('../../app/(admin)/layout.tsx')
    const platform = read('../../app/(platform)/layout.tsx')

    expect(subscriber).toContain("table: 'tenant_module_revisions'")
    expect(subscriber).toContain('router.refresh()')
    expect(storefront).toContain('<RealtimeTenantModulesLazy tenantId={tenant.id} />')
    expect(admin).toContain('<RealtimeTenantModulesLazy tenantId={user.tenantId ?? undefined} />')
    expect(platform).toContain('<RealtimeTenantModulesLazy />')
  })
})
