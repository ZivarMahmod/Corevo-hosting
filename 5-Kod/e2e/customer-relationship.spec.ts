import { expect, test } from '@playwright/test'
import { BOOKING_HOST, SEED, gotoTenant, loginBackoffice, loginCustomer } from './helpers'

// @readonly — requires the deterministic relationship fixture described in
// e2e/README.md. It never changes the customer, booking or note rows.
const fixture = {
  email: process.env.E2E_RELATIONSHIP_CUSTOMER_EMAIL,
  customerLabel: process.env.E2E_RELATIONSHIP_CUSTOMER_LABEL,
  service: process.env.E2E_RELATIONSHIP_SERVICE,
  staff: process.env.E2E_RELATIONSHIP_STAFF,
  preference: process.env.E2E_RELATIONSHIP_PREFERENCE,
  internalNote: process.env.E2E_RELATIONSHIP_INTERNAL_NOTE,
}

const ready = Object.values(fixture).every(Boolean)

test.describe('@readonly customer relationship', () => {
  test.skip(!ready, 'Deterministisk tvåbesöks-/claim-fixtur saknas; se e2e/README.md.')

  test('claimed guest sees completed history and relationship but never internal notes', async ({
    page,
  }) => {
    await loginCustomer(page, fixture.email!, SEED.tenant.slug)
    await gotoTenant(page, '/konto', SEED.tenant.slug)

    await expect(page.getByText(fixture.service!, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(fixture.staff!, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(fixture.internalNote!, { exact: true })).toHaveCount(0)
    await expect(page.getByText(fixture.preference!, { exact: true })).toHaveCount(0)
  })

  test('staff opens the same customer card by touch and sees the internal memory', async ({
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

    const customer = page.getByRole('button', { name: fixture.customerLabel!, exact: true }).first()
    await customer.tap()
    await expect(page.getByRole('dialog', { name: 'Klientkort' })).toBeVisible()
    await expect(page.getByText(fixture.preference!, { exact: true }).first()).toBeVisible()
    await expect(page.getByDisplayValue(fixture.internalNote!)).toBeVisible()
    await context.close()
  })
})
