import { expect, test } from '@playwright/test'

test.describe('06 Frisöradmin PWA — browser @readonly @browser', () => {
  test('renders the mobile calendar and profile navigation', async ({ page }) => {
    test.skip(
      !process.env.ACCEPT_BASE_URL ||
        !process.env.ACCEPT_STAFF_EMAIL ||
        !process.env.ACCEPT_STAFF_PASSWORD,
    )
    await page.goto(`${process.env.ACCEPT_BASE_URL}/login`)
    await page.getByLabel(/e-post/i).fill(process.env.ACCEPT_STAFF_EMAIL!)
    await page.getByLabel(/lösenord/i).fill(process.env.ACCEPT_STAFF_PASSWORD!)
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).toHaveURL(/\/personal/)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('[data-world="backoffice"][data-portal="personal"]')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Mobilnavigering' }).getByRole('link'),
    ).toHaveCount(2)
  })
})
