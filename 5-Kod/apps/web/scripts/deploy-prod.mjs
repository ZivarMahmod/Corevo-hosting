// Sanctioned production deploy. Cloudflare Worker Domains is the canonical list for
// exact tenant hosts; immediately before publishing we generate wrangler.deploy.json
// from that live list. A rebuild can therefore never detach a customer site merely
// because somebody forgot to edit the committed base config.
//
// Steps: (1) read live tenant domains into a temporary config; (2) re-assert the
// committed fixed hosts; (3) dry-run the temporary config; (4) publish that same config.
//
// Assumes the OpenNext build already produced .open-next/ (run
// `opennextjs-cloudflare build` first). Run from apps/web:
//   node scripts/deploy-prod.mjs            # validate + dry-run + real deploy
//   node scripts/deploy-prod.mjs --dry-run  # validate + dry-run only (no deploy)
// Commands overridable via WRANGLER_CMD / OPENNEXT_CMD for CI.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readAllRoutePatterns, REQUIRED_FIXED_ROUTES } from './domain-routes.mjs'
import { publishGateReason } from './cf-domains.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const wranglerPath = resolve(appDir, 'wrangler.jsonc')
const deployConfigPath = resolve(appDir, 'wrangler.deploy.json')
const dryRunOnly = process.argv.includes('--dry-run')
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

// 1. Cloudflare is the tenant-domain owner. This MUST read the live Worker-domain
//    list successfully or we abort before a deploy could reconcile routes.
run(
  'node scripts/gen-deploy-config.mjs --output wrangler.deploy.json',
  'Generate deploy config from live Worker domains',
)

// 2. Defense-in-depth: fixed platform doors remain committed source, never DB/CF
//    derived tenant data. A manual edit that drops one aborts before publish.
const allRoutes = new Set(readAllRoutePatterns(wranglerPath))
const missing = REQUIRED_FIXED_ROUTES.filter((p) => !allRoutes.has(p))
if (missing.length) {
  console.error(`\n✖ wrangler.jsonc is missing fixed route(s): ${missing.join(', ')}. Aborting.`)
  process.exit(1)
}
console.log(`\n✓ Invariant OK — fixed routes present: ${REQUIRED_FIXED_ROUTES.join(', ')}`)

// 3. Dry-run the generated union, never the bare base config.
run(`${WRANGLER} deploy --config ${deployConfigPath} --dry-run`, 'Dry-run (no publish)')

if (dryRunOnly) {
  console.log('\n✓ --dry-run only: stopping before the real deploy.')
  process.exit(0)
}

// 3.5 PUBLISH GATE — a publish without the token cannot generate the live-domain
//     union and is therefore always unsafe.
const gateReason = publishGateReason(process.env)
if (gateReason) {
  console.error(`\n✖ ${gateReason} Aborting before publish.`)
  process.exit(1)
}

// 4. Real deploy from the generated union of fixed doors + live customer domains.
run(`${OPENNEXT} deploy --config ${deployConfigPath}`, 'Deploy to production')
console.log('\n✓ Production deploy complete.')
