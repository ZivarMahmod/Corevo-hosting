// ce-optimize — restoran measurement harness (Stage 1 vitest + Stage 2 Playwright).
//
// Runnable FROM REPO ROOT:
//   node 5-Kod/apps/web/lib/sajtbyggare/_optimize/measure-restoran.mjs
//
// Emits ONE merged JSON object on STDOUT (everything else → stderr) with EXACTLY:
//   render_proof_failures, exact_token_mismatches, unresolved_module_markers,
//   editable_regions, modules_woven, section_coverage, dom_node_count,
//   missing_assets, _screenshots:{ours,vendor}
//
// METRIC ROLES (which keys an optimizer may gate on):
//   GATES (real, ungameable fidelity signal): render_proof_failures,
//     exact_token_mismatches, unresolved_module_markers, editable_regions,
//     modules_woven, section_coverage (STRUCTURAL detection only — see
//     detectSections in restoran-metrics.test.ts), missing_assets.
//   DESCRIPTIVE ONLY (NEVER threshold an experiment on it): dom_node_count —
//     counts opening tags, trivially inflatable by empty <div>s, no fidelity
//     meaning. Emitted for shape stability, not as a gate.
//
// Stage 1 (deterministic, always prints): run the metrics vitest → render-proof
//   + read .last-metrics.json for the structural metrics.
// Stage 2 (best-effort): dual STATIC Playwright render (OURS vs vendor) with ALL
//   scripts + external/CDN requests BLOCKED, full-page screenshots, and a
//   computed-style fidelity check on OURS (.btn-primary == restoran orange).
//   If Playwright throws, the deterministic keys still print; the Playwright-only
//   keys go null and `_stage2_error` is added.
//
// Hard rules: reads templates/restoran.ts as DATA, never mutates it; loads the
// vendor index.html read-only; no deploy; nothing leaves the machine.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const log = (...a) => console.error('[measure-restoran]', ...a)

const HERE = dirname(fileURLToPath(import.meta.url))                    // …/lib/sajtbyggare/_optimize
const APP_WEB = resolve(HERE, '..', '..', '..')                        // …/5-Kod/apps/web
const REPO_ROOT = resolve(APP_WEB, '..', '..', '..')                   // repo root
const PUBLIC_RESTORAN = join(APP_WEB, 'public', 'sajtbyggare', 'restoran')
const CSS_DIR = join(PUBLIC_RESTORAN, 'css')
const METRICS_PATH = join(HERE, '.last-metrics.json')
const SHOTS_DIR = join(REPO_ROOT, '4-Dokument-Underlag', 'skarmdumpar-bygg')
const OURS_PNG = join(SHOTS_DIR, 'restoran-ours.png')
const VENDOR_PNG = join(SHOTS_DIR, 'restoran-vendor.png')
const VENDOR_INDEX = join(
  REPO_ROOT,
  '4-Dokument-Underlag',
  '03-template-katalog',
  '23 restoran-1.0.0',
  'restoran-1.0.0',
  'index.html',
)

const RESTORAN_PRIMARY = 'rgb(254, 161, 22)' // restoran style.css --primary (#FEA116)
const KNOWN_MODULES = new Set(['booking', 'shop', 'offert', 'lojalitet', 'presentkort', 'blogg'])

// ── STAGE 1: run the metrics vitest → render_proof_failures ──────────────────
// Try the @corevo/web filter from 5-Kod first, then the local form from apps/web.
function runVitest() {
  const FIVE_KOD = resolve(APP_WEB, '..', '..')
  const rel = 'lib/sajtbyggare/_optimize/restoran-metrics.test.ts'
  const attempts = [
    {
      label: "from 5-Kod: pnpm --filter @corevo/web exec vitest run … --reporter=json",
      cwd: FIVE_KOD,
      cmd: 'pnpm',
      args: ['--filter', '@corevo/web', 'exec', 'vitest', 'run', rel, '--reporter=json'],
    },
    {
      label: 'from apps/web: pnpm exec vitest run … --reporter=json',
      cwd: APP_WEB,
      cmd: 'pnpm',
      args: ['exec', 'vitest', 'run', rel, '--reporter=json'],
    },
  ]
  for (const a of attempts) {
    log(`vitest attempt → ${a.label}`)
    const r = spawnSync(a.cmd, a.args, {
      cwd: a.cwd,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 64 * 1024 * 1024,
    })
    const stdout = r.stdout || ''
    const parsed = parseVitestJson(stdout)
    if (parsed) {
      log(`vitest invocation that worked: ${a.label} (cwd=${a.cwd})`)
      return { ...parsed, invocation: a.label, cwd: a.cwd }
    }
    log(`  → no parseable JSON (status ${r.status}); trying next`)
  }
  // Could not parse any reporter output → treat as a render-proof failure signal.
  log('WARNING: no vitest JSON parseable from either invocation; render_proof_failures=1')
  return { numFailedTests: 1, numTotalTests: null, invocation: null, cwd: null }
}

/** Extract the JSON report object from mixed stdout (vitest may prepend lines). */
function parseVitestJson(stdout) {
  if (!stdout) return null
  // Find the outermost JSON object that contains numFailedTests.
  const idx = stdout.indexOf('{')
  if (idx === -1) return null
  for (let start = idx; start !== -1; start = stdout.indexOf('{', start + 1)) {
    const slice = stdout.slice(start)
    try {
      const obj = JSON.parse(slice)
      if (obj && typeof obj === 'object' && 'numFailedTests' in obj) {
        return { numFailedTests: obj.numFailedTests ?? 0, numTotalTests: obj.numTotalTests ?? null }
      }
    } catch {
      // try a trimmed tail: maybe trailing non-JSON; attempt last balanced object
    }
  }
  // Fallback: try to locate the last balanced top-level object.
  const last = stdout.lastIndexOf('}')
  const first = stdout.indexOf('{')
  if (first !== -1 && last !== -1 && last > first) {
    try {
      const obj = JSON.parse(stdout.slice(first, last + 1))
      if (obj && 'numFailedTests' in obj) {
        return { numFailedTests: obj.numFailedTests ?? 0, numTotalTests: obj.numTotalTests ?? null }
      }
    } catch {
      /* give up */
    }
  }
  return null
}

// ── read structural metrics written by the vitest ───────────────────────────
function readMetrics() {
  if (!existsSync(METRICS_PATH)) {
    log('WARNING: .last-metrics.json missing — using zeros')
    return {}
  }
  try {
    return JSON.parse(readFileSync(METRICS_PATH, 'utf8'))
  } catch (e) {
    log('WARNING: .last-metrics.json unparseable:', e.message)
    return {}
  }
}

// ── extract RESTORAN_PAGE_HTML + CSS hrefs from the template (read as data) ──
function readTemplate() {
  const src = readFileSync(join(APP_WEB, 'lib', 'sajtbyggare', 'templates', 'restoran.ts'), 'utf8')
  const m = src.match(/export const RESTORAN_PAGE_HTML\s*=\s*`([\s\S]*?)`\.trim\(\)/)
  if (!m) throw new Error('could not extract RESTORAN_PAGE_HTML from templates/restoran.ts')
  return m[1].trim()
}

// ── build the OURS standalone HTML doc.
//    The doc is written INTO public/sajtbyggare/restoran/ (a temp .html) and
//    loaded via page.goto(file://…). Loading from that file:// origin is what
//    lets the sibling vendor CSS + img/ assets resolve — Chromium blocks file://
//    sub-resources from an about:blank (setContent) origin, so RELATIVE refs from
//    inside the restoran dir are used. The booking marker becomes a small STATIC
//    booking-surface stand-in; '/sajtbyggare/restoran/<x>' refs collapse to '<x>'. ──
function buildOursDoc(pageHtml) {
  const cssBootstrap = 'css/bootstrap.min.css'
  const cssStyle = 'css/style.css'

  // Static stand-in for the live <corevo-module type="booking"> (a bootstrap
  // reservation form mirroring the vendor's; NOT the real module — the live
  // module is mounted client-side and is intentionally script-blocked here).
  const bookingStandIn = `
    <!-- STATIC stand-in for <corevo-module type="booking"> (live module mounts client-side; scripts are blocked in this static render) -->
    <form class="corevo-booking-standin">
      <div class="row g-3">
        <div class="col-md-6"><div class="form-floating">
          <input type="text" class="form-control" id="name" placeholder="Your Name">
          <label for="name">Your Name</label></div></div>
        <div class="col-md-6"><div class="form-floating">
          <input type="email" class="form-control" id="email" placeholder="Your Email">
          <label for="email">Your Email</label></div></div>
        <div class="col-md-6"><div class="form-floating">
          <input type="date" class="form-control" id="date" placeholder="Date">
          <label for="date">Date</label></div></div>
        <div class="col-md-6"><div class="form-floating">
          <select class="form-select" id="party"><option>People 1</option><option>People 2</option><option>People 3</option></select>
          <label for="party">No Of People</label></div></div>
        <div class="col-12">
          <button class="btn btn-primary w-100 py-3" type="button">Book A Table</button>
        </div>
      </div>
    </form>`

  let body = pageHtml.replace(/<corevo-module\b[^>]*><\/corevo-module>/g, bookingStandIn)
  // any self-closing form: also handle a non-paired marker just in case
  body = body.replace(/<corevo-module\b[^>]*\/>/g, bookingStandIn)

  // rewrite '/sajtbyggare/restoran/<x>' asset refs → relative '<x>' (the doc is
  // served from inside public/sajtbyggare/restoran/, so img/… resolves directly).
  body = body.replace(/(["'(])\/sajtbyggare\/restoran\//g, (_m, p1) => p1)

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restoran (OURS) — sajtbyggare static render</title>
  <link rel="stylesheet" href="${cssBootstrap}">
  <link rel="stylesheet" href="${cssStyle}">
</head>
<body data-tenant="pilot" class="corevo-tpl-scope">
${body}
</body>
</html>`
}

// ── Stage 2: dual Playwright static render ───────────────────────────────────
async function renderStage2(oursDoc) {
  // import @playwright/test's chromium (installed under 5-Kod), like verify_render.mjs
  const { chromium } = await import('@playwright/test')

  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true })

  const browser = await chromium.launch()
  const result = {
    exact_token_mismatches: null,
    missing_assets: null,
    btnBg: null,
    bodyFont: null,
    sectionTitleColor: null,
  }
  // Temp doc written INTO the restoran public dir so file:// sub-resources resolve.
  const oursTmp = join(PUBLIC_RESTORAN, '_ours-static-render.html')
  try {
    writeFileSync(oursTmp, oursDoc, 'utf8')

    // ---- OURS ----
    const oursMissing = await (async () => {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      let missing = 0
      // Block ALL scripts + any external/CDN (non-file://) requests; allow file://.
      await page.route('**/*', (route) => {
        const req = route.request()
        const url = req.url()
        const type = req.resourceType()
        if (type === 'script') return route.abort()
        if (!url.startsWith('file:') && !url.startsWith('data:')) return route.abort()
        return route.continue()
      })
      // Count non-script asset (img/stylesheet/font) requests that 404 / fail to load.
      page.on('requestfailed', (req) => {
        if (req.resourceType() !== 'script') missing++
      })
      page.on('response', (resp) => {
        const t = resp.request().resourceType()
        if (t !== 'script' && resp.status() >= 400) missing++
      })
      await page.goto(pathToFileURL(oursTmp).href, { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(300)
      const probe = await page.evaluate(() => {
        const btn = document.querySelector('.btn-primary')
        // .section-title carries text-primary in OUR reservation block; its
        // computed color must be the restoran orange too (a canonical token
        // beyond the button background).
        const sectionTitle = document.querySelector('.section-title')
        return {
          btnBg: btn ? getComputedStyle(btn).backgroundColor : null,
          bodyFont: getComputedStyle(document.body).fontFamily || '',
          sectionTitleColor: sectionTitle ? getComputedStyle(sectionTitle).color : null,
        }
      })
      result.btnBg = probe.btnBg
      result.bodyFont = probe.bodyFont
      result.sectionTitleColor = probe.sectionTitleColor
      await page.screenshot({ path: OURS_PNG, fullPage: true })
      await ctx.close()
      return missing
    })()

    // computed-style deviations on OURS — a few canonical restoran tokens beyond
    // the button background, so a real CSS regression in colours/fonts is caught.
    let deviations = 0
    if (result.btnBg !== RESTORAN_PRIMARY) {
      deviations++
      log(`computed-style deviation: .btn-primary backgroundColor = ${result.btnBg} (expected ${RESTORAN_PRIMARY})`)
    }
    // .section-title (text-primary) must compute to the same restoran orange.
    if (result.sectionTitleColor !== RESTORAN_PRIMARY) {
      deviations++
      log(`computed-style deviation: .section-title color = ${result.sectionTitleColor} (expected ${RESTORAN_PRIMARY})`)
    }
    // body font-family must be non-empty AND resolve to the restoran body font.
    const bodyFontLc = (result.bodyFont || '').toLowerCase()
    if (!bodyFontLc || bodyFontLc.trim().length === 0) {
      deviations++
      log('computed-style deviation: body font-family is empty')
    } else if (!bodyFontLc.includes('heebo')) {
      deviations++
      log(`computed-style deviation: body font-family = "${result.bodyFont}" (expected to include restoran "Heebo")`)
    }

    // exact_token_mismatches = max(text-level count from .last-metrics.json, computed deviations)
    const textLevel = Number(readMetrics().exact_token_mismatches ?? 0)
    result.exact_token_mismatches = Math.max(textLevel, deviations)
    result.missing_assets = oursMissing

    // ---- VENDOR ---- (load index.html via file://; assets resolve relatively)
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await page.route('**/*', (route) => {
        const req = route.request()
        const url = req.url()
        if (req.resourceType() === 'script') return route.abort()
        if (!url.startsWith('file:') && !url.startsWith('data:')) return route.abort()
        return route.continue()
      })
      await page.goto(pathToFileURL(VENDOR_INDEX).href, { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(300)
      await page.screenshot({ path: VENDOR_PNG, fullPage: true })
      await ctx.close()
    }
  } finally {
    await browser.close()
    try {
      rmSync(oursTmp, { force: true })
    } catch {
      /* best-effort cleanup */
    }
  }
  return result
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  // STAGE 1 (deterministic)
  const vitest = runVitest()
  const metrics = readMetrics()

  const merged = {
    render_proof_failures: vitest.numFailedTests ?? 0,
    exact_token_mismatches: Number(metrics.exact_token_mismatches ?? 0),
    unresolved_module_markers: Number(metrics.unresolved_module_markers ?? 0),
    editable_regions: Number(metrics.editable_regions ?? 0),
    modules_woven: Number(metrics.modules_woven ?? 0),
    section_coverage: Number(metrics.section_coverage ?? 0),
    dom_node_count: Number(metrics.dom_node_count ?? 0),
    missing_assets: 0,
    _screenshots: { ours: null, vendor: null },
  }

  log(`stage-1 metrics: render_proof_failures=${merged.render_proof_failures}, modules_woven=${merged.modules_woven}, editable_regions=${merged.editable_regions}, section_coverage=${merged.section_coverage}, dom_node_count=${merged.dom_node_count}`)

  // STAGE 2 (best-effort Playwright)
  try {
    const pageHtml = readTemplate()
    const oursDoc = buildOursDoc(pageHtml)
    const s2 = await renderStage2(oursDoc)
    merged.exact_token_mismatches = s2.exact_token_mismatches
    merged.missing_assets = s2.missing_assets
    merged._screenshots = { ours: OURS_PNG, vendor: VENDOR_PNG }
    log(`stage-2 ok: btnBg=${s2.btnBg}, sectionTitleColor=${s2.sectionTitleColor}, bodyFont="${s2.bodyFont}", missing_assets=${s2.missing_assets}, exact_token_mismatches=${s2.exact_token_mismatches}`)
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    log('STAGE-2 ERROR (Playwright):', msg)
    merged.exact_token_mismatches = null
    merged.missing_assets = null
    merged._screenshots = null
    merged._stage2_error = msg
  }

  // STDOUT = the merged JSON ONLY.
  process.stdout.write(JSON.stringify(merged, null, 2) + '\n')
}

main().catch((err) => {
  // Last-ditch: never crash without emitting the deterministic shape.
  const msg = err && err.message ? err.message : String(err)
  log('FATAL:', msg)
  const metrics = readMetrics()
  process.stdout.write(
    JSON.stringify(
      {
        render_proof_failures: 1,
        exact_token_mismatches: null,
        unresolved_module_markers: Number(metrics.unresolved_module_markers ?? 0),
        editable_regions: Number(metrics.editable_regions ?? 0),
        modules_woven: Number(metrics.modules_woven ?? 0),
        section_coverage: Number(metrics.section_coverage ?? 0),
        dom_node_count: Number(metrics.dom_node_count ?? 0),
        missing_assets: null,
        _screenshots: null,
        _stage2_error: msg,
      },
      null,
      2,
    ) + '\n',
  )
  process.exit(0)
})
