// goal-32 F4 — domain health guard (offline; NEVER runs in the Worker).
//
// Lists every active tenant (the SAME source the deploy generator uses) and asserts:
//   1. each <slug>.boka.corevo.se/boka responds with 2xx/3xx,
//   2. the fixed application hosts are alive.
// Exit 0 = all up, 1 = something drifted. Run after every prod deploy:
//   node scripts/check_domains.mjs
//
// This is the LIVE-HTTP truth that the super-admin Domäner view (F3) deliberately
// does not do (that view reads CF/DB state); together they cover config + reality.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchActiveSlugs, REQUIRED_FIXED_HOSTS } from './gen-deploy-config.mjs'

const TENANT_SUFFIX = 'boka.corevo.se'
const TIMEOUT_MS = 12000

export function buildProbeTargets(slugs) {
  return slugs
    .map((slug) => String(slug || '').trim().toLowerCase())
    .filter(Boolean)
    .map((slug) => ({ host: `${slug}.${TENANT_SUFFIX}`, path: '/boka' }))
}

export function isHealthyStatus(status) {
  return status >= 200 && status < 400
}

async function probe({ host, path = '/' }) {
  const url = `https://${host}${path}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal })
    return { host, path, ok: isHealthyStatus(res.status), status: res.status }
  } catch (e) {
    return {
      host,
      path,
      ok: false,
      status: String(e && e.name === 'AbortError' ? 'timeout' : e.message || e),
    }
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  const { parse: parseJsonc } = await import('jsonc-parser')
  const here = dirname(fileURLToPath(import.meta.url))
  const raw = readFileSync(resolve(here, '..', 'wrangler.jsonc'), 'utf8')
  const config = parseJsonc(raw, [], { allowTrailingComma: true }) || {}
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || config.vars?.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || config.vars?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supaUrl || !anonKey) throw new Error('check_domains: missing Supabase URL / anon key')

  const slugs = await fetchActiveSlugs(supaUrl, anonKey)
  const tenantTargets = buildProbeTargets(slugs)
  const targets = [
    ...REQUIRED_FIXED_HOSTS.map((host) => ({ host, path: '/' })),
    ...tenantTargets,
  ]

  const results = await Promise.all(targets.map(probe))
  const down = results.filter((r) => !r.ok)

  console.log(`\ncheck_domains → ${targets.length} hosts (${REQUIRED_FIXED_HOSTS.length} fixed + ${tenantTargets.length} kunder)\n`)
  for (const r of results) console.log(`  ${r.ok ? 'UP  ' : 'DOWN'}  ${r.host}${r.path}  (${r.status})`)
  console.log(`\n${down.length === 0 ? 'ALL UP' : `${down.length} DOWN`}\n`)
  process.exit(down.length === 0 ? 0 : 1)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    console.error(String(err && err.message ? err.message : err))
    process.exit(1)
  })
}
