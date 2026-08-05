import { expect, test } from '@playwright/test'

const baseUrl = process.env.ACCEPT_BASE_URL
const email = process.env.ACCEPT_ADMIN_EMAIL
const password = process.env.ACCEPT_ADMIN_PASSWORD
const canRunBrowser = Boolean(baseUrl && email && password)

test.describe('04 Inställningar v2 — browser oracle @readonly @browser', () => {
  test.skip(!canRunBrowser, 'ACCEPT_BASE_URL, ACCEPT_ADMIN_EMAIL och ACCEPT_ADMIN_PASSWORD krävs')

  test('04-B01 desktop and mobile shell match the package', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel('E-post').fill(email!)
    await page.getByLabel('Lösenord').fill(password!)
    await page.getByRole('button', { name: 'Logga in' }).click()
    await page.goto(`${baseUrl}/admin/installningar`)

    const nav = page.locator('[data-accept="settings-nav"]')
    const pane = page.locator('[data-accept="settings-pane"]')
    expect((await nav.boundingBox())?.width).toBeCloseTo(308, 0)
    expect((await pane.locator('> div').boundingBox())?.width).toBeLessThanOrEqual(832)
    await expect(page.getByText('VERKSAMHET')).toBeVisible()
    await expect(page.getByRole('button', { name: /Roller & behörigheter/ })).toBeVisible()

    await page.locator('[data-accept="settings-search"] input').fill('semester')
    await expect(page.getByRole('button', { name: /Scheman & frånvaro/ })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('[data-accept="settings-search"] input').fill('')
    await page.getByRole('button', { name: /Bokningsregler/ }).click()
    await expect(page.getByRole('link', { name: /Tillbaka till inställningar/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
