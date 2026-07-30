const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const GOAL_DIR = path.resolve(__dirname)
const CODE_DIR = path.resolve(GOAL_DIR, '..', '..', '..')
const WEB_DIR = path.join(CODE_DIR, 'apps', 'web')
const CATALOG_SCRIPT = path.join(WEB_DIR, 'scripts', 'goal93-catalog-acceptance.mjs')
const CONFIG_FILE = path.join(GOAL_DIR, 'goal93.playwright.config.ts')

if (process.argv[2] !== '--design-source') {
  console.error('Usage: node capture-design-source.js --design-source')
  process.exit(2)
}

const matrixResult = spawnSync(process.execPath, [CATALOG_SCRIPT, '--contract', '--json'], {
  cwd: WEB_DIR,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
if (matrixResult.status !== 0) {
  process.stderr.write(matrixResult.stderr || matrixResult.stdout)
  process.exit(matrixResult.status ?? 1)
}
const payload = JSON.parse(matrixResult.stdout)
const specs = payload.keys.map((key) =>
  path
    .join('e2e', 'acceptans', '09-goal93-mallar', key, `${key}.accept.spec.ts`)
    .replaceAll('\\', '/'),
)
const expectedBaselines = payload.matrix
  .filter((row) => row.state === 'full')
  .map((row) => path.join(GOAL_DIR, 'baselines', row.themeKey, `goal93-${row.id}.png`))
console.log(`CAPTURE design source only missing baselines expected=${expectedBaselines.length}`)

function run(capture, reporter) {
  return spawnSync(
    process.execPath,
    [
      require.resolve('@playwright/test/cli'),
      'test',
      ...specs,
      '--config',
      CONFIG_FILE,
      `--reporter=${reporter}`,
    ],
    {
      cwd: CODE_DIR,
      env: { ...process.env, GOAL93_CAPTURE_DESIGN_SOURCE: capture ? '1' : '0' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
}

const captureResult = run(true, 'dot')
const missing = expectedBaselines.filter((file) => !existsSync(file))
if (captureResult.status === 0) {
  process.stdout.write(captureResult.stdout || '')
  process.stderr.write(captureResult.stderr || '')
  console.log(
    `PASS design source baselines expected=${expectedBaselines.length} actual=${expectedBaselines.length}`,
  )
  process.exit(0)
}
if (missing.length > 0) {
  process.stdout.write(captureResult.stdout || '')
  process.stderr.write(captureResult.stderr || '')
  console.error(
    `FAIL design source baselines expected=${expectedBaselines.length} missing=${missing.length}`,
  )
  process.exit(captureResult.status ?? 1)
}

console.log(
  `CAPTURE wrote missing baselines actual=${expectedBaselines.length}; validating with updates disabled`,
)
const verifyResult = run(false, 'line')
process.stdout.write(verifyResult.stdout || '')
process.stderr.write(verifyResult.stderr || '')
if (verifyResult.status === 0) {
  console.log(
    `PASS design source baselines expected=${expectedBaselines.length} actual=${expectedBaselines.length}`,
  )
}
process.exit(verifyResult.status ?? 1)
