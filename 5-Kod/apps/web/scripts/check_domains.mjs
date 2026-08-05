// goal-32 F4 — domain health guard (offline; NEVER runs in the Worker).
//
// Lists every live exact tenant hostname (the SAME Cloudflare source the deploy
// generator uses) and asserts that it and the fixed application hosts are alive.
// Exit 0 = all up, 1 = something drifted. Run after every prod deploy:
//   node scripts/check_domains.mjs
//
// This is the LIVE-HTTP truth that the super-admin Domäner view (F3) deliberately
// does not do (that view reads CF/DB state); together they cover config + reality.

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { REQUIRED_FIXED_HOSTS } from './gen-deploy-config.mjs'
import { cfApi, listWorkerDomains, resolveAccountId } from './cf-domains.mjs'

const TIMEOUT_MS = 12000
const WORKER = process.env.CF_WORKER_NAME || 'bokningsplatformen'

export function buildFixedProbeTargets(hosts) {
  return hosts.map((host) => ({ host, path: host === 'mina.corevo.se' ? '/mina' : '/' }))
}

export function buildProbeTargets(liveDomains) {
  const fixed = new Set(REQUIRED_FIXED_HOSTS)
  return [...new Set((liveDomains || []).map((host) => String(host).trim().toLowerCase()))]
    .filter((host) => host.endsWith('.corevo.se') && !fixed.has(host))
    .sort()
    .map((host) => ({ host, path: '/boka' }))
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
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('check_domains: CLOUDFLARE_API_TOKEN is required')
  const request = cfApi(token)
  const accountId = await resolveAccountId(request, process.env.CLOUDFLARE_ACCOUNT_ID)
  const tenantTargets = buildProbeTargets(await listWorkerDomains(request, accountId, WORKER))
  const targets = [...buildFixedProbeTargets(REQUIRED_FIXED_HOSTS), ...tenantTargets]

  const results = await Promise.all(targets.map(probe))
  const down = results.filter((r) => !r.ok)

  console.log(
    `\ncheck_domains → ${targets.length} hosts (${REQUIRED_FIXED_HOSTS.length} fixed + ${tenantTargets.length} tenant-hostar)\n`,
  )
  for (const r of results)
    console.log(`  ${r.ok ? 'UP  ' : 'DOWN'}  ${r.host}${r.path}  (${r.status})`)
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
