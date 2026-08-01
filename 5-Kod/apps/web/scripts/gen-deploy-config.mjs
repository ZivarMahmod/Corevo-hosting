// fix-35 — PROD domain VALIDATOR (was: generator; repurposed, code kept = build-once).
//
// THE MODEL CHANGE (fix-35): customer domains now live in COMMITTED wrangler.jsonc
// top-level routes[] (like the 3 fixed back-office hosts), so a deploy of that file
// re-asserts every one and can NEVER detach them. This file is therefore no longer
// the deploy SOURCE (it stopped writing wrangler.deploy.json). It is now a fail-closed
// PRE-FLIGHT VALIDATOR: it proves the committed wrangler.jsonc is a SUPERSET of what
// is actually live, so a deploy can never silently drop a domain that exists in the
// cloud but was forgotten in the file.
//
// Two guards (either failing aborts the deploy):
//  1. LIVE ⊆ FILE (the strong one): every <slug>.corevo.se currently attached to our
//     worker (CF API — sees ALL live domains incl. PAUSED salons, because it reads
//     Cloudflare not the DB) MUST be in committed wrangler.jsonc. This single guard
//     neutralizes the old RLS trap: a paused salon that anon-RLS hid from the DB read
//     is still LIVE in Cloudflare, so it is caught here regardless of DB visibility.
// Active tenants do NOT need one route each. They are all covered by the committed
// `*.boka.corevo.se/*` wildcard. Existing legacy custom domains still ride guard #1
// so a deployment cannot silently detach them.
//
// The pure helpers (buildRoutes/fetchActiveSlugs/REQUIRED_FIXED_HOSTS) are RETAINED
// (build-once-never-delete) — they encode the route contract + the fail-closed DB
// read, reused by tests and any future CI-sync that WRITES the file.
//
// Run from apps/web:  node scripts/gen-deploy-config.mjs   (validate; exit 1 on drift)

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readCustomDomainPatterns, readAllRoutePatterns, REQUIRED_FIXED_ROUTES, RESERVED } from './domain-routes.mjs'
import { cfApi, resolveAccountId, listWorkerDomains } from './cf-domains.mjs'

const WORKER = process.env.CF_WORKER_NAME || 'bokningsplatformen'

/** Infra hosts that MUST be present in every deploy config (hardcoded, never DB-derived). */
export const REQUIRED_FIXED_HOSTS = [
  'booking.corevo.se',
  'superbooking.corevo.se',
  'minbooking.corevo.se',
  'mina.corevo.se',
]

// Reserved labels come from the route editor's canonical JS set. The parity
// contract keeps that set aligned with lib/tenant.ts and tracked environments.

/**
 * Preserve the fixed infra routes. Tenant slugs deliberately do not alter the route
 * list because the canonical `*.boka.corevo.se/*` route covers them all. THROWS if
 * any required fixed host is missing (the deploy-safety invariant). RETAINED for
 * backwards-compatible callers under build-once-never-delete.
 * @param {Array<{pattern:string,custom_domain?:boolean,zone_name?:string}>} baseRoutes
 * @param {string[]} slugs
 */
export function buildRoutes(baseRoutes, _slugs) {
  const routes = [...baseRoutes]
  const present = new Set(routes.map((r) => r.pattern))
  const missing = REQUIRED_FIXED_HOSTS.filter((h) => !present.has(h))
  if (missing.length) {
    throw new Error(
      `gen-deploy-config: ABORT — required fixed host(s) missing from routes: ${missing.join(', ')}. ` +
        'Refusing to write a deploy config that could detach the back-office.',
    )
  }
  return routes
}

/**
 * Fetch active (status != 'deleted') tenant slugs via the anon REST endpoint.
 * THROWS on any non-OK / unparseable response — fail-closed, so a transient DB
 * error can never silently produce a config with fewer customer domains than reality.
 * NOTE (RLS): the anon policy `tenants_public_read = USING (status='active')` means
 * this returns only ACTIVE tenants even though the query asks for neq.deleted —
 * paused salons are invisible here. That is WHY paused coverage rides guard #1
 * (live CF domains), not this read.
 * @param {string} supaUrl @param {string} anonKey @param {typeof fetch} [fetchImpl]
 */
export async function fetchActiveSlugs(supaUrl, anonKey, fetchImpl = fetch) {
  const url = `${supaUrl}/rest/v1/tenants?select=slug&status=neq.deleted`
  const res = await fetchImpl(url, {
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
  })
  if (!res.ok) throw new Error(`gen-deploy-config: tenant fetch failed (HTTP ${res.status})`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('gen-deploy-config: tenant fetch returned a non-array')
  return rows.map((r) => r && r.slug).filter(Boolean)
}

/**
 * Pure drift detector. Given the committed custom_domain patterns, the live worker
 * domains, and the active tenant slugs, return what is MISSING from the committed
 * file. `missingActive` remains for API compatibility but is always empty: the
 * required wildcard route covers every canonical active-tenant host.
 * @returns {{ missingLive: string[], missingActive: string[] }}
 */
export function validateDomains({ committedPatterns, liveDomains, activeSlugs }) {
  // Normalize case on both sides — CF returns lowercase hostnames in practice, but a
  // case mismatch would otherwise be a false-positive that blocks a clean deploy.
  const committed = new Set((committedPatterns || []).map((p) => String(p).toLowerCase()))
  const fixed = new Set(REQUIRED_FIXED_HOSTS) // already lowercase
  const missingLive = (liveDomains || [])
    .map((h) => String(h).toLowerCase())
    .filter((h) => !fixed.has(h) && !committed.has(h))
  const missingActive = []
  return { missingLive, missingActive }
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const wranglerPath = resolve(here, '..', 'wrangler.jsonc')
  const committedPatterns = readCustomDomainPatterns(wranglerPath)

  // Invariant: ALL fixed routes must be in the committed file — the 3 back-office
  // custom_domains AND the *.boka.corevo.se/* storefront wildcard (a zone_name route,
  // so it is checked against the FULL routes[], not just custom_domain entries).
  const allRoutes = new Set(readAllRoutePatterns(wranglerPath))
  const missingFixed = REQUIRED_FIXED_ROUTES.filter((p) => !allRoutes.has(p))
  if (missingFixed.length) {
    console.error(`✖ wrangler.jsonc missing fixed route(s): ${missingFixed.join(', ')}. Aborting.`)
    process.exit(1)
  }

  // Guard #1 — LIVE ⊆ FILE (needs a token; covers paused via Cloudflare, not the DB).
  let liveDomains = []
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (token) {
    const request = cfApi(token)
    const accountId = await resolveAccountId(request, process.env.CLOUDFLARE_ACCOUNT_ID)
    liveDomains = await listWorkerDomains(request, accountId, WORKER)
  } else if (process.env.GITHUB_ACTIONS) {
    console.error('✖ CLOUDFLARE_API_TOKEN missing in CI — cannot verify live⊆file. Aborting.')
    process.exit(1)
  } else {
    console.warn('⚠ CLOUDFLARE_API_TOKEN not set — SKIPPING live⊆file guard (set it to enable).')
  }

  const { missingLive, missingActive } = validateDomains({
    committedPatterns,
    liveDomains,
    activeSlugs: [],
  })
  if (missingLive.length || missingActive.length) {
    if (missingLive.length) {
      console.error(
        `✖ LIVE but NOT committed (a deploy would DETACH these): ${missingLive.join(', ')}\n` +
          '  → run `node scripts/add-domain.mjs <slug>` for each, then COMMIT wrangler.jsonc.',
      )
    }
    if (missingActive.length) {
      console.error(`✖ ACTIVE tenant(s) missing from wrangler.jsonc: ${missingActive.join(', ')}`)
    }
    process.exit(1)
  }

  console.log('✓ Domain validator OK — wildcard is present and committed routes cover every live legacy domain.')
  console.log(`  fixed hosts: ${REQUIRED_FIXED_HOSTS.join(', ')}`)
  console.log(`  live custom domains: ${liveDomains.filter((h) => !REQUIRED_FIXED_HOSTS.includes(h)).join(', ') || '(none)'}`)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    console.error(String(err && err.message ? err.message : err))
    process.exit(1)
  })
}
