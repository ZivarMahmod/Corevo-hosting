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

async function expectDocumentOwnsVerticalScroll(page: Page) {
  const layout = await page.evaluate(() => {
    const selectors = [
      '[data-onboarding-root]',
      '[data-onboarding-panel]',
      '[data-onboarding-panel-scroll]',
      '[data-onboarding-step]',
      '[data-onboarding-step-scroll]',
    ]
    const nestedScrollers = selectors.flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return [`missing:${selector}`]
      const overflowY = getComputedStyle(element).overflowY
      const trapsScroll = overflowY === 'auto' || overflowY === 'scroll'
      const clipsContent = (overflowY === 'hidden' || overflowY === 'clip') && element.scrollHeight > element.clientHeight + 1
      return trapsScroll || clipsContent
        ? [`${selector}:${overflowY}:${element.clientHeight}/${element.scrollHeight}`]
        : []
    })

    return {
      documentScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      nestedScrollers,
    }
  })

  expect(layout.documentScrollable).toBe(true)
  expect(layout.nestedScrollers).toEqual([])
}

async function expectWorkspaceOwnsVerticalScroll(page: Page) {
  const overflow = await page.evaluate(() =>
    ['[data-onboarding-panel-scroll]', '[data-onboarding-step-scroll]'].map((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      return element ? getComputedStyle(element).overflowY : `missing:${selector}`
    }),
  )

  expect(overflow).toEqual(['auto', 'auto'])
}

test.describe('@readonly platform onboarding', () => {
  test('uses one responsive slide at a time without horizontal overflow', async ({ page }) => {
    await loginBackoffice(page, SEED.platformAdmin)
    await page.goto(`${BOOKING_HOST}/kunder/ny`)

    for (const width of [320, 375, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await expect(page.getByRole('heading', { name: 'Starta kunden' })).toBeVisible()
      await expectViewportFit(page)
      if (width < 768) await expectDocumentOwnsVerticalScroll(page)
      else await expectWorkspaceOwnsVerticalScroll(page)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('radio', { name: /Extern bokningsmotor/ }).click()
    await page.getByLabel('Företagsnamn').fill('Mobilgranskning')
    await page.getByLabel('E-post', { exact: true }).fill('mobilgranskning@example.test')

    await page.getByRole('button', { name: 'Nästa' }).click()
    await expect(page.getByRole('heading', { name: 'Bransch, mall & moduler' })).toBeVisible()
    const branchSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Bransch', exact: true }),
    })
    await branchSection.getByRole('radio').first().click()
    await expect(page.getByLabel('Extern bokningslänk')).toBeVisible()
    await expectViewportFit(page)
    await expectDocumentOwnsVerticalScroll(page)

    for (const heading of [
      'Förbered innehåll',
      'Utseende',
      'Subdomän & Cloudflare',
      'Förhandsgranska & skapa',
    ]) {
      await page.getByRole('button', { name: 'Nästa' }).click()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expectViewportFit(page)
      await expectDocumentOwnsVerticalScroll(page)
    }
  })
})
