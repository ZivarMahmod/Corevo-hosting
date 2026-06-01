import { test, expect } from '@playwright/test'
import { gotoTenant, login, pickFirstAvailableSlot, SEED } from './helpers'

// @mutating — writes a booking row. RUN AGAINST SEEDED STAGING ONLY.
// frisor1 seed is payment_mode=on_site (payments_enabled=false) ⇒ no Stripe leg;
// the wizard lands straight on the confirmation page. The Stripe-test-card path
// (requiresPayment=true) is exercised in the manual runbook checklist, since it
// needs a connected account + Stripe CLI webhook forwarding.

test.describe('@mutating booking end-to-end', () => {
  test('guest books a service and reaches the confirmation page', async ({ page }) => {
    await gotoTenant(page, '/boka', SEED.tenant.slug)

    // Step 1 — service
    await page.getByRole('button', { name: /Klippning/ }).first().click()
    // Step 2 — any staff
    await page.getByRole('button', { name: 'Alla' }).click()
    // Step 3 — first bookable day + time
    await pickFirstAvailableSlot(page)
    // Step 4 — guest details
    await page.getByLabel('Namn').fill('E2E Gäst')
    await page.getByLabel('E-post').fill('e2e-guest@example.com')
    await page.getByLabel('Telefon').fill('0700000000')
    await page.getByRole('button', { name: 'Bekräfta bokning' }).click()

    await expect(page).toHaveURL(/\/boka\/bekraftelse\/[0-9a-f-]+/)
  })

  test('logged-in customer keeps their session through the booking flow', async ({ page }) => {
    await login(page, SEED.salonAdmin) // any seeded account proves the auth path
    await gotoTenant(page, '/boka', SEED.tenant.slug)
    await page.getByRole('button', { name: /Klippning/ }).first().click()
    await page.getByRole('button', { name: 'Alla' }).click()
    await pickFirstAvailableSlot(page)
    await page.getByLabel('Namn').fill('E2E Inloggad')
    await page.getByLabel('E-post').fill('e2e-loggedin@example.com')
    await page.getByLabel('Telefon').fill('0700000001')
    await page.getByRole('button', { name: 'Bekräfta bokning' }).click()
    await expect(page).toHaveURL(/\/boka\/bekraftelse\/[0-9a-f-]+/)
  })
})
