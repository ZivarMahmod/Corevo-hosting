import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('staff invite service adapter', () => {
  it('checks target and existing auth binding independently', () => {
    const source = fs.readFileSync(path.join(WEB_ROOT, 'lib/auth/staff-invite-service.ts'), 'utf8')
    const start = source.indexOf('export async function findStaffInviteBinding')
    const end = source.indexOf('type IncidentReporter', start)
    const binding = source.slice(start, end)

    expect(binding).toContain(".eq('id', args.targetStaffId)")
    expect(binding).toContain(".eq('profile_id', args.authId)")
    expect(binding).toContain('authBoundStaffId')
    expect(binding).toContain('Promise.all')

    const compensation = source.slice(source.indexOf('export async function compensateFailedStaffInvite'))
    expect(compensation).toContain("...(args.targetStaffId ? { targetStaffId: args.targetStaffId } : {})")
  })

  it('requires an active public profile and a live, unbanned Auth user before reuse', () => {
    const source = fs.readFileSync(path.join(WEB_ROOT, 'lib/auth/staff-invite-service.ts'), 'utf8')
    const start = source.indexOf('export async function findExistingStaffInviteProfile')
    const end = source.indexOf('export async function findStaffInviteBinding', start)
    const reusable = source.slice(start, end)

    expect(reusable).toContain("data.status !== 'active'")
    expect(reusable).toContain('service.auth.admin.getUserById(data.id)')
    expect(reusable).toContain('banned_until')
    expect(reusable).toContain('deleted_at')
    expect(reusable).toContain('reusable: false')
  })
})
