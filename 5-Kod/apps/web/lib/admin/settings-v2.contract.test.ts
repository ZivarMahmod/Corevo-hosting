import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../..')
const repoRoot = resolve(webRoot, '../..')
const readWeb = (path: string) => readFileSync(resolve(webRoot, path), 'utf8')
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

describe('Inställningar v2 design- och säkerhetskontrakt', () => {
  it('renderar paketets exakta desktop- och mobilskal', () => {
    const component = readWeb('components/admin/SettingsV2.tsx')
    const css = readWeb('components/admin/settings-v2.module.css')

    expect(css).toContain('grid-template-columns: 308px minmax(0, 1fr)')
    expect(css).toContain('max-width: 760px')
    expect(css).toContain('--settings-bg: #121210')
    expect(css).toContain('--settings-surface: #1c1c18')
    expect(css).toContain('--settings-line: #33332c')
    expect(component).toContain('Tillbaka till inställningar')
    expect(component).toContain('Sök — öppettider, pris, behörighet…')
  })

  it('har paketets grupper, söksynonymer och varnings-only-status', () => {
    const map = readWeb('lib/admin/settings-map.ts')

    for (const group of ['VERKSAMHET', 'BOKNING', 'PENGAR', 'KOMMUNIKATION', 'KONTO']) {
      expect(map).toContain(`'${group}'`)
    }
    for (const synonym of ['öppettider', 'semester', 'lösenord', 'behörighet', 'recension']) {
      expect(map.toLowerCase()).toContain(synonym)
    }
    expect(map).toContain("warning?: 'warning' | 'danger'")
    expect(map).not.toContain("warning?: 'success'")
  })

  it('lagrar individuella personalrättigheter tenantbundet och fail-closed', () => {
    const sql = readRepo('supabase/migrations/0081_tenant_member_permissions.sql').toLowerCase()

    expect(sql).toContain('create table if not exists public.tenant_member_permissions')
    expect(sql).toContain('tenant_id uuid not null')
    expect(sql).toContain('staff_id uuid not null')
    expect(sql).toContain('unique (tenant_id, staff_id)')
    expect(sql).toContain('private.tenant_id()')
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain("security definer\nset search_path = ''")
    expect(sql).toContain('revoke all on function private.has_admin_area_permission(text) from public')
    expect(sql).toContain('revoke all on table public.tenant_member_permissions from anon')
    expect(sql).toContain('grant select on table public.tenant_member_permissions to authenticated')
  })

  it('kopplar sidan till central behörighets-DAL och befintliga äganderoutes', () => {
    const session = readWeb('lib/auth/session.ts')
    const page = readWeb('app/(admin)/admin/installningar/page.tsx')
    const map = readWeb('lib/admin/settings-map.ts')

    expect(session).toContain('hasAdminAreaPermission')
    expect(page).toContain('<SettingsV2')
    for (const route of [
      '/admin/tjanster',
      '/admin/personal',
      '/admin/scheman',
      '/admin/platser',
      '/admin/installningar/bokning',
      '/admin/sida',
      '/admin/installningar/betalning',
      '/admin/installningar/konto',
    ]) {
      expect(map).toContain(route)
    }
  })
})
