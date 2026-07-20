import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

describe('inaktiv personal förlorar adminåtkomst', () => {
  it('löser aktiv staff-länk för alla tenantroller men kräver den bara för staffrollen', () => {
    const source = fs.readFileSync(path.join(ROOT, 'session.ts'), 'utf8')

    expect(source).toContain(".select('tenant_id, role_id, status, roles:role_id(level, name, tenant_id)')")
    expect(source).toContain(".from('staff')")
    // Plan 011: DAL:en läser identiteten ur verifierade JWT-claims (userId = claims.sub).
    expect(source).toContain(".eq('profile_id', userId)")
    expect(source).toContain(".eq('active', true)")
    expect(source).toContain("profile?.status === 'active'")
    expect(source).toContain("profile?.status === 'active' && profile.tenant_id")
    expect(source).not.toContain("role?.level === 3 && profile.tenant_id")
    expect(source).toContain('role?.level !== 3 || Boolean(activeStaff)')
    expect(source).toContain('resolvePlatformIdentity({')
    expect(source).toContain('accountAuthorized')
    expect(source).toContain('role?.tenant_id === null')
  })
})
