const { spawnSync } = require('node:child_process')
const path = require('node:path')

const result = spawnSync(process.execPath, [
  require.resolve('@playwright/test/cli'),
  'test',
  'e2e/acceptans/07-admin-mobile-chrome/07-admin-mobile-chrome.accept.spec.ts',
  '--grep',
  '@contract',
  '--reporter=line',
], {
  cwd: path.resolve(__dirname, '../../..'),
  env: { ...process.env, E2E_BASE_URL: process.env.ACCEPT_BASE_URL || 'http://127.0.0.1:9' },
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
})

process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
console.log(result.status === 0 ? 'PASS' : 'FAIL')
process.exit(result.status ?? 1)
