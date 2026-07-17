import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repo = path.resolve(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(path.join(repo, relativePath), 'utf8')

test.describe('04 Inställningar v2 — source contract @readonly @contract', () => {
  test('04-C01 canonical geometry and dark tokens', () => {
    const css = read('apps/web/components/admin/settings-v2.module.css')
    expect(css).toMatch(/grid-template-columns:\s*308px\s+minmax\(0,\s*1fr\)/)
    expect(css).toMatch(/max-width:\s*760px/)
    expect(css).toMatch(/--settings-bg:\s*#121210/i)
    expect(css).toMatch(/--settings-surface:\s*#1c1c18/i)
    expect(css).toMatch(/--settings-surface-2:\s*#25251f/i)
    expect(css).toMatch(/--settings-line:\s*#33332c/i)
    expect(css).toMatch(/--settings-ink:\s*#f0f0ea/i)
  })

  test('04-C02 complete grouped map, search and honest warnings', () => {
    const map = read('apps/web/lib/admin/settings-map.ts')
    const component = read('apps/web/components/admin/SettingsV2.tsx')
    for (const group of ['VERKSAMHET', 'BOKNING', 'PENGAR', 'KOMMUNIKATION', 'KONTO']) {
      expect(map).toContain(`'${group}'`)
    }
    expect(map.match(/id:\s*'/g)).toHaveLength(12)
    expect(component).toContain('status.tone === \'warning\' || status.tone === \'danger\'')
    expect(component).toContain('Sök — öppettider, pris, behörighet…')
    expect(component).toContain('Tillbaka till inställningar')
  })

  test('04-C03 one owner route per setting and no duplicate writes', () => {
    const map = read('apps/web/lib/admin/settings-map.ts')
    for (const route of ['/admin/tjanster', '/admin/personal', '/admin/scheman', '/admin/platser', '/admin/installningar/bokning', '/admin/sida', '/admin/installningar/betalning', '/admin/installningar/konto']) {
      expect(map).toContain(route)
    }
    expect(read('apps/web/components/admin/SettingsV2.tsx')).toContain('Ändra på ytans enda ägande sida.')
  })

  test('04-C04 member permissions are tenant-bound and server enforced', () => {
    const sql = read('supabase/migrations/0081_tenant_member_permissions.sql').toLowerCase()
    const action = read('apps/web/lib/admin/member-permission-actions.ts')
    expect(sql).toContain('unique (tenant_id, staff_id)')
    expect(sql).toContain('private.tenant_id()')
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain("security definer\nset search_path = ''")
    expect(sql).toContain('revoke insert, update, delete on table public.tenant_member_permissions from authenticated')
    expect(sql).toContain('tenant.member_permissions_save')
    expect(action).toContain("requireAdminArea('installningar')")
    expect(action).toContain("rpc('set_tenant_member_permissions'")
  })
})

const baseUrl = process.env.ACCEPT_BASE_URL
const email = process.env.ACCEPT_ADMIN_EMAIL
const password = process.env.ACCEPT_ADMIN_PASSWORD
const canRunBrowser = Boolean(baseUrl && email && password)

test.describe('04 Inställningar v2 — browser oracle @readonly @browser', () => {
  test.skip(!canRunBrowser, 'ACCEPT_BASE_URL, ACCEPT_ADMIN_EMAIL och ACCEPT_ADMIN_PASSWORD krävs')

  test('04-B01 desktop and mobile shell match the package', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel('E-post').fill(email!)
    await page.getByLabel('Lösenord').fill(password!)
    await page.getByRole('button', { name: 'Logga in' }).click()
    await page.goto(`${baseUrl}/admin/installningar`)

    const nav = page.locator('[data-accept="settings-nav"]')
    const pane = page.locator('[data-accept="settings-pane"]')
    expect((await nav.boundingBox())?.width).toBeCloseTo(308, 0)
    expect((await pane.locator('> div').boundingBox())?.width).toBeLessThanOrEqual(832)
    await expect(page.getByText('VERKSAMHET')).toBeVisible()
    await expect(page.getByRole('button', { name: /Roller & behörigheter/ })).toBeVisible()

    await page.locator('[data-accept="settings-search"] input').fill('semester')
    await expect(page.getByRole('button', { name: /Scheman & frånvaro/ })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('[data-accept="settings-search"] input').fill('')
    await page.getByRole('button', { name: /Bokningsregler/ }).click()
    await expect(page.getByRole('button', { name: /Tillbaka till inställningar/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
