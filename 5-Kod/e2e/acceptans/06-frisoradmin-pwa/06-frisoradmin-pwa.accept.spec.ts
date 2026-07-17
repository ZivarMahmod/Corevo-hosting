import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

test.describe('06 Frisöradmin PWA — source contract @readonly @contract', () => {
  test('06-C01 canonical shell, tokens and bottom navigation', () => {
    const shell = read('apps/web/components/personal/PersonalPwaShell.tsx')
    const css = read('apps/web/components/personal/personal-pwa.module.css')
    expect(shell.match(/<Link href=/g)).toHaveLength(2)
    expect(shell).toContain('data-accept="personal-pwa"')
    for (const token of ['#121210', '#1c1c18', '#25251f', '#2e2e28', '#f0f0ea', '#c8c8bd', '#96968c', '#2f5f47', '#9ac4a5']) expect(css).toContain(token)
  })

  test('06-C02 real calendar and tenant permission coupling', () => {
    const page = read('apps/web/app/(personal)/personal/page.tsx')
    expect(page).toContain('getMemberPermissions({ tenantId: user.tenantId, staffId: user.staffId })')
    expect(page).toContain('getStaffScheduleWithNotes([selectedStaffId], fromUtc, toUtc)')
    expect(page).toContain('allowedIds.has(requestedStaff)')
  })

  test('06-C03 booking primary door and minbooking legacy door coexist', () => {
    const roles = read('apps/web/lib/auth/roles.ts')
    const routing = read('apps/web/lib/auth/host-routing.ts')
    const auth = read('apps/web/app/(auth)/actions.ts')
    expect(roles).toContain("return '/personal'")
    expect(routing).toContain("case 'staff_portal':")
    expect(routing).toContain("if (isPrefix(path, STAFF_GROUP)) return { action: 'pass' }")
    expect(auth).toContain('staffOnLegacyDoor')
  })
})

test.describe('06 Frisöradmin PWA — browser @readonly @browser', () => {
  test('renders the mobile calendar and profile navigation', async ({ page }) => {
    test.skip(!process.env.ACCEPT_BASE_URL || !process.env.ACCEPT_STAFF_EMAIL || !process.env.ACCEPT_STAFF_PASSWORD)
    await page.goto(`${process.env.ACCEPT_BASE_URL}/login`)
    await page.getByLabel(/e-post/i).fill(process.env.ACCEPT_STAFF_EMAIL!)
    await page.getByLabel(/lösenord/i).fill(process.env.ACCEPT_STAFF_PASSWORD!)
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/personal/)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('[data-accept="personal-pwa"]')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Personal' }).getByRole('link')).toHaveCount(2)
  })
})
