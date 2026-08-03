import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../..')
const repoRoot = resolve(webRoot, '../..')
const normalizedFile = (path: string) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
const readWeb = (path: string) => normalizedFile(resolve(webRoot, path))
const readRepo = (path: string) => normalizedFile(resolve(repoRoot, path))

describe('Inställningar v2 design- och säkerhetskontrakt', () => {
  it('renderar paketets exakta desktop- och mobilskal', () => {
    const component = readWeb('components/admin/SettingsV2.tsx')
    const css = readWeb('components/admin/settings-v2.module.css')
    const loading = readWeb('components/admin/SettingsWorkspaceLoading.tsx')
    const errorBoundary = readWeb('app/(admin)/error.tsx')

    expect(css).toContain('grid-template-columns: 308px minmax(0, 1fr)')
    expect(css).toContain('max-width: 760px')
    expect(css).toContain('--settings-bg: var(--c-cream)')
    expect(css).toContain('--settings-surface: var(--c-paper)')
    expect(css).toContain('--settings-line: var(--c-line)')
    expect(css).toContain('--settings-ink: var(--c-ink)')
    expect(component).toContain('Tillbaka till inställningar')
    expect(component).toContain('Sök — öppettider, pris, behörighet…')
    expect(component).toContain('settingsSearchEntries(categories)')
    expect(component).toContain('const mobilePaneOpen = selectedFromUrl !== null')
    expect(component).toContain("router.replace('/admin/installningar'")
    expect(loading).toContain('settings-loading')
    expect(errorBoundary).not.toContain('Kalendern kunde inte laddas')
  })

  it('håller fristående inställningssidor inom mobilens viewport och ovanför bottennavet', () => {
    const css = readWeb('components/admin/settings-v2.module.css')
    const services = readWeb('components/admin/ServicesManager.tsx')
    const customer = readWeb('components/admin/CreateCustomerForm.tsx')

    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?margin:\s*-20px -14px 0;/)
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?padding:\s*18px 14px calc\(132px \+ env\(safe-area-inset-bottom\)\);/,
    )
    expect(services).toContain('.services-2col > * { min-width: 0; }')
    expect(services).toContain('.services-site-map { position: static !important; }')
    expect(customer).not.toContain('var(--c-bg, #fff)')
    expect(customer).toContain("background: 'var(--c-paper-2)'")
    expect(customer).toContain("color: 'var(--c-ink)'")
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
    expect(sql).toContain(
      'revoke all on function private.has_admin_area_permission(text) from public',
    )
    expect(sql).toContain('revoke all on table public.tenant_member_permissions from anon')
    expect(sql).toContain('grant select on table public.tenant_member_permissions to authenticated')
  })

  it('kopplar sidan till central behörighets-DAL och befintliga äganderoutes', () => {
    const component = readWeb('components/admin/SettingsV2.tsx')
    const session = readWeb('lib/auth/session.ts')
    const page = readWeb('app/(admin)/admin/installningar/page.tsx')
    const map = readWeb('lib/admin/settings-map.ts')

    expect(session).toContain('hasAdminAreaPermission')
    expect(component).toContain("category.id !== 'roller'")
    expect(component).toContain('router.push(category.href)')
    expect(page).toContain('<SettingsV2')
    expect(page).toContain('redirect(category.href)')
    expect(page).toContain("requested === 'roller'")
    expect(page).toContain("requested === 'roller'\n      ? listTenantMemberPermissions(tenant.id)")
    expect(page).toContain("requireOrganizationOwner('installningar')")
    expect(page).not.toContain("if (!requested) redirect('/admin/tjanster')")
    expect(page).toContain("initialCategory={requested ?? 'tjanster'}")
    for (const route of [
      '/admin/tjanster',
      '/admin/personal',
      '/admin/scheman',
      '/admin/platser',
      '/admin/installningar/bokning',
      '/admin/installningar/bokningsflode',
      '/admin/installningar/betalning',
      '/admin/installningar/konto',
    ]) {
      expect(map).toContain(route)
    }
    expect(map).not.toContain("href: '/admin/sida?flik=bokning'")
  })

  it('håller de verkliga ägandeytorna i samma vertikala inställningsskal', () => {
    const workspace = readWeb('components/admin/SettingsWorkspace.tsx')
    expect(workspace).toContain('SettingsNavigation')
    expect(workspace).toContain('Tillbaka till inställningar')

    const owners = {
      'app/(admin)/admin/tjanster/page.tsx': 'tjanster',
      'app/(admin)/admin/personal/page.tsx': 'personal',
      'app/(admin)/admin/scheman/page.tsx': 'scheman',
      'app/(admin)/admin/platser/page.tsx': 'platser',
      'app/(admin)/admin/installningar/bokning/page.tsx': 'bokningsregler',
      'app/(admin)/admin/installningar/bokningsflode/page.tsx': 'bokningsflode',
      'app/(admin)/admin/installningar/betalning/page.tsx': 'betalning',
      'app/(admin)/admin/installningar/paminnelser/page.tsx': 'paminnelser',
      'app/(admin)/admin/installningar/integrationer/page.tsx': 'integrationer',
      'app/(admin)/admin/installningar/konto/page.tsx': 'konto',
      'app/(admin)/admin/installningar/sekretess/page.tsx': 'sekretess',
    } as const

    for (const [path, category] of Object.entries(owners)) {
      const page = readWeb(path)
      expect(page).toContain('<SettingsWorkspace')
      expect(page).toContain(`currentCategory="${category}"`)
      expect(page).not.toContain('Alla inställningar')
    }

    const legacyCompany = readWeb('app/(admin)/admin/installningar/foretag/page.tsx')
    expect(legacyCompany).toContain("redirect('/admin/installningar/paminnelser')")

    const bookingFlow = readWeb('app/(admin)/admin/installningar/bokningsflode/page.tsx')
    expect(bookingFlow).toContain('href="/admin/sida?flik=bokning"')
  })

  it('behåller inställningsskalet i laddningslägen för alla fristående ägandeytor', () => {
    for (const path of [
      'app/(admin)/admin/installningar/loading.tsx',
      'app/(admin)/admin/tjanster/loading.tsx',
      'app/(admin)/admin/personal/loading.tsx',
      'app/(admin)/admin/scheman/loading.tsx',
      'app/(admin)/admin/platser/loading.tsx',
    ]) {
      expect(readWeb(path)).toContain('SettingsWorkspaceLoading')
    }
  })

  it('behåller inställningsskalet i fel- och saknar-företag-lägen', () => {
    expect(readWeb('components/admin/SettingsRouteError.tsx')).toContain('<SettingsWorkspace')
    for (const path of [
      'app/(admin)/admin/installningar/error.tsx',
      'app/(admin)/admin/tjanster/error.tsx',
      'app/(admin)/admin/personal/error.tsx',
      'app/(admin)/admin/scheman/error.tsx',
      'app/(admin)/admin/platser/error.tsx',
    ]) {
      expect(readWeb(path)).toContain('SettingsRouteError')
    }
    for (const path of [
      'app/(admin)/admin/tjanster/page.tsx',
      'app/(admin)/admin/personal/page.tsx',
      'app/(admin)/admin/scheman/page.tsx',
      'app/(admin)/admin/platser/page.tsx',
      'app/(admin)/admin/installningar/bokning/page.tsx',
      'app/(admin)/admin/installningar/betalning/page.tsx',
      'app/(admin)/admin/installningar/paminnelser/page.tsx',
      'app/(admin)/admin/installningar/integrationer/page.tsx',
      'app/(admin)/admin/installningar/konto/page.tsx',
      'app/(admin)/admin/installningar/sekretess/page.tsx',
    ]) {
      expect(readWeb(path)).toContain('<SettingsWorkspaceEmpty')
    }
  })
})
