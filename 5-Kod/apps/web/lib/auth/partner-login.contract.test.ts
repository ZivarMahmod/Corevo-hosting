import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('partner login and platform entry contract', () => {
  it('rechecks live role, membership and partner state before selecting the door', () => {
    const actions = read('app/(auth)/actions.ts')
    expect(actions).toContain(".select('level, name, tenant_id')")
    expect(actions).toContain(".from('partner_members')")
    expect(actions).toContain(".select('partner_id, status, partners:partner_id(status)')")
    expect(actions).toContain('resolvePlatformIdentity({')
    expect(actions).toMatch(/loginAccessForHost\(\{[\s\S]*partnerAdmin/)
    expect(actions).toMatch(/portalHomeFor\(\{[\s\S]*partnerAdmin/)
  })

  it('lets a verified partner into the platform layout without weakening root-only auth', () => {
    const layout = read('app/(platform)/layout.tsx')
    const session = read('lib/auth/session.ts')
    expect(layout).toContain('requirePlatformOperator()')
    expect(session).toContain('export async function requirePlatformAdmin')
    expect(session).toContain('export async function requirePlatformOperator')
  })

  it('uses partner identity when completing an invite', () => {
    const landing = read('app/(auth)/fortsatt/page.tsx')
    expect(landing).toContain('partnerAdmin: user.partnerAdmin')
  })
})
