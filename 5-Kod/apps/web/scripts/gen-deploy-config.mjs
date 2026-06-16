// goal-32 F1 — PROD deploy-config generator (mechanism A: "config = truth").
//
// Reads the fixed infra routes from wrangler.jsonc and APPENDS one
// `<slug>.corevo.se` custom_domain route per active tenant (read from the DB via
// the anon REST endpoint), then writes `wrangler.deploy.json`. Every prod deploy
// uses the GENERATED config, so each deploy RE-ASSERTS every customer domain
// (the codebase's FX-14 "config = truth" philosophy, automated instead of
// hand-edited). A deploy can therefore never detach a live salon's domain.
//
// Removal happens ONLY when a tenant is soft-deleted (status='deleted'): RLS then
// hides it from the anon read → the next deploy omits it. That is the manual
// "radering" the goal requires — a deploy ALONE never removes a visible salon.
//
// SAFETY — the one invariant that matters (advisor): the deploy config must NEVER
// omit the three back-office hosts (booking/superbooking/minbooking). Losing them
// = platform down. Enforced by the hardcoded assertion in buildRoutes(): if the
// merged routes lack any of them — a DB hiccup, a corrupted wrangler.jsonc — the
// generator THROWS and writes nothing, so the deploy aborts fail-closed.
//
// Run from apps/web:  node scripts/gen-deploy-config.mjs
// (jsonc-parser is dynamically imported inside main() so unit tests can import the
//  pure helpers below without the dependency present.)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT_DOMAIN = 'corevo.se'

/** Infra hosts that MUST be present in every deploy config (hardcoded, never DB-derived). */
export const REQUIRED_FIXED_HOSTS = [
  'booking.corevo.se',
  'superbooking.corevo.se',
  'minbooking.corevo.se',
]

// Reserved labels that can never be minted as a tenant subdomain. Mirrors
// lib/tenant.ts DEFAULT_RESERVED so the generator can't attach a POS host even if
// the DB ever returned one.
const RESERVED = new Set(
  'booking,admin,app,www,api,superadmin,kiosk,dev,odoo,superbooking,minbooking,boka'.split(','),
)

/**
 * Merge the fixed infra routes with one custom_domain route per active slug.
 * Dedupes by pattern; skips reserved/POS labels. THROWS if any required fixed host
 * is missing from the result (the deploy-safety invariant).
 * @param {Array<{pattern:string,custom_domain?:boolean,zone_name?:string}>} baseRoutes
 * @param {string[]} slugs
 */
export function buildRoutes(baseRoutes, slugs) {
  const routes = [...baseRoutes]
  const seen = new Set(routes.map((r) => r.pattern))
  for (const raw of slugs) {
    const s = String(raw || '').trim().toLowerCase()
    if (!s || RESERVED.has(s)) continue
    const pattern = `${s}.${ROOT_DOMAIN}`
    if (seen.has(pattern)) continue
    routes.push({ pattern, custom_domain: true })
    seen.add(pattern)
  }
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
 * error can never silently produce a config with fewer customer domains than
 * reality (which a deploy would then enact as a detach).
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

async function main() {
  const { parse: parseJsonc } = await import('jsonc-parser')
  const here = dirname(fileURLToPath(import.meta.url))
  const wranglerPath = resolve(here, '..', 'wrangler.jsonc')
  const outPath = resolve(here, '..', 'wrangler.deploy.json')

  const raw = readFileSync(wranglerPath, 'utf8')
  const errors = []
  const config = parseJsonc(raw, errors, { allowTrailingComma: true })
  if (errors.length) {
    throw new Error(`gen-deploy-config: wrangler.jsonc parse errors: ${JSON.stringify(errors)}`)
  }
  if (!config || !Array.isArray(config.routes)) {
    throw new Error('gen-deploy-config: wrangler.jsonc has no routes[]')
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || config.vars?.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || config.vars?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supaUrl || !anonKey) throw new Error('gen-deploy-config: missing Supabase URL / anon key')

  const slugs = await fetchActiveSlugs(supaUrl, anonKey)
  config.routes = buildRoutes(config.routes, slugs)
  // Scope the artifact to PRODUCTION: prod deploy uses the top-level config only.
  // The staging env stays defined in wrangler.jsonc (the source), not in this
  // generated prod artifact. $schema is a dev-only hint; drop it from pure JSON.
  delete config.env
  delete config.$schema
  writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n', 'utf8')

  const customer = config.routes.filter(
    (r) => r.custom_domain && !REQUIRED_FIXED_HOSTS.includes(r.pattern),
  )
  console.log(`gen-deploy-config → wrote ${outPath}`)
  console.log(`  fixed hosts (invariant OK): ${REQUIRED_FIXED_HOSTS.join(', ')}`)
  console.log(
    `  customer domains (${customer.length}): ${customer.map((r) => r.pattern).join(', ') || '(none)'}`,
  )
  console.log(`  total routes: ${config.routes.length}`)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    console.error(String(err && err.message ? err.message : err))
    process.exit(1)
  })
}
