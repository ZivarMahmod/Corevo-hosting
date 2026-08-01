const { spawnSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const path = require('node:path')

const PREVIEW_REF = 'cwnhpesrgolflkmyjbrm'
const ROOT = path.resolve(__dirname, '../../..')
const SPEC = 'e2e/acceptans/08-goal92-commerce/08-goal92-commerce.accept.spec.ts'
const E2E_DB = 'apps/web/scripts/e2e-db.mjs'
const runtime = process.argv.includes('--runtime')

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
  })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${label} exit=${result.status ?? 1}`)
  return result
}

function playwright(label, grep, env) {
  return run(
    label,
    process.execPath,
    [require.resolve('@playwright/test/cli'), 'test', SPEC, '--grep', grep, '--reporter=line'],
    { env },
  ).status === 0
}

if (!runtime) {
  process.exit(
    playwright('08 contract', '@contract', { E2E_BASE_URL: 'http://127.0.0.1:9' }) ? 0 : 1,
  )
}

const required = ['ACCEPT_BASE_URL', 'GOAL92_ACCEPT_PREVIEW_REF']
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  console.error(`FAIL 08-P00 expected=${required.join(',')} actual=missing:${missing.join(',')}`)
  process.exit(1)
}

let target
try {
  target = new URL(process.env.ACCEPT_BASE_URL)
} catch {
  console.error('FAIL 08-P00 expected=valid-preview-url actual=invalid-url')
  process.exit(1)
}

if (
  process.env.GOAL92_ACCEPT_PREVIEW_REF !== PREVIEW_REF ||
  target.hostname === 'corevo.se' ||
  target.hostname.endsWith('.corevo.se')
) {
  console.error('FAIL 08-P00 expected=explicit-non-production-preview actual=guard-rejected')
  process.exit(1)
}

const linkedRef = readFileSync(path.join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim()
if (linkedRef !== PREVIEW_REF) {
  console.error(`FAIL 08-P00 expected=${PREVIEW_REF} actual=${linkedRef || '<missing>'}`)
  process.exit(1)
}

const supabaseCommand = process.platform === 'win32' ? process.env.ComSpec : 'pnpm'
const supabaseArgs =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm dlx supabase@2.110.0 db query --linked --output-format text']
    : ['dlx', 'supabase@2.110.0', 'db', 'query', '--linked', '--output-format', 'text']

if (run('08 fixture preflight', process.execPath, [E2E_DB, 'verify']).status !== 0) {
  console.error('FAIL 08-P01 fixture is not clean; run e2e-db.mjs teardown, then verify')
  process.exit(1)
}

let fixtureAttempted = false
let internalPassed = false
try {
  fixtureAttempted = true
  const seed = run('08 fixture seed', process.execPath, [E2E_DB, 'seed'])
  if (seed.status !== 0) throw new Error('fixture seed failed')
  const password = /^E2E_PASSWORD=(.+)$/m.exec(seed.stdout || '')?.[1]
  if (!password) throw new Error('fixture did not return an ephemeral password')

  for (const [label, relativePath, outerRollback] of [
    ['08 SQL media', 'supabase/tests/goal92_media_quota.sql', false],
    ['08 SQL offert', 'supabase/tests/goal92_offert_fsm.sql', false],
    ['08 SQL payment', 'supabase/tests/goal92_shop_payment_truth.sql', false],
    ['08 SQL refund', 'supabase/tests/goal92_shop_refund_jobs.sql', true],
  ]) {
    const source = readFileSync(path.join(ROOT, relativePath), 'utf8')
    const input = outerRollback ? `begin;\n${source}\nrollback;\n` : source
    if (run(label, supabaseCommand, supabaseArgs, { input }).status !== 0) {
      throw new Error(`${label} failed`)
    }
  }

  for (const [label, script] of [
    ['08 concurrency media', 'supabase/tests/goal92_media_quota_concurrency.mjs'],
    ['08 concurrency reserve', 'supabase/tests/goal92_shop_reserve_concurrency.mjs'],
  ]) {
    if (
      run(label, process.execPath, [script, PREVIEW_REF], {
        env: { E2E_PASSWORD: password },
      }).status !== 0
    ) {
      throw new Error(`${label} failed`)
    }
  }

  const localTarget = ['localhost', '127.0.0.1'].includes(target.hostname)
  const browserEnv = {
    ACCEPT_BASE_URL: process.env.ACCEPT_BASE_URL,
    ACCEPT_BACKOFFICE_URL:
      process.env.ACCEPT_BACKOFFICE_URL ||
      (localTarget ? 'http://booking.localhost:3000' : process.env.ACCEPT_BASE_URL),
    E2E_PASSWORD: password,
    GOAL92_ACCEPT_PREVIEW_REF: PREVIEW_REF,
    COREVO_COMMERCE_RELEASE: 'settlement-v1-verified',
    COREVO_COMMERCE_TENANT_IDS: 'e2e00000-0000-0000-0000-000000000001',
  }
  if (!localTarget) browserEnv.E2E_BASE_URL = process.env.ACCEPT_BASE_URL
  internalPassed = playwright('08 preview browser', '@runtime', browserEnv)
} catch (error) {
  console.error(`FAIL 08-P02 ${error instanceof Error ? error.message : String(error)}`)
} finally {
  if (
    fixtureAttempted &&
    run('08 fixture teardown', process.execPath, [E2E_DB, 'teardown']).status !== 0
  ) {
    internalPassed = false
  }
  if (run('08 fixture clean', process.execPath, [E2E_DB, 'verify']).status !== 0) {
    internalPassed = false
  }
}
if (!internalPassed) process.exit(1)

let externalBlocked = 0
const stripeReady = ['GOAL92_STRIPE_SANDBOX_CHECKOUT_URL', 'GOAL92_STRIPE_SANDBOX_EMAIL'].every(
  (name) => process.env[name],
)
if (stripeReady) {
  if (!playwright('08 Stripe sandbox', '@stripe-sandbox', {
    E2E_BASE_URL: process.env.ACCEPT_BASE_URL,
  })) {
    process.exit(1)
  }
} else {
  externalBlocked += 1
  console.log('BLOCKED 08-X01 Stripe sandbox credentials unavailable')
}

const paypalReady = [
  'GOAL92_PAYPAL_SANDBOX_APPROVAL_URL',
  'GOAL92_PAYPAL_SANDBOX_EMAIL',
  'GOAL92_PAYPAL_SANDBOX_PASSWORD',
].every((name) => process.env[name])
if (paypalReady) {
  if (!playwright('08 PayPal sandbox', '@paypal-sandbox', {
    E2E_BASE_URL: process.env.ACCEPT_BASE_URL,
  })) {
    process.exit(1)
  }
} else {
  externalBlocked += 1
  console.log('BLOCKED 08-X02 PayPal sandbox credentials unavailable')
}

externalBlocked += 2
console.log('BLOCKED 08-X03 R2 Worker runtime binding unavailable in local preview')
console.log('BLOCKED 08-X04 receiving email sink unavailable in local preview')
console.log(`PASS 08 runtime internal=sql+concurrency+browser external_blocked=${externalBlocked}`)
