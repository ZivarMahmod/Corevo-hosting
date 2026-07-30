import { expect, test, type BrowserContext } from '@playwright/test'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BOOKING_HOST, loginBackoffice, SEED } from '../../helpers'
import { loadGoal93Matrix } from './runner'

const previewRoot = path.resolve(
  __dirname,
  '../../../apps/web/app/salong-preview/[slug]',
)
const allRoutes = [
  '/',
  ...readdirSync(previewRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(previewRoot, entry.name, 'page.tsx')),
    )
    .map((entry) => `/${entry.name}`)
    .sort(),
]
const requestedRoute = process.env.GOAL93_RUNTIME_ROUTE
const routes = requestedRoute ? [requestedRoute] : allRoutes
if (requestedRoute && !allRoutes.includes(requestedRoute)) {
  throw new Error(`goal93:unknown-runtime-route:${requestedRoute}`)
}
const viewports = [
  { key: 'desktop', width: 1360, height: 900 },
  { key: 'mobile', width: 390, height: 844 },
] as const
const axeSource = require.resolve('axe-core/axe.min.js')
const authStateFile = process.env.GOAL93_AUTH_STATE_FILE
if (!authStateFile) throw new Error('goal93:auth-state-file')

test.describe('Goal 93 — verklig Corevo-preview @goal93-runtime', () => {
  let authCookies: Awaited<ReturnType<BrowserContext['cookies']>> = []

  test.beforeAll(async ({ browser }) => {
    if (existsSync(authStateFile)) {
      authCookies = JSON.parse(readFileSync(authStateFile, 'utf8'))
      return
    }
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await loginBackoffice(page, SEED.platformAdmin)
      authCookies = await context.cookies()
      writeFileSync(authStateFile, JSON.stringify(authCookies))
    } finally {
      await context.close()
    }
  })

  for (const theme of loadGoal93Matrix().keys) {
    test(`${theme} renderar alla verkliga previewrutter`, async ({ page }) => {
      test.setTimeout(8 * 60_000)
      await page.context().addCookies(authCookies)
      await page.emulateMedia({ reducedMotion: 'reduce' })

      const consoleErrors: string[] = []
      const pageErrors: string[] = []
      const responseErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('response', (response) => {
        if (response.status() >= 400) {
          responseErrors.push(`${response.status()}:${response.url()}`)
        }
      })

      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        for (const route of routes) {
          await test.step(`${viewport.key} ${route}`, async () => {
            consoleErrors.length = 0
            pageErrors.length = 0
            responseErrors.length = 0
            const url = new URL(
              `/salong-preview/${SEED.tenant.slug}${route === '/' ? '' : route}`,
              BOOKING_HOST,
            )
            url.searchParams.set('theme', theme)

            const response = await page.goto(url.href, { waitUntil: 'networkidle' })
            expect.soft(response, `${theme}:${viewport.key}:${route}:response`).not.toBeNull()
            expect.soft(
              response?.status(),
              `${theme}:${viewport.key}:${route}:status`,
            ).toBeLessThan(400)
            await expect
              .soft(
                page.locator(`[data-world="storefront"][data-theme="${theme}"]`),
                `${theme}:${viewport.key}:${route}:theme`,
              )
              .toBeVisible()
            if (viewport.key === 'mobile') {
              await expect
                .soft(
                  page.locator('nav[aria-label="Huvudmeny"]'),
                  `${theme}:${viewport.key}:${route}:desktop-nav`,
                )
                .toHaveCSS('display', 'none')
              await expect
                .soft(
                  page.getByRole('button', { name: 'Öppna meny' }),
                  `${theme}:${viewport.key}:${route}:menu-button`,
                )
                .toBeVisible()
            }
            if (theme === 'calytrix') {
              await expect
                .soft(
                  page.locator('footer a[href="/kontakt"]'),
                  `${theme}:${viewport.key}:${route}:contact-link`,
                )
                .toHaveCount(1)
            }

            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            )
            expect.soft(
              overflow,
              `${theme}:${viewport.key}:${route}:overflow`,
            ).toBeLessThanOrEqual(1)

            await page.addScriptTag({ path: axeSource })
            const serious = await page.evaluate(async () => {
              const axe = (
                window as typeof window & {
                  axe: {
                    run: () => Promise<{
                      violations: Array<{
                        id: string
                        impact: string | null
                        help: string
                        nodes: Array<{
                          target: string[]
                          html: string
                          failureSummary?: string
                        }>
                      }>
                    }>
                  }
                }
              ).axe
              const result = await axe.run()
              return result.violations
                .filter((violation) =>
                  ['serious', 'critical'].includes(violation.impact ?? ''),
                )
                .map((violation) => ({
                  id: violation.id,
                  impact: violation.impact,
                  help: violation.help,
                  nodes: violation.nodes.slice(0, 20),
                }))
            })
            expect.soft(
              serious,
              `${theme}:${viewport.key}:${route}:axe`,
            ).toEqual([])
            expect.soft(
              consoleErrors,
              `${theme}:${viewport.key}:${route}:console`,
            ).toEqual([])
            expect.soft(pageErrors, `${theme}:${viewport.key}:${route}:page`).toEqual([])
            expect.soft(
              responseErrors,
              `${theme}:${viewport.key}:${route}:http`,
            ).toEqual([])
          })
        }
      }
    })
  }
})
