const { spawnSync } = require('node:child_process')
const path = require('node:path')

const contractOnly = process.argv.includes('--contract')
const required = ['ACCEPT_BASE_URL', 'ACCEPT_ADMIN_EMAIL', 'ACCEPT_ADMIN_PASSWORD']
const missing = contractOnly ? [] : required.filter((name) => !process.env[name])
if (missing.length) {
  console.error(`FAIL 04-P00 expected=${required.join(',')} actual=missing:${missing.join(',')}`)
  process.exit(1)
}

const spec = 'e2e/acceptans/04-installningar-v2/04-installningar-v2.accept.spec.ts'
const grep = contractOnly ? '@contract' : '@readonly'
const run = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', spec, '--grep', grep, '--reporter=line'], {
  cwd: path.resolve(__dirname, '../../..'),
  env: { ...process.env, E2E_BASE_URL: process.env.ACCEPT_BASE_URL || 'http://127.0.0.1:9' },
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
})

process.stdout.write(run.stdout)
process.stderr.write(run.stderr)
console.log(run.status === 0 ? 'PASS' : 'FAIL')
process.exit(run.status ?? 1)
