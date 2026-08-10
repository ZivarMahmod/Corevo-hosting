import { expect, type Page, test } from '@playwright/test'

const MOTIONTEST_HOSTS = new Set(['motiontest.localhost', 'motiontest.corevo.se'])

function motiontestUrl(): string {
  const configured = process.env.E2E_BASE_URL
  if (!configured) {
    return `http://motiontest.localhost:${process.env.E2E_PORT ?? '3000'}/`
  }

  const target = new URL(configured)
  if (!MOTIONTEST_HOSTS.has(target.hostname)) {
    throw new Error('CLS-testet får bara köras mot motiontest-hosten.')
  }
  target.pathname = '/'
  target.search = ''
  target.hash = ''
  return target.href
}

function canonicalMotiontest(page: Page) {
  const storefront = page.locator('[data-storefront-experience="freshcut-motiontest"]:visible')
  return {
    storefront,
    experience: storefront.locator('[data-motion-mode]'),
  }
}

async function expectCompleteStaticExperience(
  page: Page,
  mediaRequests: readonly string[],
): Promise<void> {
  const { experience, storefront } = canonicalMotiontest(page)
  await expect(storefront).toHaveCount(1)
  await expect(experience).toHaveAttribute('data-motion-mode', 'static')
  await expect(page.locator('html')).not.toHaveAttribute('data-freshcut-motion-prepaint')
  await expect(experience.locator(':scope [data-motion-scene]')).toHaveCount(8)
  await expect(storefront.locator('#tjanster')).toHaveCount(1)
  await page.waitForLoadState('networkidle')
  await expect(storefront.locator('video')).toHaveCount(0)
  await expect(storefront.locator('video source')).toHaveCount(0)
  await expect(storefront.locator('picture source')).toHaveCount(16)
  expect(mediaRequests).toEqual([])
  await expect
    .poll(() =>
      experience.evaluate((root) => root.getBoundingClientRect().height / window.innerHeight),
    )
    .toBeGreaterThan(4)
}

test.describe('@readonly @motiontest FreshCut motiontest layout stability', () => {
  for (const viewport of [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'standard mobile', width: 390, height: 844 },
    { label: 'small mobile', width: 320, height: 800 },
  ] as const) {
    test(`keeps the cold SSR-to-enhanced ${viewport.label} transition below the major CLS threshold`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.addInitScript(() => {
        const shifts: number[] = []
        Object.defineProperty(window, '__freshCutMotionLayoutShifts', {
          configurable: true,
          value: shifts,
        })
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              hadRecentInput?: boolean
              value?: number
            }
            if (!shift.hadRecentInput && typeof shift.value === 'number') shifts.push(shift.value)
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })

      const response = await page.goto(motiontestUrl(), { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBeLessThan(400)
      const { experience, storefront } = canonicalMotiontest(page)
      await expect(storefront).toHaveCount(1)
      await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(250)

      const shifts = await page.evaluate(
        () =>
          (window as Window & { __freshCutMotionLayoutShifts?: number[] })
            .__freshCutMotionLayoutShifts ?? [],
      )
      const cumulativeLayoutShift = shifts.reduce((sum, value) => sum + value, 0)

      expect(cumulativeLayoutShift).toBeLessThan(0.1)
    })
  }

  test('keeps the complete static flow for reduced motion', async ({ page }) => {
    const mediaRequests: string[] = []
    page.on('request', (request) => {
      if (/\.(?:mp4|webm)(?:\?.*)?$/i.test(request.url())) mediaRequests.push(request.url())
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const response = await page.goto(motiontestUrl(), { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(400)
    await expectCompleteStaticExperience(page, mediaRequests)
  })

  test('keeps the complete static flow for save-data, 2g, 3g, and low-memory clients', async ({
    browser,
  }) => {
    const constrainedClients = [
      { connection: { effectiveType: '4g', saveData: true }, deviceMemory: 8 },
      { connection: { effectiveType: '2g', saveData: false }, deviceMemory: 8 },
      { connection: { effectiveType: '3g', saveData: false }, deviceMemory: 8 },
      { connection: { effectiveType: '4g', saveData: false }, deviceMemory: 2 },
    ] as const

    for (const client of constrainedClients) {
      const context = await browser.newContext()
      await context.addInitScript((capability) => {
        Object.defineProperty(navigator, 'connection', {
          configurable: true,
          value: capability.connection,
        })
        Object.defineProperty(navigator, 'deviceMemory', {
          configurable: true,
          value: capability.deviceMemory,
        })
      }, client)
      const page = await context.newPage()
      const mediaRequests: string[] = []
      page.on('request', (request) => {
        if (/\.(?:mp4|webm)(?:\?.*)?$/i.test(request.url())) mediaRequests.push(request.url())
      })
      try {
        const response = await page.goto(motiontestUrl(), { waitUntil: 'domcontentloaded' })
        expect(response?.status()).toBeLessThan(400)
        await expectCompleteStaticExperience(page, mediaRequests)
      } finally {
        await context.close()
      }
    }
  })
})
