// goal-32 F4 — domain health guard (offline; NEVER runs in the Worker).
//
// Lists every active tenant (the SAME source the deploy generator uses) and asserts:
//   1. each <slug>.corevo.se responds (HTTP < 500, i.e. the worker is routing it —
//      not a Cloudflare 1016/522/DNS error),
//   2. the 3 fixed back-office hosts (booking/superbooking/minbooking) are alive.
// Exit 0 = all up, 1 = something drifted. Run after every prod deploy:
//   node scripts/check_domains.mjs
//
// This is the LIVE-HTTP truth that the super-admin Domäner view (F3) deliberately
// does not do (that view reads CF/DB state); together they cover config + reality.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchActiveSlugs, REQUIRED_FIXED_HOSTS } from './gen-deploy-config.mjs'

const ROOT_DOMAIN = 'corevo.se'
const TIMEOUT_MS = 12000

async function probe(host) {
  const url = `https://${host}/`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal })
    // < 500 = the worker is routing this host (200 storefront/login, 3xx redirect,
    // even 401/404 mean "alive + served"). 5xx / network error = down.
    return { host, ok: res.status < 500, status: res.status }
  } catch (e) {
    return { host, ok: false, status: String(e && e.name === 'AbortError' ? 'timeout' : e.message || e) }
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
  const tenantHosts = slugs.map((s) => `${s}.${ROOT_DOMAIN}`)
  const hosts = [...REQUIRED_FIXED_HOSTS, ...tenantHosts]

  const results = await Promise.all(hosts.map(probe))
  const down = results.filter((r) => !r.ok)

  console.log(`\ncheck_domains → ${hosts.length} hosts (${REQUIRED_FIXED_HOSTS.length} fixed + ${tenantHosts.length} salonger)\n`)
  for (const r of results) console.log(`  ${r.ok ? 'UP  ' : 'DOWN'}  ${r.host}  (${r.status})`)
  console.log(`\n${down.length === 0 ? 'ALL UP' : `${down.length} DOWN`}\n`)
  process.exit(down.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err))
  process.exit(1)
})
