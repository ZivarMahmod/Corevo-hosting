import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSeed = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase', name), 'utf8')

describe('preview platform-admin seeds', () => {
  it.each([
    ['seed.sql', '33333333-0000-0000-0000-000000000003'],
    ['seeds/e2e-seed.sql', 'e2e00000-0000-0000-0000-0000000000a3'],
  ])('%s keeps the super-admin identity global', (file, userId) => {
    const sql = readSeed(file)
    expect(sql).toContain('"tenant_id":null,"platform_admin":true')
    expect(sql).toMatch(
      new RegExp(`\\('${userId}',\\s*null,\\s*'[^']+@corevo\\.se'`, 'i'),
    )
    expect(sql).toMatch(
      /insert into public\.tenants \(id, slug, name, status\)[\s\S]*'provisioning'/i,
    )
    expect(sql).toMatch(/update public\.tenants[\s\S]*set status = 'active'/i)
  })
})
