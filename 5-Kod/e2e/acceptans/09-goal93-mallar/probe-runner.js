const { spawnSync } = require('node:child_process')
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const GOAL_DIR = path.resolve(__dirname)
const CODE_DIR = path.resolve(GOAL_DIR, '..', '..', '..')
const WEB_DIR = path.join(CODE_DIR, 'apps', 'web')
const CATALOG_SCRIPT = path.join(WEB_DIR, 'scripts', 'goal93-catalog-acceptance.mjs')
const CONFIG_FILE = path.join(GOAL_DIR, 'goal93.playwright.config.ts')
const E2E_DB = path.join(WEB_DIR, 'scripts', 'e2e-db.mjs')
const PREVIEW_REF = 'cwnhpesrgolflkmyjbrm'
const PRODUCTION_REF = 'clylvowtowbtotrahuad'

function playwrightPath(...parts) {
  return path.join(...parts).replaceAll('\\', '/')
}

function loadMatrix() {
  const result = spawnSync(process.execPath, [CATALOG_SCRIPT, '--contract', '--json'], {
    cwd: WEB_DIR,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout)
    throw new Error('goal93:probe:matrix')
  }
  const payload = JSON.parse(result.stdout)
  if (
    payload.goal !== 93 ||
    payload.themeCount !== 12 ||
    payload.routeCount !== 174 ||
    payload.matrixCount !== 376
  ) {
    throw new Error('goal93:probe:matrix-contract')
  }
  return payload
}

function assertPreviewRef() {
  const refFile = path.join(CODE_DIR, 'supabase', '.temp', 'project-ref')
  const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : ''
  if (ref === PRODUCTION_REF) throw new Error('goal93:production-ref')
  if (ref !== PREVIEW_REF) throw new Error(`goal93:preview-ref:${ref || '<missing>'}`)
}

function assertThemeContract(themeKey, payload) {
  if (!payload.keys.includes(themeKey)) throw new Error(`goal93:probe:unknown-theme:${themeKey}`)
  const themeDir = path.join(GOAL_DIR, themeKey)
  const spec = path.join(themeDir, `${themeKey}.accept.spec.ts`)
  const probe = path.join(themeDir, 'probe.js')
  if (!existsSync(spec) || !existsSync(probe)) {
    throw new Error(`goal93:probe:wrapper-missing:${themeKey}`)
  }
  if (!readFileSync(spec, 'utf8').includes(`registerThemeAcceptance('${themeKey}')`)) {
    throw new Error(`goal93:probe:spec-contract:${themeKey}`)
  }
  if (!readFileSync(probe, 'utf8').includes(`runProbe('${themeKey}')`)) {
    throw new Error(`goal93:probe:probe-contract:${themeKey}`)
  }
  const rows = payload.matrix.filter((row) => row.themeKey === themeKey)
  if (rows.length === 0) throw new Error(`goal93:probe:matrix-empty:${themeKey}`)
  return {
    rows: rows.length,
    visual: rows.filter((row) => row.state === 'full').length,
    centralStates: rows.filter((row) => row.state !== 'full').length,
  }
}

function runPlaywright(specs, expected) {
  assertPreviewRef()
  const result = spawnSync(
    process.execPath,
    [
      require.resolve('@playwright/test/cli'),
      'test',
      ...specs,
      '--config',
      CONFIG_FILE,
      '--reporter=line',
    ],
    {
      cwd: CODE_DIR,
      env: { ...process.env, GOAL93_CAPTURE_DESIGN_SOURCE: '0' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status !== 0) {
    console.error(`FAIL goal93 browser expected=${expected} actual=0-or-partial`)
    return result.status ?? 1
  }
  console.log(`PASS goal93 browser expected=${expected} actual=${expected} skipped=0`)
  return 0
}

function runRuntime() {
  assertPreviewRef()
  const command = (args, env = process.env) =>
    spawnSync(process.execPath, args, {
      cwd: CODE_DIR,
      env,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  const preflight = command([E2E_DB, 'verify'])
  process.stdout.write(preflight.stdout || '')
  process.stderr.write(preflight.stderr || '')
  if (preflight.status !== 0) return preflight.status ?? 1

  let status = 1
  let authStateDir
  try {
    const seed = command([E2E_DB, 'seed'])
    if (seed.status !== 0) {
      process.stderr.write(seed.stderr || seed.stdout || '')
      return seed.status ?? 1
    }
    const password = /^E2E_PASSWORD=(.+)$/m.exec(seed.stdout || '')?.[1]
    if (!password) throw new Error('goal93:fixture-password')
    authStateDir = mkdtempSync(path.join(tmpdir(), 'corevo-goal93-auth-'))
    const env = {
      ...process.env,
      E2E_PASSWORD: password,
      GOAL93_AUTH_STATE_FILE: path.join(authStateDir, 'cookies.json'),
      E2E_BOOKING_HOST:
        process.env.GOAL93_ACCEPT_BACKOFFICE_URL || 'http://booking.localhost:3000',
    }
    delete env.E2E_BASE_URL
    const result = command(
      [
        require.resolve('@playwright/test/cli'),
        'test',
        playwrightPath('e2e', 'acceptans', '09-goal93-mallar', 'goal93-runtime.accept.spec.ts'),
        '--reporter=line',
      ],
      env,
    )
    process.stdout.write(result.stdout || '')
    process.stderr.write(result.stderr || '')
    status = result.status ?? 1
  } finally {
    if (authStateDir) rmSync(authStateDir, { recursive: true, force: true })
    const teardown = command([E2E_DB, 'teardown'])
    const clean = command([E2E_DB, 'verify'])
    process.stdout.write(teardown.stdout || '')
    process.stderr.write(teardown.stderr || '')
    process.stdout.write(clean.stdout || '')
    process.stderr.write(clean.stderr || '')
    if (teardown.status !== 0 || clean.status !== 0) status = 1
  }
  console.log(`${status === 0 ? 'PASS' : 'FAIL'} goal93 product runtime themes=12`)
  return status
}

function runProbe(themeKey) {
  const mode = process.argv[2] || '--contract'
  if (!['--contract', '--browser'].includes(mode)) {
    console.error('Usage: node probe.js --contract|--browser')
    process.exit(2)
  }
  try {
    const payload = loadMatrix()
    const counts = assertThemeContract(themeKey, payload)
    if (mode === '--contract') {
      assertPreviewRef()
      console.log(
        `PASS goal93 ${themeKey} contract expected=${counts.rows} actual=${counts.rows} visual=${counts.visual} central-states=${counts.centralStates}`,
      )
      process.exit(0)
    }
    process.exit(
      runPlaywright(
        [
          playwrightPath(
            'e2e',
            'acceptans',
            '09-goal93-mallar',
            themeKey,
            `${themeKey}.accept.spec.ts`,
          ),
        ],
        counts.rows,
      ),
    )
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

function runAllProbes() {
  const mode = process.argv[2] || '--contract'
  if (!['--contract', '--browser', '--runtime'].includes(mode)) {
    console.error('Usage: node probe-all.js --contract|--browser|--runtime')
    process.exit(2)
  }
  try {
    const payload = loadMatrix()
    if (mode === '--runtime') process.exit(runRuntime())
    if (mode === '--contract') {
      assertPreviewRef()
      for (const key of payload.keys) {
        const counts = assertThemeContract(key, payload)
        console.log(
          `PASS goal93 ${key} contract expected=${counts.rows} actual=${counts.rows} visual=${counts.visual} central-states=${counts.centralStates}`,
        )
      }
      process.exit(
        runPlaywright(
          [
            playwrightPath(
              'e2e',
              'acceptans',
              '09-goal93-mallar',
              'goal93-contract.accept.spec.ts',
            ),
          ],
          5,
        ),
      )
    }
    const specs = payload.keys.map((key) =>
      playwrightPath('e2e', 'acceptans', '09-goal93-mallar', key, `${key}.accept.spec.ts`),
    )
    if (runPlaywright(specs, payload.matrixCount) !== 0) process.exit(1)
    process.exit(runRuntime())
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

module.exports = { runAllProbes, runProbe }
