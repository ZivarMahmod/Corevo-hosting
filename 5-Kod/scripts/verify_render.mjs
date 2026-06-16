// S0 F6 — verify_render (offline; NEVER runs in the Worker).
//
// The reusable "deploy -> script proves it landed right" gate. Given a DEPLOYED
// sajtbyggare-spike URL it asserts, against the real rendered DOM on the Workers
// surface:
//   1. the page renders (title + restoran hero present)
//   2. the imported vendor CSS loaded (rough fidelity: .btn-primary == restoran orange)
//   3. the <corevo-module> marker was woven into a REAL module
//      ([data-corevo-module="booking"] present — the source marker is consumed by the
//       parser, so we assert the rendered attribute, not the marker)
//   4. the module rendered REAL DB data (a known seeded service name is visible)
//   5. zero console errors
//
// Usage:  node scripts/verify_render.mjs [url] [expectedServiceName]
//   default url = the staging spike for tenant test-barber.
// Exit 0 = all green, 1 = any failure. Run from 5-Kod (uses @playwright/test's chromium).
import { chromium } from '@playwright/test'

const URL =
  process.argv[2] ||
  'https://bokningsplatformen-staging.zivar68.workers.dev/sajtbyggare-spike/test-barber'

// Expected fidelity/marker signals. Override service name via argv[3] for other tenants.
const EXPECT_SERVICE = process.argv[3] || 'Klippning herr'
const RESTORAN_PRIMARY = 'rgb(254, 161, 22)' // restoran style.css --primary (orange)

const checks = []
const record = (name, pass, detail) => checks.push({ name, pass: !!pass, detail })

const browser = await chromium.launch()
const page = await browser.newPage()
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

try {
  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  record('HTTP 200', resp && resp.status() === 200, `status ${resp && resp.status()}`)

  const data = await page.evaluate(() => {
    const btn = document.querySelector('.btn-primary')
    const booking = document.querySelector('[data-corevo-module="booking"]')
    return {
      title: document.title,
      heroText: (document.querySelector('.display-3, .hero-header h1')?.textContent || '').trim(),
      btnBg: btn ? getComputedStyle(btn).backgroundColor : null,
      bookingPresent: !!booking,
      bodyText: document.body.innerText,
      missingMarkers: document.querySelectorAll('[data-corevo-module-missing]').length,
    }
  })

  record('Title present', /sajtbyggare|spike|restoran/i.test(data.title), data.title)
  record('Restoran hero rendered', /Delicious Meal|Enjoy Our/i.test(data.heroText), data.heroText)
  record('Vendor CSS loaded (.btn-primary = restoran orange)', data.btnBg === RESTORAN_PRIMARY, data.btnBg)
  record('Booking module woven ([data-corevo-module="booking"])', data.bookingPresent)
  record('No orphaned module markers', data.missingMarkers === 0, `missing=${data.missingMarkers}`)
  record(`Real DB data rendered ("${EXPECT_SERVICE}")`, data.bodyText.includes(EXPECT_SERVICE))
  record('Zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
} catch (err) {
  record('Navigation/eval', false, String(err && err.message ? err.message : err))
} finally {
  await browser.close()
}

const failed = checks.filter((c) => !c.pass)
console.log(`\nverify_render → ${URL}\n`)
for (const c of checks) {
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`)
}
console.log(`\n${failed.length === 0 ? 'ALL GREEN' : `${failed.length} FAILED`} (${checks.length} checks)\n`)
process.exit(failed.length === 0 ? 0 : 1)
