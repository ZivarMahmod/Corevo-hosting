import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('atomic staff invite loser cleanup', () => {
  it('locks the exact profile and refuses cleanup after any staff binding won', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase/migrations/0098_staff_invite_cleanup.sql'),
      'utf8',
    )
    expect(sql).toContain('for update')
    expect(sql).toContain('s.profile_id = p_auth_user')
    expect(sql).toContain("return 'staff_linked'")
    expect(sql).toContain('create unique index')
    expect(sql).toContain('on public.staff (profile_id)')
    expect(sql).toContain('where profile_id is not null')
    expect(sql).toContain('u.tenant_id = p_tenant')
    expect(sql).toContain('u.role_id = p_role')
    expect(sql).toContain('delete from public.users')
    expect(sql).toContain('grant execute on function public.prepare_staff_invite_cleanup')
    expect(sql).toContain('create or replace function public.contain_staff_invite_profile')
    expect(sql).toContain("set status = 'manual_cleanup'")
    expect(sql).toContain('grant execute on function public.contain_staff_invite_profile')
    expect(sql).toContain('to service_role')
    expect(sql).not.toContain('auth.role()')
  })
})
