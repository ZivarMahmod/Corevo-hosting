import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('personal notification preferences', () => {
  it('stores own preferences through a tenant-bound RPC', () => {
    const sql = read('supabase/migrations/0081_tenant_member_permissions.sql').toLowerCase()
    expect(sql).toContain('notify_new_booking')
    expect(sql).toContain('create or replace function public.set_my_notification_preferences')
    expect(sql).toContain('s.profile_id = (select auth.uid())')
  })
})
