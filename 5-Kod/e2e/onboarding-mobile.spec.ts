import { expect, test, type Page } from '@playwright/test'
import { BOOKING_HOST, loginBackoffice, SEED } from './helpers'

async function expectViewportFit(page: Page) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clippedControls: [...document.querySelectorAll<HTMLElement>('button, input, a')]
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left < 0 || rect.right > document.documentElement.clientWidth + 1
      })
      .map((element) => element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName),
  }))

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
  expect(layout.clippedControls).toEqual([])
}

test.describe('@readonly platform onboarding', () => {
  test('uses one responsive slide at a time without horizontal overflow', async ({ page }) => {
    await loginBackoffice(page, SEED.platformAdmin)
    await page.goto(`${BOOKING_HOST}/kunder/ny`)

    for (const width of [320, 375, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await expect(page.getByRole('heading', { name: 'Starta kunden' })).toBeVisible()
      await expectViewportFit(page)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByLabel('Företagsnamn').fill('Mobilgranskning')
    await page.getByLabel('E-post', { exact: true }).fill('mobilgranskning@example.test')

    for (const heading of [
      'Bransch, mall & moduler',
      'Förbered innehåll',
      'Utseende',
      'Subdomän & Cloudflare',
      'Förhandsgranska & skapa',
    ]) {
      await page.getByRole('button', { name: 'Nästa' }).click()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expectViewportFit(page)
    }
  })
})
