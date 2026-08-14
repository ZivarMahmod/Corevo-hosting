import { expect, test, type Locator, type Page } from '@playwright/test'
import { resolveLiveFreshCutOrigin } from '../apps/web/lib/storefront/motiontest-origins'

const CHECKPOINTS = [
  { id: 'hero', label: 'Start', headingId: 'motion-scene-hero-title' },
  { id: 'entrance', label: 'Entré', headingId: 'motion-scene-entrance-title' },
  { id: 'chair', label: 'Stolen', headingId: 'motion-scene-chair-title' },
  { id: 'craft', label: 'Hantverket', headingId: 'motion-scene-craft-title' },
  { id: 'range', label: 'Utbudet', headingId: 'motion-scene-range-title' },
  { id: 'return', label: 'Tillbaka', headingId: 'motion-scene-return-title' },
  { id: 'mirror', label: 'Resultatet', headingId: 'motion-scene-mirror-title' },
  { id: 'team', label: 'Om oss', headingId: 'motion-scene-team-title' },
] as const

const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 767, height: 900 },
  { width: 768, height: 1024 },
  { width: 1023, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
] as const

const FIRST_VIEWPORT_WIDTHS = new Set([320, 390, 1024, 1440])
const MOTIONTEST_HOSTS = new Set(['motiontest.localhost', 'motiontest.corevo.se'])

function parseOrigin(value: string, environmentName: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${environmentName} måste vara en giltig URL.`)
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${environmentName} måste vara ett rent http(s)-origin utan path, query, hash eller credentials.`,
    )
  }
  return url
}

function resolveMotiontestOrigin(): string | null {
  const explicit = process.env.E2E_BASE_URL?.trim()
  if (!explicit) {
    return `http://motiontest.localhost:${process.env.E2E_PORT ?? '3000'}`
  }

  const target = parseOrigin(explicit, 'E2E_BASE_URL')
  if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
    target.hostname = 'motiontest.localhost'
    return target.origin
  }
  return MOTIONTEST_HOSTS.has(target.hostname.toLowerCase()) ? target.origin : null
}

const MOTIONTEST_ORIGIN = resolveMotiontestOrigin()
const LIVE_FRESHCUT_ORIGIN = resolveLiveFreshCutOrigin(process.env.LIVE_FRESHCUT_BASE_URL)

function motiontestUrl(path = '/'): string {
  if (!MOTIONTEST_ORIGIN) {
    throw new Error(
      'E2E_BASE_URL pekar inte på motiontest. Kör lokalt utan E2E_BASE_URL eller sätt den till motiontest-hosten.',
    )
  }
  return new URL(path, `${MOTIONTEST_ORIGIN}/`).toString()
}

async function gotoMotiontest(page: Page): Promise<void> {
  const response = await page.goto(motiontestUrl(), { waitUntil: 'domcontentloaded' })
  expect(response, 'motiontest ska svara med ett dokument').not.toBeNull()
  expect(response?.status(), 'motiontest ska inte svara med redirect/fel').toBeLessThan(400)
  await expect(page.locator('[data-storefront-experience="freshcut-motiontest"]')).toBeVisible()
}

function observePageErrors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  return () => {
    expect.soft(consoleErrors, 'inga console.error under scenariot').toEqual([])
    expect.soft(pageErrors, 'inga ohanterade browserfel under scenariot').toEqual([])
  }
}

async function expectInsideFirstViewport(locator: Locator, label: string): Promise<void> {
  await expect(locator, `${label} ska vara synlig`).toBeVisible()
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      height: window.innerHeight,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: document.documentElement.clientWidth,
    }
  })

  expect.soft(bounds.top, `${label} ska börja i första viewporten`).toBeGreaterThanOrEqual(-1)
  expect
    .soft(bounds.bottom, `${label} ska rymmas i första viewporten`)
    .toBeLessThanOrEqual(bounds.height + 1)
  expect.soft(bounds.left, `${label} ska inte klippas till vänster`).toBeGreaterThanOrEqual(-1)
  expect
    .soft(bounds.right, `${label} ska inte klippas till höger`)
    .toBeLessThanOrEqual(bounds.width + 1)
}

async function expectMinimumTouchTarget(locator: Locator, label: string): Promise<void> {
  await expect(locator, `${label} ska vara synligt och interaktivt`).toBeVisible()
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, width: rect.width }
  })

  expect.soft(bounds.height, `${label} ska vara minst 44px högt`).toBeGreaterThanOrEqual(44)
  expect.soft(bounds.width, `${label} ska vara minst 44px brett`).toBeGreaterThanOrEqual(44)
}

async function expectViewportContract(
  page: Page,
  width: number,
  { checkMotionTravel = true }: { checkMotionTravel?: boolean } = {},
): Promise<void> {
  const layout = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-motion-mode]')
    if (!root) return { missingRoot: true } as const

    const nestedScrollers = [root, ...root.querySelectorAll<HTMLElement>('*')]
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => {
        const overflowY = getComputedStyle(element).overflowY
        return (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          element.scrollHeight > element.clientHeight + 1
        )
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}[data-motion-scene="${element.dataset.motionScene ?? ''}"]`,
      )

    const rootHeight = root.getBoundingClientRect().height
    const firstLayer = root.querySelector<HTMLElement>('[data-motion-layer]')
    return {
      missingRoot: false,
      clientWidth: document.documentElement.clientWidth,
      controlledTravelVh: (rootHeight - window.innerHeight) / window.innerHeight,
      layerWillChange: firstLayer ? getComputedStyle(firstLayer).willChange : '',
      mode: root.dataset.motionMode,
      nestedScrollers,
      scrollWidth: document.documentElement.scrollWidth,
    } as const
  })

  expect(layout.missingRoot, `${width}px: motionroten ska finnas`).toBe(false)
  if (layout.missingRoot) return
  expect
    .soft(layout.scrollWidth, `${width}px: ingen horisontell sideoverflow`)
    .toBeLessThanOrEqual(layout.clientWidth + 1)
  expect.soft(layout.nestedScrollers, `${width}px: dokumentet ska äga scrollen`).toEqual([])
  expect
    .soft(layout.layerWillChange, `${width}px: will-change ska följa motionläget`)
    .toBe(layout.mode === 'enhanced' || layout.mode === 'preparing' ? 'transform' : 'auto')
  if (!checkMotionTravel) return
  expect
    .soft(layout.controlledTravelVh, `${width}px: progression får inte vara negativ`)
    .toBeGreaterThanOrEqual(0)
  expect
    .soft(layout.controlledTravelVh, `${width}px: kontrollerad progression ska hålla 150vh-taket`)
    .toBeLessThanOrEqual(1.5)
  if (width < 1024) {
    expect
      .soft(
        layout.controlledTravelVh,
        `${width}px: compact/tablet ska hålla minst 80vh progression`,
      )
      .toBeGreaterThanOrEqual(0.8)
    expect
      .soft(layout.controlledTravelVh, `${width}px: compact/tablet ska hålla 80–100vh-resan`)
      .toBeLessThanOrEqual(1)
  } else {
    expect
      .soft(layout.controlledTravelVh, `${width}px: desktop ska hålla minst 100vh progression`)
      .toBeGreaterThanOrEqual(1)
    expect
      .soft(layout.controlledTravelVh, `${width}px: desktop ska hålla 100–130vh-resan`)
      .toBeLessThanOrEqual(1.3)
  }
}

async function expectCheckpointGrouping(page: Page, width: number): Promise<void> {
  const checkpoints = page.getByRole('navigation', { name: 'Upplevelsens scener' })
  const checkpointAnchors = checkpoints.locator('a[href^="#motion-scene-"]')
  const visibleCheckpointLinks = checkpoints.getByRole('link')

  await expect(checkpointAnchors, `${width}px: alla åtta checkpoints ska finnas i DOM`).toHaveCount(
    8,
  )
  await expect(
    visibleCheckpointLinks,
    `${width}px: navigation ska visa alla åtta checkpoints`,
  ).toHaveCount(8)
}

async function expectPopularServicesOrCatalogLink(page: Page, width: number): Promise<boolean> {
  const popularServices = page.locator('[data-motion-popular-services]')
  const prices = popularServices.locator('strong')
  if ((await prices.count()) === 0) {
    await expect(
      page.getByRole('link', { name: /Se tjänster/ }).first(),
      `${width}px: tjänstekatalogen ska vara nåbar när tenantens prislista saknas`,
    ).toBeVisible()
    return false
  }
  await expect(prices, `${width}px: exakt tre riktiga populärpriser`).toHaveText([
    '369 kr',
    '329 kr',
    '459 kr',
  ])
  return true
}

async function expectBookingFirstViewport(page: Page, width: number): Promise<void> {
  const motionRoot = page.locator('[data-motion-mode]')
  const popularServices = page.locator('[data-motion-popular-services]')
  const salonSummary = page.locator('[data-motion-salon-selector]')
  const book = motionRoot.getByRole('link', { name: 'Boka nu', exact: true }).first()
  const services = page.getByRole('link', { name: 'Se tjänster', exact: true })
  const result = page.getByRole('link', { name: 'Hoppa till resultat', exact: true })
  const checkpoints = page.getByRole('navigation', { name: 'Upplevelsens scener' })

  const hasPopularServices = await expectPopularServicesOrCatalogLink(page, width)
  await expect(salonSummary).toContainText('Två salonger i Linköping')
  await expect(salonSummary).toContainText('Bokhållaregatan 2')
  await expect(salonSummary).toContainText('Sankt Larsgatan 17')
  await expect(book).toBeVisible()
  await expect(services).toBeVisible()
  await expect(result).toBeVisible()
  await expectCheckpointGrouping(page, width)

  const bookingPresentation = await book.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      height: element.getBoundingClientRect().height,
    }
  })
  expect(
    ['rgba(0, 0, 0, 0)', 'transparent'],
    `${width}px: permanent Boka ska behålla primär CTA-bakgrund`,
  ).not.toContain(bookingPresentation.backgroundColor)
  expect(
    bookingPresentation.height,
    `${width}px: permanent Boka ska ha minst 44px tryckyta`,
  ).toBeGreaterThanOrEqual(44)

  if (hasPopularServices) {
    await expectInsideFirstViewport(popularServices, `${width}px: tre populära tjänster`)
  }
  await expectInsideFirstViewport(salonSummary, `${width}px: båda salongerna`)
  await expectInsideFirstViewport(book, `${width}px: boka`)
  await expectInsideFirstViewport(services, `${width}px: tjänste-skip`)
  await expectInsideFirstViewport(result, `${width}px: resultat-skip`)
  await expectInsideFirstViewport(checkpoints, `${width}px: checkpointnavigation`)
}

async function scrollToMotionProgress(page: Page, progress: number): Promise<number> {
  return page.evaluate((nextProgress) => {
    const root = document.querySelector<HTMLElement>('[data-motion-mode]')
    if (!root) throw new Error('motion-root-missing')
    const rootTop = root.getBoundingClientRect().top + window.scrollY
    const travel = Math.max(0, root.offsetHeight - window.innerHeight)
    const target = rootTop + travel * Math.min(1, Math.max(0, nextProgress))
    window.scrollTo(0, target)
    return target
  }, progress)
}

test.describe('@readonly @motiontest FreshCut motiontest', () => {
  test.skip(
    MOTIONTEST_ORIGIN === null,
    'E2E_BASE_URL är satt till en annan miljö. Motiontest körs bara lokalt eller mot explicit motiontest-host.',
  )

  test('håller bokning, riktiga priser och två salonger i första viewporten genom breddmatrisen', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(VIEWPORTS[0])
    await gotoMotiontest(page)
    await expect(page.locator('[data-motion-mode]')).toHaveAttribute('data-motion-mode', 'enhanced')

    for (const viewport of VIEWPORTS) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport)
        await page.evaluate(() => window.scrollTo(0, 0))
        await expect(page.locator('[data-motion-mode]')).toHaveAttribute(
          'data-motion-scene',
          'hero',
        )
        await expectViewportContract(page, viewport.width)
        if (FIRST_VIEWPORT_WIDTHS.has(viewport.width)) {
          await expectBookingFirstViewport(page, viewport.width)
        }
      })
    }
  })

  test('behåller alla åtta checkpoints synliga genom compact/tablet/desktop', async ({ page }) => {
    for (const viewport of [
      { width: 767, height: 900 },
      { width: 768, height: 1024 },
      { width: 1023, height: 900 },
      { width: 1024, height: 900 },
    ] as const) {
      await test.step(`${viewport.width}px`, async () => {
        await page.setViewportSize(viewport)
        await gotoMotiontest(page)
        await expect(page.locator('[data-motion-mode]')).toHaveAttribute(
          'data-motion-mode',
          'enhanced',
        )
        await expectViewportContract(page, viewport.width)
        await expectCheckpointGrouping(page, viewport.width)

        const panelRatio = await page.locator('[data-motion-business-panel]').evaluate((panel) => {
          return panel.getBoundingClientRect().width / document.documentElement.clientWidth
        })
        if (viewport.width < 768) {
          expect(panelRatio, `${viewport.width}px: phone ska vara en kolumn`).toBeGreaterThan(0.9)
        } else {
          expect(
            panelRatio,
            `${viewport.width}px: tablet/desktop ska behålla tvåkolumnsytan`,
          ).toBeLessThan(0.55)
        }
      })
    }
  })

  test('wrappar kontroller utan horisontell overflow vid 200% zoom-ekvivalent bredd', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 900 })
    await gotoMotiontest(page)

    const navigation = page.getByRole('navigation', { name: 'Upplevelsens scener' })
    const links = navigation.getByRole('link')
    await expect(links).toHaveCount(8)
    await expectCheckpointGrouping(page, 640)
    await expectViewportContract(page, 640)

    const layout = await navigation.evaluate((element) => {
      const documentWidth = document.documentElement.clientWidth
      const linkRects = Array.from(element.querySelectorAll('a')).map((link) => {
        const rect = link.getBoundingClientRect()
        return { left: rect.left, right: rect.right }
      })
      return {
        documentWidth,
        flexWrap: getComputedStyle(element).flexWrap,
        linkRects,
        scrollWidth: document.documentElement.scrollWidth,
      }
    })

    expect(layout.flexWrap).toBe('wrap')
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.documentWidth + 1)
    for (const rect of layout.linkRects) {
      expect(rect.left).toBeGreaterThanOrEqual(-1)
      expect(rect.right).toBeLessThanOrEqual(layout.documentWidth + 1)
    }
  })

  test('routar Upplev FreshCut genom samma absoluta scenägare som checkpoints', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')
    const entranceCheckpoint = page
      .getByRole('navigation', { name: 'Upplevelsens scener' })
      .getByRole('link', { name: 'Entré', exact: true })
    await page.getByRole('link', { name: 'Upplev FreshCut', exact: true }).click()

    await expect.poll(() => new URL(page.url()).hash).toBe('#motion-scene-entrance')
    await expect(experience).toHaveAttribute('data-motion-scene', 'entrance')
    await expect(entranceCheckpoint).toHaveAttribute('aria-current', 'step')
    await expect(page.locator('#motion-scene-entrance-title')).toBeFocused()
    await expect
      .poll(() =>
        experience.evaluate((element) =>
          Number(getComputedStyle(element).getPropertyValue('--motion-visual-progress')),
        ),
      )
      .toBeCloseTo(0.12, 2)
  })

  test('ger motiontest en första tangentbordsgenväg till det befintliga huvudinnehållet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMotiontest(page)

    const skip = page.getByRole('link', { name: 'Hoppa till innehåll', exact: true })
    const main = page.getByRole('main')
    await expect(skip).toHaveAttribute('href', '#motiontest-main-content')
    await expect(skip).toHaveAttribute('tabindex', '0')
    await expect(main).toHaveAttribute('id', 'motiontest-main-content')
    await expect(main).toHaveAttribute('tabindex', '-1')

    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await expectMinimumTouchTarget(skip, 'skip-länken i fokus')
    const focusedPosition = await skip.evaluate((element) => element.getBoundingClientRect().top)
    expect(
      focusedPosition,
      'skip-länken ska flyttas in i viewporten vid fokus',
    ).toBeGreaterThanOrEqual(0)

    await page.keyboard.press('Enter')
    await expect(main).toBeFocused()
    await expect.poll(() => new URL(page.url()).hash).toBe('#motiontest-main-content')
  })

  test('ger varje kompakt motion- och affärslänk minst 44x44 CSS-pixlar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMotiontest(page)

    const sceneNavigation = page.getByRole('navigation', { name: 'Upplevelsens scener' })
    const visibleMotionControls = sceneNavigation
      .locator('xpath=..')
      .locator('a:visible, button:visible')
    await expect(visibleMotionControls).toHaveCount(7)
    for (let index = 0; index < 7; index += 1) {
      const control = visibleMotionControls.nth(index)
      await expectMinimumTouchTarget(
        control,
        `motionkontroll ${index + 1}: ${await control.innerText()}`,
      )
    }

    const experience = page.locator('[data-motion-mode]')
    const businessPanel = page.locator('[data-motion-business-panel]')
    const businessLinkNames = ['Se tjänster & priser', 'Välj salong', 'Upplev FreshCut']
    const expectBusinessTouchTargets = async (state: string): Promise<void> => {
      for (const name of businessLinkNames) {
        await expectMinimumTouchTarget(
          businessPanel.getByRole('link', { name, exact: true }),
          `${state}: ${name}`,
        )
      }
    }
    await expectBusinessTouchTargets('första viewporten')

    await sceneNavigation.getByRole('link', { name: 'Resultatet', exact: true }).click()
    await expect(experience).toHaveAttribute('data-motion-scene', 'mirror')
    await expectBusinessTouchTargets('Mirror')

    await scrollToMotionProgress(page, 1)
    await expect(experience).toHaveAttribute('data-motion-scene', 'team')
    await expectBusinessTouchTargets('Om oss')
    await expectMinimumTouchTarget(
      page.locator('section[data-motion-scene="team"] a[href="#om"]'),
      'Om oss-scenens fortsättningslänk',
    )

    await expectMinimumTouchTarget(
      page.locator('#om a:visible, #om button:visible').first(),
      'Om FreshCuts bokningslänk',
    )
    const contactLinks = page.locator(
      '#kontakt a[href^="tel:"]:visible, #kontakt a[href^="mailto:"]:visible',
    )
    await expect(contactLinks).toHaveCount(2)
    for (let index = 0; index < 2; index += 1) {
      await expectMinimumTouchTarget(contactLinks.nth(index), `kontaktlänk ${index + 1}`)
    }
    await expectMinimumTouchTarget(
      page.locator('a[href^="tel:"]:visible').first(),
      'sidhuvudets telefonlänk',
    )
  })

  test('gör alla åtta checkpoints direkt adresserbara med aktivt steg och fokus', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const assertNoPageErrors = observePageErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    const navigation = page.getByRole('navigation', { name: 'Upplevelsens scener' })
    await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')
    await expect(navigation.getByRole('link')).toHaveCount(8)

    for (const checkpoint of CHECKPOINTS) {
      await test.step(checkpoint.id, async () => {
        const anchorId = `motion-scene-${checkpoint.id}`
        const link = navigation.getByRole('link', { name: checkpoint.label, exact: true })
        await expect(link).toHaveAttribute('href', `#${anchorId}`)
        await link.click()
        await expect.poll(() => new URL(page.url()).hash).toBe(`#${anchorId}`)
        await expect(experience).toHaveAttribute('data-motion-scene', checkpoint.id)
        await expect(link).toHaveAttribute('aria-current', 'step')
        await expect(page.locator(`#${checkpoint.headingId}`)).toBeFocused()
      })
    }

    assertNoPageErrors()
  })

  test('hydreras stabilt till Mirror från initial och omladdad direktlänk', async ({ page }) => {
    test.setTimeout(60_000)
    const assertNoPageErrors = observePageErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })

    const response = await page.goto(motiontestUrl('/#motion-scene-mirror'), {
      waitUntil: 'domcontentloaded',
    })
    expect(response, 'direktlänken ska svara med ett dokument').not.toBeNull()
    expect(response?.status(), 'direktlänken ska svara utan redirect/fel').toBeLessThan(400)

    const experience = page.locator('[data-motion-mode]')
    const result = page
      .getByRole('navigation', { name: 'Upplevelsens scener' })
      .getByRole('link', { name: 'Resultatet', exact: true })
    const mirrorHeading = page.locator('#motion-scene-mirror-title')

    const expectMirrorHydrated = async (label: string): Promise<void> => {
      await expect(experience, `${label}: upplevelsen ska vara synlig`).toBeVisible()
      await expect(experience, `${label}: upplevelsen ska vara enhanced`).toHaveAttribute(
        'data-motion-mode',
        'enhanced',
      )
      await expect.poll(() => new URL(page.url()).hash).toBe('#motion-scene-mirror')
      await expect(experience, `${label}: aktiv scen ska vara Mirror`).toHaveAttribute(
        'data-motion-scene',
        'mirror',
      )
      await expect(result, `${label}: Resultatet ska vara aktiv checkpoint`).toHaveAttribute(
        'aria-current',
        'step',
      )
      await expect(mirrorHeading, `${label}: Mirror-rubriken ska äga fokus`).toBeFocused()
    }

    await expectMirrorHydrated('initial direktladdning')
    const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded' })
    expect(reloadResponse, 'reload ska svara med ett dokument').not.toBeNull()
    expect(reloadResponse?.status(), 'reload ska svara utan redirect/fel').toBeLessThan(400)
    await expectMirrorHydrated('reload')
    assertNoPageErrors()
  })

  test('släpper till native dokumentscroll och tål snabb framåt- och bakåtscroll', async ({
    page,
  }) => {
    const assertNoPageErrors = observePageErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')

    const beforeWheel = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeWheel)

    const releasePoint = await scrollToMotionProgress(page, 1)
    await expect(experience).toHaveAttribute('data-motion-scene', 'team')
    await expect(experience).toHaveAttribute('data-motion-released', 'true')

    await page.mouse.wheel(0, 700)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(releasePoint)
    const servicesSection = page.locator(
      'section#tjanster[aria-labelledby="motion-services-title"]',
    )
    await servicesSection.scrollIntoViewIfNeeded()
    await expect(servicesSection.locator('#motion-services-title')).toBeVisible()

    await page.evaluate(async () => {
      const root = document.querySelector<HTMLElement>('[data-motion-mode]')
      if (!root) throw new Error('motion-root-missing')
      const rootTop = root.getBoundingClientRect().top + window.scrollY
      const travel = Math.max(0, root.offsetHeight - window.innerHeight)
      for (const progress of [1, 0.15, 0.92, 0.43, 0.76, 0]) {
        window.scrollTo(0, rootTop + travel * progress)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
    })

    await expect(experience).toHaveAttribute('data-motion-scene', 'hero')
    await expect(experience).toHaveAttribute('data-motion-released', 'false')
    assertNoPageErrors()
  })

  test('ger stage perspektiv och scenlager verklig spatial transform vid mellanprogress', async ({
    page,
  }) => {
    const assertNoPageErrors = observePageErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')
    await scrollToMotionProgress(page, 0.5)
    await expect(experience).toHaveAttribute('data-motion-scene', 'craft')

    const spatial = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('[data-motion-stage="true"]')
      const activeScene = stage?.querySelector<HTMLElement>(
        ':scope > section[data-motion-scene="craft"]',
      )
      if (!stage || !activeScene) throw new Error('motion-spatial-elements-missing')
      return {
        perspective: getComputedStyle(stage).perspective,
        transforms: [
          activeScene,
          ...activeScene.querySelectorAll<HTMLElement>('[data-motion-layer]'),
        ]
          .map((element) => getComputedStyle(element).transform)
          .filter((transform) => transform !== 'none'),
      }
    })

    expect(spatial.perspective, 'enhanced stage ska äga ett verkligt perspektiv').not.toBe('none')
    expect(spatial.perspective, 'enhanced stage-perspektivet får inte vara noll').not.toBe('0px')
    expect(
      spatial.transforms.some((transform) => transform.startsWith('matrix3d(')),
      'aktiv scen eller dess lager ska bära en 3D-transform vid mellanprogress',
    ).toBe(true)
    assertNoPageErrors()
  })

  test('låter tangentbordet aktivera checkpoint, fokusflytt och paus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')
    const craftLink = page
      .getByRole('navigation', { name: 'Upplevelsens scener' })
      .getByRole('link', { name: 'Hantverket', exact: true })
    await craftLink.focus()
    await expect(craftLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(experience).toHaveAttribute('data-motion-scene', 'craft')
    await expect(page.locator('#motion-scene-craft-title')).toBeFocused()

    const pause = page.getByRole('button', { name: 'Pausa rörelse' })
    await pause.focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Fortsätt rörelse' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pausa rörelse' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('byter till Resultatet medan Craft är pausad utan delat visuellt state', async ({
    page,
  }) => {
    const assertNoPageErrors = observePageErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    const navigation = page.getByRole('navigation', { name: 'Upplevelsens scener' })
    await expect(experience).toHaveAttribute('data-motion-mode', 'enhanced')
    await navigation.getByRole('link', { name: 'Hantverket', exact: true }).click()
    await expect(experience).toHaveAttribute('data-motion-scene', 'craft')
    await page.getByRole('button', { name: 'Pausa rörelse' }).click()
    await expect(experience).toHaveAttribute('data-motion-paused', 'true')

    const result = navigation.getByRole('link', { name: 'Resultatet', exact: true })
    await result.click()
    await expect(experience).toHaveAttribute('data-motion-scene', 'mirror')
    await expect(result).toHaveAttribute('aria-current', 'step')
    await expect(page.locator('#motion-scene-mirror-title')).toBeFocused()
    await expect(page.getByRole('button', { name: 'Fortsätt rörelse' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(experience).toHaveAttribute('data-motion-paused', 'true')
    await expect
      .poll(() =>
        experience.evaluate((element) =>
          Number(getComputedStyle(element).getPropertyValue('--motion-visual-progress')),
        ),
      )
      .toBeCloseTo(0.88, 5)
    assertNoPageErrors()
  })

  test('behåller komplett statisk sida med reduced motion', async ({ page }) => {
    const assertNoPageErrors = observePageErrors(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMotiontest(page)

    const experience = page.locator('[data-motion-mode]')
    await expect(experience).toHaveAttribute('data-motion-mode', 'static')
    await expect(page.locator('[data-motion-layer]').first()).toHaveCSS('will-change', 'auto')
    await expect(page.locator('[data-motion-stage]')).not.toHaveCSS('position', 'sticky')
    await expect(page.getByRole('button', { name: 'Pausa rörelse' })).toBeDisabled()
    await expect(page.locator('#motion-scene-hero-title')).toBeVisible()
    await expectPopularServicesOrCatalogLink(page, 390)
    await expect(page.locator('[data-motion-salon-selector]')).toContainText('Sankt Larsgatan 17')
    const servicesSection = page.locator(
      'section#tjanster[aria-labelledby="motion-services-title"]',
    )
    await expect(servicesSection.locator('#motion-services-title')).toBeVisible()
    await expectViewportContract(page, 390, { checkMotionTravel: false })
    assertNoPageErrors()
  })

  test('faller tillbaka utan informationsförlust när media misslyckas eller video saknas', async ({
    page,
  }) => {
    const assertNoPageErrors = observePageErrors(page)
    await page.route(/\.(?:mp4|webm)(?:\?.*)?$/i, async (route) => route.abort('failed'))
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMotiontest(page)

    await page.locator('video').evaluateAll((videos) => videos.forEach((video) => video.remove()))
    await expect(page.locator('video')).toHaveCount(0)
    await expect(page.locator('#motion-scene-hero-title')).toBeVisible()
    await expectPopularServicesOrCatalogLink(page, 390)
    await expect(page.locator('[data-location-key="bokhallaregatan"]')).toContainText(
      'Bokhållaregatan 2',
    )
    await expect(page.locator('[data-location-key="sankt-larsgatan"]')).toContainText(
      'Bokningslänk kommer',
    )
    await expect(page.locator('[data-motion-stage] > section[data-motion-scene]')).toHaveCount(8)
    assertNoPageErrors()
  })

  test('väljer responsiv poster-currentSrc och återanvänder Craft exakt för Return', async ({
    page,
  }) => {
    const selectedPictureSource = (sceneId: string) =>
      page.locator(`picture[data-motion-poster-scene="${sceneId}"]`).evaluate((picture) => {
        const matching = Array.from(picture.querySelectorAll('source')).find(
          (source) => window.matchMedia(source.media).matches,
        )
        return matching ? new URL(matching.srcset, document.baseURI).href : null
      })

    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      await gotoMotiontest(page)

      const posters = page.locator('img[data-motion-poster-image]')
      await expect(posters).toHaveCount(8)
      await expect(page.locator('img[data-motion-poster-image][loading="eager"]')).toHaveCount(1)
      await expect(page.locator('img[data-motion-poster-image][fetchpriority="high"]')).toHaveCount(
        1,
      )
      await expect(page.locator('img[data-motion-poster-image][loading="lazy"]')).toHaveCount(7)

      for (const sceneId of ['hero', 'craft', 'return']) {
        const image = page.locator(`img[data-motion-poster-image="${sceneId}"]`)
        await expect
          .poll(() => image.evaluate((element) => (element as HTMLImageElement).currentSrc))
          .toBe(await selectedPictureSource(sceneId))
      }

      const craftCurrentSrc = await page
        .locator('img[data-motion-poster-image="craft"]')
        .evaluate((element) => (element as HTMLImageElement).currentSrc)
      const returnCurrentSrc = await page
        .locator('img[data-motion-poster-image="return"]')
        .evaluate((element) => (element as HTMLImageElement).currentSrc)
      expect(returnCurrentSrc).toBe(craftCurrentSrc)
    }
  })

  test('väljer ett verkligt codec-currentSrc från den godkända fyrkällsfamiljen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMotiontest(page)

    let video = page.locator('video[data-motion-media-owned="freshcut-controller"]').first()
    test.skip(
      (await video.count()) === 0,
      'Validerad videofamilj saknas; currentSrc-gaten aktiveras när källor finns.',
    )

    for (const viewport of [
      { width: 390, height: 844, suffix: 'mobile' },
      { width: 1024, height: 900, suffix: 'desktop' },
    ] as const) {
      await page.setViewportSize(viewport)
      await page.reload({ waitUntil: 'domcontentloaded' })
      video = page.locator('video[data-motion-media-owned="freshcut-controller"]').first()
      await expect(video.locator('source')).toHaveCount(4)
      await expect
        .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentSrc))
        .toMatch(
          new RegExp(
            `^https?://[^/]+/media/freshcut-motion/([a-z0-9][a-z0-9-]*-v[1-9]\\d*-[a-f0-9]{12})/\\1-${viewport.suffix}\\.(?:webm|mp4)$`,
          ),
        )
    }
  })

  test('ger aldrig Sankt Larsgatan eller preliminära tjänster en bokningsväg', async ({ page }) => {
    await gotoMotiontest(page)

    const primarySalon = page.locator('[data-location-key="bokhallaregatan"]')
    const prototypeSalon = page.locator('[data-location-key="sankt-larsgatan"]')
    await expect(primarySalon.getByRole('link', { name: 'Boka via Bokadirekt' })).toHaveAttribute(
      'target',
      '_blank',
    )
    await expect(prototypeSalon).toHaveAttribute('data-provenance', 'prototype')
    await expect(prototypeSalon).toContainText('Bokningslänk kommer')
    await expect(prototypeSalon.getByRole('link')).toHaveCount(0)
    await expect(prototypeSalon.getByRole('button')).toHaveCount(0)

    const prototypeServices = page.locator('[data-prototype-service]')
    await expect(prototypeServices).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      await expect(prototypeServices.nth(index)).toHaveAttribute('data-provenance', 'prototype')
      await expect(prototypeServices.nth(index).getByRole('link')).toHaveCount(0)
      await expect(prototypeServices.nth(index).getByRole('button')).toHaveCount(0)
    }
  })
})

test.describe('@readonly @motiontest live FreshCut isolation', () => {
  test.skip(
    !LIVE_FRESHCUT_ORIGIN || !MOTIONTEST_ORIGIN,
    'Sätt LIVE_FRESHCUT_BASE_URL explicit för read-only isoleringsjämförelse.',
  )

  test('håller motiontest-markup och prototypdata borta från live FreshCut', async ({ page }) => {
    if (!LIVE_FRESHCUT_ORIGIN) throw new Error('LIVE_FRESHCUT_BASE_URL saknas')
    const assertNoPageErrors = observePageErrors(page)
    const response = await page.goto(LIVE_FRESHCUT_ORIGIN, { waitUntil: 'domcontentloaded' })

    expect(response, 'live FreshCut ska svara med ett dokument').not.toBeNull()
    expect(response?.status(), 'live FreshCut ska svara utan fel').toBeLessThan(400)
    await expect(page.locator('[data-world="storefront"][data-theme="freshcut"]')).toBeVisible()
    await expect(page.locator('[data-storefront-shell-experience]')).toHaveCount(0)
    await expect(page.locator('[data-storefront-experience="freshcut-motiontest"]')).toHaveCount(0)
    await expect(page.locator('[data-provenance="prototype"]')).toHaveCount(0)
    await expect(page.locator('[data-location-key="sankt-larsgatan"]')).toHaveCount(0)
    assertNoPageErrors()
  })
})
