import { expect, test } from '@playwright/test'

const MOTIONTEST_HOSTS = new Set(['motiontest.localhost', 'motiontest.corevo.se'])

function motiontestUrl(): string {
  const configured = process.env.E2E_BASE_URL
  if (!configured) {
    return `http://motiontest.localhost:${process.env.E2E_PORT ?? '3000'}/`
  }

  const target = new URL(configured)
  if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
    target.hostname = 'motiontest.localhost'
  }
  if (!MOTIONTEST_HOSTS.has(target.hostname.toLowerCase())) {
    throw new Error('No-JavaScript-testet får bara köras mot motiontest-hosten.')
  }
  target.pathname = '/'
  target.search = ''
  target.hash = ''
  return target.href
}

test.describe('@readonly @motiontest FreshCut without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('keeps services, prices, booking, locations, About, and contact visible', async ({
    page,
  }) => {
    const response = await page.goto(motiontestUrl(), { waitUntil: 'domcontentloaded' })

    expect(response?.status()).toBeLessThan(400)
    await expect(
      page.locator('[data-storefront-experience="freshcut-motiontest"]:visible'),
    ).toBeVisible()

    const services = page.locator('#tjanster:visible')
    await expect(services).toBeVisible()
    await services.getByText('Preliminära priser för damklippning', { exact: true }).click()
    await expect(services.locator('[data-prototype-service]:visible')).toHaveCount(3)
    await expect(services.getByText('399 kr', { exact: true })).toBeVisible()
    await expect(page.locator('#salongen:visible')).toBeVisible()
    await expect(page.locator('[data-location-key="bokhallaregatan"]:visible')).toBeVisible()
    await expect(page.locator('[data-location-key="sankt-larsgatan"]:visible')).toBeVisible()

    const booking = page.getByRole('link', { name: 'Boka via Bokadirekt', exact: true }).first()
    await expect(booking).toBeVisible()
    await expect(booking).toHaveAttribute('href', /^https:\/\/www\.bokadirekt\.se\//)

    await expect(page.locator('#om:visible')).toBeVisible()
    await expect(page.locator('#kontakt:visible')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Laddar…' })).toHaveCount(0)
  })
})

test.describe('@readonly @motiontest FreshCut streaming fallback isolation', () => {
  test('parses only the canonical motion tree while client chunks are delayed', async ({ page }) => {
    await page.addInitScript(() => {
      const counts = { controllers: 0, experiences: 0, prepaintScripts: 0 }
      Object.defineProperty(window, '__freshCutParsedNodes', {
        configurable: true,
        value: counts,
      })

      const seenControllers = new WeakSet<Element>()
      const seenExperiences = new WeakSet<Element>()
      const seenPrepaintScripts = new WeakSet<Element>()
      const collect = (root: Document | Element) => {
        const elements =
          root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')]
        for (const element of elements) {
          if (
            element.matches('[data-storefront-experience="freshcut-motiontest"]') &&
            !seenExperiences.has(element)
          ) {
            seenExperiences.add(element)
            counts.experiences += 1
          }
          if (element.matches('[data-motion-mode]') && !seenControllers.has(element)) {
            seenControllers.add(element)
            counts.controllers += 1
          }
          if (
            element.matches('script[data-freshcut-motion-prepaint]') &&
            !seenPrepaintScripts.has(element)
          ) {
            seenPrepaintScripts.add(element)
            counts.prepaintScripts += 1
          }
        }
      }

      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) collect(node)
          }
        }
      }).observe(document, { childList: true, subtree: true })
      collect(document)
    })
    await page.route(/\/_next\/static\/chunks\/.*\.js(?:\?.*)?$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      await route.continue()
    })

    const response = await page.goto(motiontestUrl(), { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(400)
    await page.waitForLoadState('networkidle')

    const parsed = await page.evaluate(
      () =>
        (
          window as Window & {
            __freshCutParsedNodes: {
              controllers: number
              experiences: number
              prepaintScripts: number
            }
          }
        ).__freshCutParsedNodes,
    )
    expect(parsed).toEqual({ controllers: 1, experiences: 1, prepaintScripts: 1 })
    await expect(page.locator('[data-storefront-experience="freshcut-motiontest"]')).toHaveCount(1)
    await expect(page.locator('[data-motion-mode]')).toHaveCount(1)
    await expect(page.locator('script[data-freshcut-motion-prepaint]')).toHaveCount(1)
  })
})
