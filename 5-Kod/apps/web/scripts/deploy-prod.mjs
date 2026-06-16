// goal-32 F1 — sanctioned PRODUCTION deploy. The ONLY safe way to ship the prod
// worker once customer domains are DB-driven: it (1) regenerates the deploy config
// from the DB, (2) re-asserts the 3 fixed-host invariant against the written file,
// (3) DRY-RUNS the deploy so wrangler validates the config and we can eyeball the
// route plan, then (4) deploys for real. A bare `wrangler deploy` (top-level
// wrangler.jsonc) would NOT include the DB customer domains and would detach them
// (FX-14, deploy-runbook §3.1) — always deploy through this script.
//
// Assumes the OpenNext build already produced .open-next/ (run
// `opennextjs-cloudflare build` first). Run from apps/web:
//   node scripts/deploy-prod.mjs            # gen + dry-run + real deploy
//   node scripts/deploy-prod.mjs --dry-run  # gen + dry-run only (no deploy)
// Wrangler command is overridable via WRANGLER_CMD (default: "npx wrangler").

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { REQUIRED_FIXED_HOSTS } from './gen-deploy-config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const deployConfig = resolve(appDir, 'wrangler.deploy.json')
const dryRunOnly = process.argv.includes('--dry-run')
// Dry-run uses raw wrangler (it has --dry-run; opennext deploy does not). The real
// deploy uses `opennextjs-cloudflare deploy` — the established path that also
// populates the OpenNext cache — passing the generated config via -c. Both
// overridable for CI.
const WRANGLER = process.env.WRANGLER_CMD || 'npx wrangler'
const OPENNEXT = process.env.OPENNEXT_CMD || 'npx opennextjs-cloudflare'

function run(cmd, label) {
  console.log(`\n▶ ${label}\n  $ ${cmd}`)
  const res = spawnSync(cmd, { cwd: appDir, stdio: 'inherit', shell: true })
  if (res.status !== 0) {
    console.error(`\n✖ ${label} FAILED (exit ${res.status}). Aborting deploy.`)
    process.exit(res.status || 1)
  }
}

// 1. Regenerate the deploy config from the DB (throws + exits non-zero on any
//    DB error or broken invariant → we never reach the deploy step).
run('node scripts/gen-deploy-config.mjs', 'Generate deploy config from DB')

// 2. Defense-in-depth: re-assert the invariant against the file we are about to ship.
const cfg = JSON.parse(readFileSync(deployConfig, 'utf8'))
const patterns = new Set((cfg.routes || []).map((r) => r.pattern))
const missing = REQUIRED_FIXED_HOSTS.filter((h) => !patterns.has(h))
if (missing.length) {
  console.error(`\n✖ Generated config is missing fixed host(s): ${missing.join(', ')}. Aborting.`)
  process.exit(1)
}
console.log(`\n✓ Invariant OK — fixed hosts present: ${REQUIRED_FIXED_HOSTS.join(', ')}`)
console.log(`✓ Total routes to deploy: ${(cfg.routes || []).length}`)

// 3. Dry-run: wrangler validates the config + prints the bindings/route plan
//    WITHOUT publishing. The cheap pre-flight that catches a malformed config.
run(`${WRANGLER} deploy --dry-run -c wrangler.deploy.json`, 'Dry-run (no publish)')

if (dryRunOnly) {
  console.log('\n✓ --dry-run only: stopping before the real deploy.')
  process.exit(0)
}

// 4. Real deploy — re-asserts ALL routes (fixed + every customer domain).
run(`${OPENNEXT} deploy -c wrangler.deploy.json`, 'Deploy to production')
console.log('\n✓ Production deploy complete.')
