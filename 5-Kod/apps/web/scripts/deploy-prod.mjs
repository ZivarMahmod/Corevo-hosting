// fix-35 — sanctioned PRODUCTION deploy. Customer domains now live in COMMITTED
// wrangler.jsonc (top-level routes[], alongside the 3 fixed back-office hosts), so a
// plain deploy of that file re-asserts EVERY domain and can never detach one — the
// fragile DB-generated `-c wrangler.deploy.json` path is gone (it was the FX-14 hole:
// a bare deploy or an RLS-hidden paused salon dropped a live domain).
//
// Steps: (1) run the fail-closed VALIDATOR (gen-deploy-config.mjs) — proves the
// committed file is a superset of what is LIVE + active, so the deploy can't silently
// drop a domain that exists in Cloudflare but was forgotten in the file; (2) re-assert
// the 3 fixed hosts against wrangler.jsonc; (3) DRY-RUN (wrangler validates + prints
// the route plan, no publish); (4) deploy for real from wrangler.jsonc.
//
// Assumes the OpenNext build already produced .open-next/ (run
// `opennextjs-cloudflare build` first). Run from apps/web:
//   node scripts/deploy-prod.mjs            # validate + dry-run + real deploy
//   node scripts/deploy-prod.mjs --dry-run  # validate + dry-run only (no deploy)
// Commands overridable via WRANGLER_CMD / OPENNEXT_CMD for CI.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { REQUIRED_FIXED_HOSTS } from './gen-deploy-config.mjs'
import { readCustomDomainPatterns, readAllRoutePatterns, REQUIRED_FIXED_ROUTES } from './domain-routes.mjs'
import { publishGateReason } from './cf-domains.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const wranglerPath = resolve(appDir, 'wrangler.jsonc')
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

// 1. Fail-closed validator: committed wrangler.jsonc ⊇ live + active domains. Exits
//    non-zero on any drift → we never deploy a file that would detach a live domain.
run('node scripts/gen-deploy-config.mjs', 'Validate domains (committed ⊇ live + active)')

// 2. Defense-in-depth: re-assert EVERY fixed route directly against wrangler.jsonc —
//    the back-office/customer-portal custom_domains AND the *.boka.corevo.se/* storefront wildcard
//    (a zone_name route, so it is checked against the FULL routes[], not just
//    custom_domain entries). A manual edit/merge that drops any one is caught here.
const allRoutes = new Set(readAllRoutePatterns(wranglerPath))
const missing = REQUIRED_FIXED_ROUTES.filter((p) => !allRoutes.has(p))
if (missing.length) {
  console.error(`\n✖ wrangler.jsonc is missing fixed route(s): ${missing.join(', ')}. Aborting.`)
  process.exit(1)
}
console.log(`\n✓ Invariant OK — fixed routes present: ${REQUIRED_FIXED_ROUTES.join(', ')}`)
const customerCount = readCustomDomainPatterns(wranglerPath).filter((p) => !REQUIRED_FIXED_HOSTS.includes(p)).length
console.log(`✓ Committed customer custom-domains: ${customerCount}`)

// 3. Dry-run from wrangler.jsonc (no -c): wrangler validates + prints the route plan.
run(`${WRANGLER} deploy --dry-run`, 'Dry-run (no publish)')

if (dryRunOnly) {
  console.log('\n✓ --dry-run only: stopping before the real deploy.')
  process.exit(0)
}

// 3.5 PUBLISH GATE — the validator's live⊆file guard only runs WITH a CF token; a real
//     publish without it could reconcile routes to the committed file and detach a
//     live-but-uncommitted domain (the FX-14 hole on the LOCAL deploy path). Dry-run is
//     exempt above — it never publishes.
const gateReason = publishGateReason(process.env)
if (gateReason) {
  console.error(`\n✖ ${gateReason} Aborting before publish.`)
  process.exit(1)
}

// 4. Real deploy from wrangler.jsonc — re-asserts ALL routes (fixed + every committed
//    customer domain). No DB read, no -c override file: the one committed config.
run(`${OPENNEXT} deploy`, 'Deploy to production')
console.log('\n✓ Production deploy complete.')
