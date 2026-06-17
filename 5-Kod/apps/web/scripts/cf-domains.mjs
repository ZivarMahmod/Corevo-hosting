// fix-35 — Cloudflare Workers Custom Domains client for the deploy SCRIPTS (.mjs).
//
// The .mjs sibling of lib/cloudflare/worker-domains.ts (which is server-only TS and
// can't be imported by a plain `node scripts/*.mjs` run). Same endpoint + idempotent
// PUT semantics; the build-tool scripts use the CLOUDFLARE_* env names that CI/wrangler
// already set, not the runtime CF_* names.
//
// Used by:
//   add-domain.mjs          — live-attach <slug>.corevo.se on demand (no deploy)
//   gen-deploy-config.mjs    — validator: list live domains attached to OUR worker
//
// Every list/attach is narrowed to `service === <worker>` because GET /workers/domains
// is account-wide + cross-zone (it returns OTHER workers' domains, e.g. sadaqahsweden.se)
// — a guard against ever touching an unrelated production site.

const CF_BASE = 'https://api.cloudflare.com/client/v4'
export const ROOT_ZONE = 'corevo.se'
export const PROD_ENV = 'production'

/** Thin Cloudflare REST client. Throws on transport error OR `success:false`,
 *  surfacing CF's own error list. fetchImpl is injectable for tests. */
export function cfApi(token, fetchImpl = fetch) {
  if (!token) throw new Error('cf-domains: CLOUDFLARE_API_TOKEN is required')
  return async function request(method, path, body) {
    const res = await fetchImpl(`${CF_BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    let json
    try {
      json = await res.json()
    } catch {
      json = null
    }
    if (!res.ok || !json || json.success !== true) {
      const errs = (json && json.errors) || []
      const detail = errs.map((e) => `${e.code} ${e.message}`).join('; ') || `HTTP ${res.status}`
      throw new Error(`CF ${method} ${path} failed: ${detail}`)
    }
    return json.result
  }
}

/** Resolve the zone_id for a zone name (one lookup; all our domains share corevo.se). */
export async function resolveZoneId(request, zoneName = ROOT_ZONE) {
  const zones = await request('GET', `/zones?name=${encodeURIComponent(zoneName)}`)
  const zone = Array.isArray(zones) ? zones[0] : null
  if (!zone || !zone.id) throw new Error(`cf-domains: zone '${zoneName}' not found`)
  return zone.id
}

/** Resolve the account id: prefer the explicit/env value, else the token's sole account. */
export async function resolveAccountId(request, envAccountId) {
  if (envAccountId) return envAccountId
  const accts = await request('GET', '/accounts')
  const acct = Array.isArray(accts) ? accts[0] : null
  if (!acct || !acct.id) throw new Error('cf-domains: could not resolve account id (set CLOUDFLARE_ACCOUNT_ID)')
  return acct.id
}

/** Hostnames of the PRODUCTION custom domains attached to `service`, in API order.
 *  Cross-zone safe: filters by service so another worker's domains never leak in. */
export async function listWorkerDomains(request, accountId, service) {
  const all = await request('GET', `/accounts/${accountId}/workers/domains`)
  return (Array.isArray(all) ? all : [])
    .filter((d) => d && d.service === service && d.environment === PROD_ENV)
    .map((d) => d.hostname)
}

/** Idempotently attach one hostname to `service` (PUT = upsert; existing = no-op). */
export async function attachWorkerDomain(request, { accountId, hostname, service, zoneId }) {
  return request('PUT', `/accounts/${accountId}/workers/domains`, {
    environment: PROD_ENV,
    hostname,
    service,
    zone_id: zoneId,
  })
}
