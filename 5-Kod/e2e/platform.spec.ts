import { test, expect } from '@playwright/test'
import { gotoTenant, login, SEED } from './helpers'

// @mutating — platform_admin provisions a new tenant. RUN AGAINST SEEDED STAGING
// ONLY (it creates a tenants row). Uses a unique slug per run so it's re-runnable.

test.describe('@mutating platform_admin creates tenant', () => {
  test('creates a new salong from the platform console', async ({ page }) => {
    const n = Date.now().toString().slice(-6)
    const slug = `e2e${n}`
    await login(page, SEED.platformAdmin)
    await gotoTenant(page, '/platform/tenants/ny', SEED.tenant.slug)

    await page.getByLabel('Salongsnamn').fill(`E2E Salong ${n}`)
    await page.getByLabel('Subdomän').fill(slug)
    await page.getByRole('button', { name: 'Skapa salong' }).click()

    // Success status, or it shows up in the tenants list.
    const ok = page.getByRole('status')
    await expect(ok).toBeVisible({ timeout: 10000 })

    await gotoTenant(page, '/platform/tenants', SEED.tenant.slug)
    await expect(page.getByText(slug)).toBeVisible()
  })
})
