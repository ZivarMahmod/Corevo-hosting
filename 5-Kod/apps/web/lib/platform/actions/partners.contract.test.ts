import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'lib/platform/actions/partners.ts'), 'utf8')

describe('partner management action boundaries', () => {
  it('keeps partner creation, pricing, status and tenant moves root-only', () => {
    for (const action of ['createPartner', 'updatePartner', 'moveTenantToPartner']) {
      const start = source.indexOf(`export async function ${action}`)
      expect(start, action).toBeGreaterThan(-1)
      expect(source.slice(start, start + 700), action).toContain('platformAdminCtx()')
    }
    expect(source).toContain('parsePartnerPriceOre')
    expect(source).toContain(".update({ partner_id: partnerId || null })")
    expect(source).toContain(".in('status', ['active', 'suspended'])")
  })

  it('creates an emailed partner login and compensates incomplete provisioning', () => {
    expect(source).toContain('inviteUserByEmail')
    expect(source).toContain("inviteRedirectUrl('partner')")
    expect(source).toContain(".eq('name', 'partner_admin')")
    expect(source).toContain("role: 'owner'")
    expect(source).toContain("status: 'provisioning'")
    expect(source).toContain(".update({ status: 'active' })")
    expect(source).toContain('partner_admin: false')
    expect(source).toContain(".from('partner_members')")
    expect(source).toContain(".from('users').delete()")
    expect(source).toContain('getUserById(authId)')
    expect(source).toContain('partnerProfileCommitted')
    expect(source).toContain('partnerMembershipCommitted')
    expect(source).toContain('partnerActivationCommitted')
    expect(source).toContain('deleteUser(args.authId)')
    expect(source).toContain('if (partnerDeleteError || !deletedPartner) return false')
    expect(source).toContain(".eq('status', 'provisioning')")
  })

  it('lets a verified partner save only its own SMS configuration through the scoped RPC', () => {
    const start = source.indexOf('export async function savePartnerSmsConfig')
    const action = source.slice(start, start + 1_800)
    expect(action).toContain('platformCtx()')
    expect(action).toContain("scope.kind === 'partner'")
    expect(action).toContain("supabase.rpc('save_partner_sms_config'")
  })
})
