import { test, expect } from '@playwright/test'
import { gotoTenant, login, SEED } from './helpers'

// @mutating — salon_admin edits a service + branding, and the change surfaces on
// the public site. RUN AGAINST SEEDED STAGING ONLY.

test.describe('@mutating salon_admin → public', () => {
  test('admin adds a service and it appears on the public booking page', async ({ page }) => {
    const unique = `E2E Tjänst ${Date.now().toString().slice(-6)}`
    await login(page, SEED.salonAdmin)
    await gotoTenant(page, '/admin/tjanster', SEED.tenant.slug)

    await page.getByRole('button', { name: 'Lägg till tjänst' }).scrollIntoViewIfNeeded()
    await page.locator('form').first().getByLabel('Namn').fill(unique)
    await page.locator('form').first().getByLabel('Varaktighet (min)').fill('30')
    await page.locator('form').first().getByLabel('Pris (kr)').fill('250')
    await page.getByRole('button', { name: 'Lägg till tjänst' }).click()
    await expect(page.getByText(unique)).toBeVisible()

    // Public side reflects it (services revalidate on the tenant tag).
    await gotoTenant(page, '/boka', SEED.tenant.slug)
    await expect(page.getByText(unique)).toBeVisible({ timeout: 15000 })
  })

  test('admin can open the branding form', async ({ page }) => {
    await login(page, SEED.salonAdmin)
    await gotoTenant(page, '/admin/varumarke', SEED.tenant.slug)
    await expect(page.getByRole('button', { name: 'Spara varumärke' })).toBeVisible()
    await page.getByLabel('Typsnitt (CSS font-family)').fill('Inter, system-ui, sans-serif')
    await page.getByRole('button', { name: 'Spara varumärke' }).click()
    await expect(page.getByRole('status')).toBeVisible()
  })
})
