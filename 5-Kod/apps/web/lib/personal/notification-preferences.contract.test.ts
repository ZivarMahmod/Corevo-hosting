import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('personal notification preferences', () => {
  it('stores own preferences through a tenant-bound RPC', () => {
    const sql = read('supabase/migrations/0081_tenant_member_permissions.sql').toLowerCase()
    const action = read('apps/web/lib/personal/notification-preference-actions.ts')
    expect(sql).toContain('notify_new_booking')
    expect(sql).toContain('create or replace function public.set_my_notification_preferences')
    expect(sql).toContain('s.profile_id = (select auth.uid())')
    expect(action).toContain("requirePortal('personal')")
    expect(action).toContain("rpc('set_my_notification_preferences'")
  })

  it('renders exactly the three canonical profile switches', () => {
    const component = read('apps/web/components/personal/NotificationPreferences.tsx')
    const labels = [...component.matchAll(/\['(notify_[a-z_]+)',\s*'([^']+)'/g)].map((match) => [
      match[1],
      match[2],
    ])
    expect(labels).toEqual([
      ['notify_new_booking', 'Ny bokning'],
      ['notify_booking_changes', 'Ändrad eller avbokad'],
      ['notify_daily_reminder', 'Dagens schema'],
    ])
  })

  it('surfaces database read errors instead of pretending defaults were loaded', () => {
    const reader = read('apps/web/lib/personal/notification-preferences.ts')
    expect(reader).toContain('const { data, error } = await supabase')
    expect(reader).toContain("if (error) throw new Error('Kunde inte läsa notisinställningarna.')")
  })
})
