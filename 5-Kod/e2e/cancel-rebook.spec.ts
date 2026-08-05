import { expect, test } from '@playwright/test'
import { gotoTenant, loginCustomer, SEED } from './helpers'

// @mutating — exercises the real customer self-service rebook + cancel owners
// against the active booking in supabase/seeds/e2e-seed.sql.
test.describe('@mutating cancel & rebook', () => {
  test('customer can rebook then cancel an active booking', async ({ page }) => {
    await loginCustomer(page, SEED.customer.email)
    await gotoTenant(page, `/konto/bokningar/${SEED.customer.activeBookingId}`)

    await expect(page.getByRole('heading', { name: SEED.relationship.serviceLabel })).toBeVisible()
    await page.getByRole('button', { name: 'Omboka', exact: true }).click()

    const dayButtons = page
      .getByText('Välj ny dag', { exact: true })
      .locator('xpath=following-sibling::div[1]//button')
    expect(await dayButtons.count(), 'Ombokningsväljaren saknar dagar.').toBeGreaterThan(0)

    let slotSelected = false
    for (let day = 0; day < (await dayButtons.count()); day += 1) {
      await dayButtons.nth(day).click()
      const timeLabel = page.getByText('Välj ny tid', { exact: true })
      await Promise.race([
        timeLabel.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined),
        page
          .getByText('Inga lediga tider den dagen. Välj en annan dag.', { exact: true })
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => undefined),
      ])
      const times = timeLabel.locator('xpath=following-sibling::div[1]//button')
      if ((await times.count()) > 0) {
        await times.first().click()
        slotSelected = true
        break
      }
    }
    expect(slotSelected, 'Den seedade tjänsten saknar ombokningsbar tid inom 14 dagar.').toBe(true)

    await page.getByRole('button', { name: 'Bekräfta ny tid' }).click()
    await expect(page).toHaveURL(
      (url) =>
        /^\/konto\/bokningar\/[0-9a-f-]{36}$/.test(url.pathname) &&
        !url.pathname.endsWith(SEED.customer.activeBookingId),
      { timeout: 30_000 },
    )

    await page.getByRole('button', { name: 'Avboka', exact: true }).click()
    await page.getByRole('button', { name: 'Säker? Avboka', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/konto', { timeout: 30_000 })
    await expect(page.getByText('Du har inga kommande tider.', { exact: true })).toBeVisible()
  })
})
