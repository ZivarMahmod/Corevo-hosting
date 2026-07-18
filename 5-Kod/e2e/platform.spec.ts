import { test, expect } from '@playwright/test'
import { loginBackoffice, BOOKING_HOST, SEED } from './helpers'

// @mutating — platform_admin provisions a new tenant from the back-office at the
// clean URL (booking.<root>/kunder/ny, G12). RUN AGAINST SEEDED STAGING ONLY
// (creates a tenants row). Unique slug per run → re-runnable.

test.describe('@mutating platform_admin creates tenant', () => {
  test('creates a new salong from the platform console', async ({ page }) => {
    const n = Date.now().toString().slice(-6)
    const slug = `e2e${n}`
    await loginBackoffice(page, SEED.platformAdmin)
    await page.goto(`${BOOKING_HOST}/kunder/ny`)

    await page.getByLabel('Salongsnamn').fill(`E2E Salong ${n}`)
    await page.getByLabel('Subdomän').fill(slug)
    await page.getByRole('button', { name: 'Skapa salong' }).click()

    await expect(page.getByRole('status')).toBeVisible({ timeout: 10000 })

    await page.goto(`${BOOKING_HOST}/kunder`)
    await expect(page.getByText(slug)).toBeVisible()
  })
})
