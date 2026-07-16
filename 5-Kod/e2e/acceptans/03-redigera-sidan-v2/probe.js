const { spawnSync } = require('node:child_process')
const path = require('node:path')

const contractOnly = process.argv.includes('--contract')
const mutating = process.argv.includes('--mutating')
const required = ['ACCEPT_BASE_URL', 'ACCEPT_ADMIN_EMAIL', 'ACCEPT_ADMIN_PASSWORD', 'ACCEPT_THEME']
const missing = contractOnly ? [] : required.filter((name) => !process.env[name])

if (missing.length) {
  console.error(`FAIL 03-P00 expected=${required.join(',')} actual=missing:${missing.join(',')}`)
  process.exit(1)
}

if (mutating) {
  const target = process.env.ACCEPT_BASE_URL || ''
  if (process.env.ACCEPT_ALLOW_MUTATION !== 'staging' || /corevo\.se/i.test(target)) {
    console.error(`FAIL 03-P00 expected=disposable-staging actual=${target || 'missing-target'}`)
    process.exit(1)
  }
}

const spec = 'e2e/acceptans/03-redigera-sidan-v2/03-redigera-sidan-v2.accept.spec.ts'
const grep = contractOnly ? '@contract' : mutating ? '@mutating' : '@readonly'
const command = process.execPath
const playwrightCli = require.resolve('@playwright/test/cli')
const env = {
  ...process.env,
  E2E_BASE_URL: process.env.ACCEPT_BASE_URL || 'http://127.0.0.1:9',
}
const run = spawnSync(command, [playwrightCli, 'test', spec, '--grep', grep, '--reporter=json'], {
  cwd: path.resolve(__dirname, '../../..'),
  env,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
})

let report
try {
  report = JSON.parse(run.stdout)
} catch {
  console.error(`FAIL 03-P01 expected=playwright-json actual=${run.error?.message || run.stderr || run.stdout}`)
  process.exit(1)
}

const results = []
function collect(suites) {
  for (const suite of suites || []) {
    for (const specResult of suite.specs || []) {
      for (const testResult of specResult.tests || []) {
        const last = testResult.results?.at(-1)
        results.push({
          id: specResult.title.split(' ')[0],
          title: specResult.title,
          status: last?.status || 'missing',
          error: last?.error?.message || '',
        })
      }
    }
    collect(suite.suites)
  }
}
collect(report.suites)

if (results.length === 0 && run.status !== 0) {
  const fatal = (report.errors || []).map((error) => error.message).join(' ').replace(/\s+/g, ' ').slice(0, 500)
  console.error(`FAIL 03-P01 expected=tests-collected actual=${fatal || `playwright-exit-${run.status}`}`)
  process.exit(1)
}

let passed = 0
let failed = 0
for (const result of results) {
  const ok = result.status === 'passed'
  if (ok) passed += 1
  else failed += 1
  const actual = ok ? 'passed' : `${result.status}:${result.error.replace(/\s+/g, ' ').slice(0, 240)}`
  console.log(`${ok ? 'PASS' : 'FAIL'} ${result.id} expected=passed actual=${actual}`)
}
console.log(`${passed} PASS / ${failed} FAIL`)
process.exit(run.status === 0 && failed === 0 ? 0 : 1)
