import { expect, test } from '@playwright/test'
import { BOOKING_HOST, SEED, gotoTenant, loginBackoffice, loginCustomer } from './helpers'

// @readonly — reads the deterministic customer, visit, favorite and staff-only
// client-card rows owned by supabase/seeds/e2e-seed.sql.
test.describe('@readonly customer relationship', () => {
  test('customer sees completed history and favorite but never staff-only notes', async ({
    page,
  }) => {
    await loginCustomer(page, SEED.customer.email)
    await gotoTenant(page, '/konto')

    await expect(page.getByText('Tidigare besök', { exact: true })).toBeVisible()
    await expect(
      page.getByText(SEED.relationship.serviceLabel, { exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByText(SEED.relationship.staffLabel, { exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByText('Din sparade personal · ni har setts 2 gånger')).toBeVisible()
    await expect(page.getByText(SEED.relationship.internalNote, { exact: true })).toHaveCount(0)
    await expect(page.getByText(SEED.relationship.preferenceLabel, { exact: true })).toHaveCount(0)
  })

  test('staff opens the same customer card by touch and sees internal memory', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 844 },
      locale: 'sv-SE',
      timezoneId: 'Europe/Stockholm',
    })
    const page = await context.newPage()
    await loginBackoffice(page, SEED.staff)
    await page.goto(`${BOOKING_HOST}/personal`)

    let bookingFound = false
    for (let day = 0; day < 10; day += 1) {
      const booking = page.locator('button').filter({ hasText: SEED.customer.label }).first()
      if (await booking.isVisible().catch(() => false)) {
        await booking.tap()
        bookingFound = true
        break
      }
      await page.getByRole('link', { name: 'Nästa dag' }).click()
    }
    expect(bookingFound, 'Den seedade kundbokningen saknas i personalens kommande dagar.').toBe(
      true,
    )

    const bookingDialog = page.getByRole('dialog', { name: 'Bokning' })
    await expect(bookingDialog).toBeVisible()
    await bookingDialog.getByRole('button', { name: SEED.customer.label, exact: true }).tap()

    const clientCard = page.getByRole('dialog', { name: 'Klientkort' })
    await expect(clientCard).toBeVisible()
    await expect(
      clientCard.getByText(SEED.relationship.preferenceLabel, { exact: true }).first(),
    ).toBeVisible()
    await expect(clientCard.getByLabel('Intern notering')).toHaveValue(
      SEED.relationship.internalNote,
    )
    await context.close()
  })
})
