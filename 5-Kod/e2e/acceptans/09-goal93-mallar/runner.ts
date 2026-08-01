import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

export type Goal93MatrixRow = {
  id: string
  themeKey: string
  designBranch: string
  vertical: string
  pageKey: string
  route: string
  module: string | null
  requiredModules: string[]
  viewport: { key: 'desktop' | 'mobile'; width: number }
  state: 'full' | 'off-empty' | 'paused'
}

export type Goal93MatrixPayload = {
  goal: 93
  mode: 'contract'
  previewRef: null
  themeCount: number
  routeCount: number
  matrixCount: number
  keys: string[]
  designFiles: Array<{ key: string; file: string }>
  viewports: Array<{ key: 'desktop' | 'mobile'; width: number }>
  matrix: Goal93MatrixRow[]
}

type BrowserTarget = { projectRef: string; url: string }
type DesignServer = { origin: string; close: () => Promise<void> }
type BrowserFailures = {
  console: string[]
  page: string[]
  request: string[]
  response: string[]
}

const GOAL_DIR = path.resolve(__dirname)
const CODE_DIR = path.resolve(GOAL_DIR, '..', '..', '..')
const WEB_DIR = path.join(CODE_DIR, 'apps', 'web')
const CATALOG_SCRIPT = path.join(WEB_DIR, 'scripts', 'goal93-catalog-acceptance.mjs')
const DESIGN_DIR = path.join(
  path.resolve(CODE_DIR, '..'),
  '4-Dokument-Underlag',
  '01-acceptans',
  'handoff mallar',
)
const SUPPORT_FILE = path.join(
  path.resolve(CODE_DIR, '..'),
  '4-Dokument-Underlag',
  '01-acceptans',
  'super-admin',
  'handoff-2026-07-13',
  'handoff-superadmin',
  'design',
  'support.js',
)
const PROJECT_REF_FILE = path.join(CODE_DIR, 'supabase', '.temp', 'project-ref')
const BASELINE_DIR = path.join(GOAL_DIR, 'baselines')
const PREVIEW_REF = 'cwnhpesrgolflkmyjbrm'
const PRODUCTION_REF = 'clylvowtowbtotrahuad'
const REACT_URL = 'https://unpkg.com/react@18.3.1/umd/react.production.min.js'
const REACT_DOM_URL = 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
const CAPTURE_DESIGN_SOURCE = process.env.GOAL93_CAPTURE_DESIGN_SOURCE === '1'

let matrixCache: Goal93MatrixPayload | null = null
let vendorPromise: Promise<Map<string, Buffer>> | null = null

const AXE_SOURCE_FILE: string | null = (() => {
  try {
    return require.resolve('axe-core/axe.min.js')
  } catch {
    return null
  }
})()
export const AXE_GATE: 'BLOCKED' | 'AVAILABLE' = AXE_SOURCE_FILE ? 'AVAILABLE' : 'BLOCKED'

export function loadGoal93Matrix(): Goal93MatrixPayload {
  if (matrixCache) return matrixCache
  const result = spawnSync(process.execPath, [CATALOG_SCRIPT, '--contract', '--json'], {
    cwd: WEB_DIR,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`goal93:matrix-loader:${String(result.stderr || result.stdout).trim()}`)
  }
  try {
    matrixCache = JSON.parse(result.stdout) as Goal93MatrixPayload
  } catch {
    throw new Error('goal93:matrix-loader:invalid-json')
  }
  if (
    matrixCache.goal !== 93 ||
    matrixCache.matrixCount !== matrixCache.matrix.length ||
    matrixCache.themeCount !== matrixCache.keys.length
  ) {
    throw new Error('goal93:matrix-loader:invalid-contract')
  }
  return matrixCache
}

export function assertSafeBrowserTarget(target: BrowserTarget): BrowserTarget {
  const ref = String(target.projectRef ?? '').trim()
  const rawUrl = String(target.url ?? '').trim()
  if (ref === PRODUCTION_REF || rawUrl.includes(PRODUCTION_REF)) {
    throw new Error('goal93:production-ref')
  }
  if (ref !== PREVIEW_REF) throw new Error(`goal93:preview-ref:${ref || '<missing>'}`)
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('goal93:browser-url')
  }
  if (
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    !['http:', 'https:'].includes(parsed.protocol)
  ) {
    throw new Error(`goal93:nonlocal-browser-target:${parsed.hostname}`)
  }
  return { projectRef: ref, url: parsed.origin }
}

function baselineRelativePath(row: Goal93MatrixRow): string {
  return path.join(row.themeKey, `goal93-${row.id}.png`)
}

export function expectedDesignBaselines(matrix: Goal93MatrixRow[]): string[] {
  return matrix
    .filter((row) => row.state === 'full')
    .map(baselineRelativePath)
    .sort()
}

function walkPngFiles(root: string, relative = ''): string[] {
  if (!existsSync(root)) return []
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const nextRelative = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...walkPngFiles(path.join(root, entry.name), nextRelative))
    else if (entry.isFile() && entry.name.endsWith('.png')) files.push(nextRelative)
  }
  return files
}

export function assertBaselineInventory(expected: string[], actual: string[]): void {
  const normalize = (value: string) => value.replaceAll('\\', '/')
  const actualSet = new Set(actual.map(normalize))
  const missing = expected.map(normalize).filter((file) => !actualSet.has(file))
  if (missing.length > 0) {
    throw new Error(`goal93:baseline-missing:${missing.length}:${missing.slice(0, 3).join(',')}`)
  }
}

export function wrapperInventory(goalDir: string, keys: string[]) {
  const expected = new Set(keys)
  const directories = existsSync(goalDir)
    ? readdirSync(goalDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !['artifacts', 'baselines'].includes(name))
    : []
  const actual = new Set(directories)
  const pairs = keys.map((key) => ({
    key,
    spec: path.join(goalDir, key, `${key}.accept.spec.ts`),
    probe: path.join(goalDir, key, 'probe.js'),
  }))
  const missing = pairs
    .flatMap((pair) => [pair.spec, pair.probe])
    .filter((file) => !existsSync(file))
  const extra = [...actual].filter((key) => !expected.has(key)).sort()
  return { pairs, missing, extra }
}

async function loadVendors(): Promise<Map<string, Buffer>> {
  if (vendorPromise) return vendorPromise
  vendorPromise = (async () => {
    const resources = new Map<string, Buffer>()
    for (const url of [REACT_URL, REACT_DOM_URL]) {
      const response = await fetch(url, { redirect: 'follow' })
      if (!response.ok) throw new Error(`goal93:vendor-http:${response.status}:${url}`)
      resources.set(url, Buffer.from(await response.arrayBuffer()))
    }
    return resources
  })()
  return vendorPromise
}

function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function exposeDesignLogicToHarness(source: string): string {
  const anchor = 'this.logic.__host = this;'
  if (!source.includes(anchor)) throw new Error('goal93:dc-runtime-bridge-anchor')
  return source.replace(
    anchor,
    `${anchor}
        (window.__goal93DcLogicInstances ||= Object.create(null))[this.__name] = this.logic;`,
  )
}

function injectRuntime(
  source: string,
  origin: string,
  row: Goal93MatrixRow,
  support: string,
): string {
  const resources = {
    [REACT_URL]: `${origin}/__goal93/react.js`,
    [REACT_DOM_URL]: `${origin}/__goal93/react-dom.js`,
  }
  const bootstrap = `
(() => {
  const target = ${scriptSafeJson({
    pageKey: row.pageKey,
    route: row.route,
    state: row.state,
    module: row.module,
  })};
  window.__goal93Harness = target;
  const started = performance.now();
  const open = () => {
    try {
      const root = window.getDC && window.getDC('Root');
      const logic = window.__goal93DcLogicInstances && window.__goal93DcLogicInstances.Root;
      if (root && typeof root.go !== 'function' && logic && typeof logic.go === 'function') {
        Object.defineProperty(root, 'go', {
          configurable: true,
          value: logic.go.bind(logic),
        });
      }
      if (!root || typeof root.go !== 'function') {
        if (performance.now() - started > 15000) throw new Error('goal93:dc-root-timeout');
        setTimeout(open, 20);
        return;
      }
      root.go(target.pageKey);
      const markReady = () => {
        const active = window.__goal93DcLogicInstances && window.__goal93DcLogicInstances.Root;
        if (!active || !active.state || active.state.page !== target.pageKey) {
          if (performance.now() - started > 15000) throw new Error('goal93:dc-page-timeout');
          setTimeout(markReady, 20);
          return;
        }
        document.documentElement.dataset.goal93Page = target.pageKey;
        document.documentElement.dataset.goal93Route = target.route;
        document.documentElement.dataset.goal93State = target.state;
        document.documentElement.dataset.goal93Module = target.module || 'none';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.documentElement.dataset.goal93Ready = 'true';
        }));
      };
      markReady();
    } catch (error) {
      window.__goal93HarnessError = String(error && error.message || error);
      console.error(window.__goal93HarnessError);
    }
  };
  open();
})();
`
  const injection = [
    `<base href="${origin}/Root.dc.html">`,
    `<script>window.__resources=${scriptSafeJson(resources)};</script>`,
    `<style id="goal93-stability">
      *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
      input,textarea{caret-color:transparent!important}
    </style>`,
    `<script>${exposeDesignLogicToHarness(support).replaceAll('</script', '<\\/script')}</script>`,
    `<script>${bootstrap.replaceAll('</script', '<\\/script')}</script>`,
  ].join('\n')
  if (!source.includes('</head>')) throw new Error('goal93:design-head-missing')
  return source.replace('</head>', `${injection}\n</head>`)
}

function designAsset(requestPath: string): { body: Buffer; contentType: string } | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(requestPath)
  } catch {
    return null
  }
  const relative = decoded.replace(/^\/+/, '')
  if (!relative || relative.endsWith('.dc.html') || relative.endsWith('.html')) return null
  const absolute = path.resolve(DESIGN_DIR, relative)
  if (!absolute.startsWith(`${path.resolve(DESIGN_DIR)}${path.sep}`)) return null
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null
  const extension = path.extname(absolute).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  }
  const contentType = contentTypes[extension]
  if (!contentType) return null
  return { body: readFileSync(absolute), contentType }
}

async function startDesignServer(payload: Goal93MatrixPayload): Promise<DesignServer> {
  const vendors = await loadVendors()
  const support = readFileSync(SUPPORT_FILE, 'utf8')
  const designFiles = new Map(payload.designFiles.map((entry) => [entry.key, entry.file]))
  const rowIds = new Set(payload.matrix.map((row) => row.id))
  let origin = ''
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', origin || 'http://127.0.0.1')
    if (requestUrl.pathname === '/__goal93/react.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
      response.end(vendors.get(REACT_URL))
      return
    }
    if (requestUrl.pathname === '/__goal93/react-dom.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
      response.end(vendors.get(REACT_DOM_URL))
      return
    }
    const asset = designAsset(requestUrl.pathname)
    if (asset) {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': asset.contentType,
      })
      response.end(asset.body)
      return
    }
    const id = requestUrl.searchParams.get('goal93Row')
    const row = payload.matrix.find((candidate) => candidate.id === id)
    if (!row || !rowIds.has(row.id) || requestUrl.pathname !== row.route) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('goal93:not-found')
      return
    }
    const sourceFile = designFiles.get(row.themeKey)
    if (!sourceFile) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('goal93:design-source-missing')
      return
    }
    const source = readFileSync(path.join(DESIGN_DIR, sourceFile), 'utf8')
    const html = injectRuntime(source, origin, row, support)
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'x-goal93-design-source': row.themeKey,
    })
    response.end(html)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  origin = `http://127.0.0.1:${address.port}`
  return {
    origin,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

function monitorFailures(page: Page): BrowserFailures {
  const failures: BrowserFailures = { console: [], page: [], request: [], response: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') failures.console.push(message.text())
  })
  page.on('pageerror', (error) => failures.page.push(error.message))
  page.on('requestfailed', (request) => {
    failures.request.push(
      `${request.resourceType()}:${request.url()}:${request.failure()?.errorText}`,
    )
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failures.response.push(`${response.status()}:${response.url()}`)
  })
  return failures
}

async function openDesignRow(
  page: Page,
  row: Goal93MatrixRow,
  server: DesignServer,
): Promise<BrowserFailures> {
  const failures = monitorFailures(page)
  await page.setViewportSize({
    width: row.viewport.width,
    height: row.viewport.key === 'mobile' ? 844 : 900,
  })
  const url = new URL(row.route, server.origin)
  url.searchParams.set('goal93Row', row.id)
  const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  expect(response, `${row.id}: document response`).not.toBeNull()
  expect(response!.status(), `${row.id}: HTTP status`).toBeLessThan(400)
  expect(new URL(page.url()).pathname, `${row.id}: route`).toBe(row.route)
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.goal93Ready === 'true' ||
      Boolean((window as typeof window & { __goal93HarnessError?: string }).__goal93HarnessError),
    undefined,
    { timeout: 20_000 },
  )
  const harnessError = await page.evaluate(
    () => (window as typeof window & { __goal93HarnessError?: string }).__goal93HarnessError,
  )
  expect(harnessError, `${row.id}: DC runtime`).toBeUndefined()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle', { timeout: 20_000 })
  await page.waitForTimeout(50)
  expect(
    await page.getAttribute('html', 'data-goal93-page'),
    `${row.id}: selected design page`,
  ).toBe(row.pageKey)
  expect(await page.getAttribute('html', 'data-goal93-state')).toBe(row.state)
  return failures
}

async function assertMinimalAccessibility(page: Page, row: Goal93MatrixRow): Promise<void> {
  const audit = await page.evaluate((mobile) => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      )
    }
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        'a,button,input,select,textarea,[role="button"],[tabindex="0"]',
      ),
    ].filter(visible)
    const nameFor = (element: HTMLElement) => {
      const labelledBy = element.getAttribute('aria-labelledby')
      const labelledText = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
        : ''
      const ownLabel =
        element.id &&
        document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(element.id)}"]`)
          ?.textContent
      return (
        element.getAttribute('aria-label') ||
        labelledText ||
        ownLabel ||
        element.textContent ||
        element.getAttribute('title') ||
        element.getAttribute('placeholder') ||
        ''
      ).trim()
    }
    const nameless = controls
      .filter((control) => !nameFor(control))
      .map((control) => control.outerHTML.slice(0, 120))
    const duplicateIds = [...document.querySelectorAll<HTMLElement>('[id]')]
      .map((element) => element.id)
      .filter((id, index, all) => id && all.indexOf(id) !== index)
    const invalidErrorLinks = [
      ...document.querySelectorAll<HTMLElement>('[aria-invalid="true"][aria-describedby]'),
    ]
      .filter((element) =>
        element
          .getAttribute('aria-describedby')!
          .split(/\s+/)
          .some((id) => !document.getElementById(id)),
      )
      .map((element) => element.outerHTML.slice(0, 120))
    const positiveTabIndex = controls
      .filter((control) => control.tabIndex > 0)
      .map((control) => control.outerHTML.slice(0, 120))
    const undersizedTouchTargets = mobile
      ? controls
          .filter((control) => {
            const style = getComputedStyle(control)
            return (
              control.matches(
                'a[href],button,input,select,textarea,[role="button"],[tabindex="0"]',
              ) || style.cursor === 'pointer'
            )
          })
          .map((control) => {
            const box = control.getBoundingClientRect()
            return {
              width: box.width,
              height: box.height,
              source: control.outerHTML.slice(0, 120),
            }
          })
          .filter((target) => target.width < 44 || target.height < 44)
      : []
    return {
      nameless,
      duplicateIds: [...new Set(duplicateIds)],
      invalidErrorLinks,
      positiveTabIndex,
      undersizedTouchTargets,
    }
  }, row.viewport.key === 'mobile')
  expect(audit.nameless, `${row.id}: accessible names`).toEqual([])
  expect(audit.duplicateIds, `${row.id}: duplicate ids`).toEqual([])
  expect(audit.invalidErrorLinks, `${row.id}: error linkage`).toEqual([])
  expect(audit.positiveTabIndex, `${row.id}: keyboard order`).toEqual([])
  expect(audit.undersizedTouchTargets, `${row.id}: mobile target size`).toEqual([])
}

async function assertKeyboardFocus(page: Page, row: Goal93MatrixRow): Promise<void> {
  const focusable = page.locator(
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
  )
  const count = await focusable.count()
  if (count === 0) return
  await page.keyboard.press('Tab')
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element || element === document.body) return null
    const style = getComputedStyle(element)
    return {
      tag: element.tagName,
      outline: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      shadow: style.boxShadow,
    }
  })
  expect(focus, `${row.id}: keyboard focus target`).not.toBeNull()
  expect(
    focus!.outline !== 'none' ||
      focus!.outlineWidth !== '0px' ||
      (focus!.shadow !== 'none' && focus!.shadow !== ''),
    `${row.id}: visible focus`,
  ).toBe(true)
}

async function exerciseRepresentativeAction(
  page: Page,
  row: Goal93MatrixRow,
  failures: BrowserFailures,
): Promise<void> {
  const control = page.locator('#dc-root button:visible').first()
  if ((await control.count()) === 0) return
  const before = await page.locator('#dc-root').innerText()
  const errorCount = failures.console.length + failures.page.length
  await control.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(50)
  const after = await page.locator('#dc-root').innerText()
  const focused = await control
    .evaluate((element) => document.activeElement === element)
    .catch(() => false)
  expect(after !== before || focused, `${row.id}: representative action`).toBe(true)
  expect(failures.console.length + failures.page.length, `${row.id}: interaction errors`).toBe(
    errorCount,
  )
}

async function assertAxe(page: Page, testInfo: TestInfo, row: Goal93MatrixRow): Promise<void> {
  if (AXE_GATE === 'BLOCKED') {
    testInfo.annotations.push({
      type: 'axe',
      description: 'BLOCKED: axe-core saknas; minimal inbyggd a11y körd.',
    })
    await testInfo.attach('axe-gate.txt', {
      body: Buffer.from(`BLOCKED ${row.id}: axe-core saknas\n`),
      contentType: 'text/plain',
    })
    return
  }

  await page.addScriptTag({ path: AXE_SOURCE_FILE! })
  const violations = await page.evaluate(async () => {
    type AxeResult = {
      violations: Array<{
        id: string
        impact: string | null
        help: string
        nodes: Array<{ target: string[]; failureSummary?: string }>
      }>
    }
    const axe = (
      window as typeof window & {
        axe?: { run: (root: Document) => Promise<AxeResult> }
      }
    ).axe
    if (!axe) {
      return [
        {
          id: 'axe-runtime-missing',
          impact: 'critical',
          help: 'axe-core kunde inte startas',
          nodes: [],
        },
      ]
    }
    const result = await axe.run(document)
    return result.violations
      .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 5).map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }))
  })
  testInfo.annotations.push({
    type: 'axe',
    description: `PASS: serious/critical=${violations.length}`,
  })
  expect(violations, `${row.id}: Axe serious/critical`).toEqual([])
}

export function registerThemeAcceptance(themeKey: string): void {
  const payload = loadGoal93Matrix()
  if (!payload.keys.includes(themeKey)) throw new Error(`goal93:unknown-theme:${themeKey}`)
  const rows = payload.matrix.filter((row) => row.themeKey === themeKey)
  const stateRepresentatives = new Set(
    rows
      .filter((row) => row.state !== 'full')
      .map((row) => `${row.themeKey}:${row.pageKey}:${row.module}`),
  )
  let designServer: DesignServer
  let context: BrowserContext

  test.describe(`${themeKey} — Goal 93 design source @goal93-browser`, () => {
    test.beforeAll(async ({ browser }) => {
      const projectRef = readFileSync(PROJECT_REF_FILE, 'utf8').trim()
      assertSafeBrowserTarget({ projectRef, url: 'http://127.0.0.1:41793' })
      if (!CAPTURE_DESIGN_SOURCE) {
        const expected = expectedDesignBaselines(rows)
        const actual = walkPngFiles(BASELINE_DIR)
        assertBaselineInventory(expected, actual)
      }
      designServer = await startDesignServer(payload)
      context = await browser.newContext({
        locale: 'sv-SE',
        timezoneId: 'Europe/Stockholm',
        reducedMotion: 'reduce',
      })
    })

    test.afterAll(async () => {
      await context?.close()
      await designServer?.close()
    })

    for (const row of rows) {
      test(`${row.id} route=${row.route} module=${row.module ?? 'none'}`, async ({}, testInfo) => {
        test.setTimeout(45_000)
        const page = await context.newPage()
        try {
          const failures = await openDesignRow(page, row, designServer)
          const root = page.locator('#dc-root')
          await expect(root, `${row.id}: root landmark`).toBeVisible()
          expect(
            (await root.innerText()).trim().length,
            `${row.id}: expected copy`,
          ).toBeGreaterThan(20)
          const overflow = await page.evaluate(() => {
            const amount = document.documentElement.scrollWidth - window.innerWidth
            const shell = [
              document.documentElement,
              document.body,
              document.querySelector('#dc-root'),
              document.querySelector('#dc-root > .sc-host'),
              document.querySelector('#dc-root > .sc-host > *'),
              document.querySelector('#dc-root aside'),
              document.querySelector('#dc-root main'),
            ]
              .filter((element): element is HTMLElement => element instanceof HTMLElement)
              .map((element) => {
                const box = element.getBoundingClientRect()
                return {
                  tag: element.tagName.toLowerCase(),
                  className: element.className,
                  left: Math.round(box.left),
                  right: Math.round(box.right),
                  width: Math.round(box.width),
                  scrollWidth: element.scrollWidth,
                }
              })
            const elements = [...document.querySelectorAll<HTMLElement>('#dc-root *')]
              .map((element) => {
                const box = element.getBoundingClientRect()
                return {
                  right: Math.round(box.right),
                  source: element.outerHTML.slice(0, 140),
                }
              })
              .filter((entry) => entry.right > window.innerWidth + 1)
              .sort((left, right) => right.right - left.right)
              .slice(0, 3)
            return {
              amount,
              elements,
              shell,
              viewport: {
                clientWidth: document.documentElement.clientWidth,
                innerWidth: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
              },
            }
          })
          expect(
            overflow.amount,
            `${row.id}: horizontal overflow ${JSON.stringify({
              viewport: overflow.viewport,
              shell: overflow.shell,
              elements: overflow.elements,
            })}`,
          ).toBeLessThanOrEqual(1)
          await assertMinimalAccessibility(page, row)
          await assertAxe(page, testInfo, row)
          expect(failures.console, `${row.id}: console errors`).toEqual([])
          expect(failures.page, `${row.id}: page errors`).toEqual([])
          expect(failures.request, `${row.id}: blocked resources`).toEqual([])
          expect(failures.response, `${row.id}: HTTP resource errors`).toEqual([])

          if (row.state === 'full') {
            const baseline = path.join(BASELINE_DIR, baselineRelativePath(row))
            if (CAPTURE_DESIGN_SOURCE && !existsSync(baseline)) {
              mkdirSync(path.dirname(baseline), { recursive: true })
              await page.screenshot({
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
                path: baseline,
              })
              testInfo.annotations.push({
                type: 'visual',
                description: 'captured missing design source baseline',
              })
            } else {
              await expect(page).toHaveScreenshot([row.themeKey, `goal93-${row.id}.png`], {
                animations: 'disabled',
                caret: 'hide',
                fullPage: true,
              })
              testInfo.annotations.push({
                type: 'visual',
                description: 'design source baseline',
              })
            }
          } else {
            testInfo.annotations.push({
              type: 'visual',
              description: 'not-applicable: central module FSM row',
            })
          }

          await assertKeyboardFocus(page, row)
          if (
            row.state === 'full' &&
            row.viewport.key === 'desktop' &&
            row.module &&
            stateRepresentatives.has(`${row.themeKey}:${row.pageKey}:${row.module}`)
          ) {
            await exerciseRepresentativeAction(page, row, failures)
          }
        } finally {
          await page.close()
        }
      })
    }
  })
}
