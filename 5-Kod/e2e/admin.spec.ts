import { test, expect } from '@playwright/test'
import { gotoTenant, loginBackoffice, BOOKING_HOST, SEED } from './helpers'

// @mutating — salon_admin (back-office on booking.<root>, G12) edits a service +
// branding; the change surfaces on the public storefront (tenant host). RUN
// AGAINST SEEDED STAGING ONLY.

test.describe('@mutating salon_admin → public', () => {
  test('admin adds a service and it appears on the public booking page', async ({ page }) => {
    const unique = `E2E Tjänst ${Date.now().toString().slice(-6)}`
    await loginBackoffice(page, SEED.salonAdmin)
    await page.goto(`${BOOKING_HOST}/admin/tjanster`)

    await page.locator('form').first().getByLabel('Namn').fill(unique)
    await page.locator('form').first().getByLabel('Varaktighet (min)').fill('30')
    await page.locator('form').first().getByLabel('Pris (kr)').fill('250')
    await page.getByRole('button', { name: 'Lägg till tjänst' }).click()
    await expect(page.getByText(unique)).toBeVisible()

    // Public storefront (tenant host) reflects it (revalidated on the tenant tag).
    await gotoTenant(page, '/boka', SEED.tenant.slug)
    await expect(page.getByText(unique)).toBeVisible({ timeout: 15000 })
  })

  test('admin can open the branding form', async ({ page }) => {
    await loginBackoffice(page, SEED.salonAdmin)
    await page.goto(`${BOOKING_HOST}/admin/varumarke`)
    await expect(page.getByRole('button', { name: 'Spara varumärke' })).toBeVisible()
    await page.getByLabel('Typsnitt (CSS font-family)').fill('Inter, system-ui, sans-serif')
    await page.getByRole('button', { name: 'Spara varumärke' }).click()
    await expect(page.getByRole('status')).toBeVisible()
  })
})
