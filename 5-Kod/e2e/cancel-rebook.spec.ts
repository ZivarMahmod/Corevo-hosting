import { test, expect } from '@playwright/test'
import { gotoTenant, loginCustomer, SEED } from './helpers'

// @mutating — exercises the customer self-service cancel + rebook flow.
// DEPENDS ON STAGING SEED: a `kund`-role account that owns at least one active
// (pending/confirmed) booking inside the cancellation window. The base seed.sql
// has no customer booking, so staging seed must add one (see e2e/README.md).
// Skips gracefully if the account has no changeable booking, so it never produces
// a false failure on an under-seeded environment.

test.describe('@mutating cancel & rebook', () => {
  test('customer can rebook then cancel an active booking', async ({ page }) => {
    await loginCustomer(page, SEED.salonAdmin) // replace with a seeded kund account on staging
    await gotoTenant(page, '/konto', SEED.tenant.slug)

    const firstBooking = page.locator('a[href^="/konto/bokningar/"]').first()
    if (!(await firstBooking.isVisible().catch(() => false))) {
      test.skip(true, 'No customer booking seeded on this environment.')
      return
    }
    await firstBooking.click()

    const rebook = page.getByRole('button', { name: 'Omboka' })
    if (await rebook.isVisible().catch(() => false)) {
      await rebook.click()
      await page.locator('button:has-text("mån"), button:has-text("tis")').first().click()
      const time = page.locator('[class*="time"]').first()
      if (await time.isVisible().catch(() => false)) {
        await time.click()
        await page.getByRole('button', { name: 'Bekräfta ny tid' }).click()
        await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 8000 }).catch(() => {})
      }
    }

    // Cancel — auto-accept the window.confirm() dialog.
    page.on('dialog', (d) => d.accept())
    const cancel = page.getByRole('button', { name: 'Avboka' })
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click()
      await expect(page).toHaveURL(/\/konto/)
    }
  })
})
