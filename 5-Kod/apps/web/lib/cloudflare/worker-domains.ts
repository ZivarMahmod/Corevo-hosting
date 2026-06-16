import 'server-only'

// goal-32 F2 — Cloudflare Workers Custom Domains API client. The INSTANT (no
// deploy-wait) half of onboarding domain-attach for `<slug>.corevo.se`: a
// first-level subdomain of our own zone → covered by the FREE Universal SSL
// `*.corevo.se` cert, so attaching it provisions DNS + cert with no extra cost.
//
// This sits ON TOP of the proven mechanism (A): scripts/gen-deploy-config.mjs makes
// every active tenant's domain live at the NEXT deploy regardless. This client only
// makes it live IMMEDIATELY at onboarding when a scoped token is present — a pure
// enhancement, never the correctness dependency.
//
// DISTINCT from custom-hostnames.ts: that is Cloudflare FOR SAAS (Custom Hostnames)
// for a customer's OWN external domain and explicitly REJECTS *.corevo.se. This is
// the Workers Domains endpoint for OUR-zone subdomains — different API, different
// purpose.
//
// FAIL-CLOSED + DORMANT (prod today): needs CF_API_TOKEN (scope WIDER than the
// SSL/Certs token used by custom-hostnames — also Workers Scripts:Edit + Zone
// DNS:Edit + Zone:Read on corevo.se) + CF_ACCOUNT_ID + CF_ZONE_ID + the flag
// DOMAIN_AUTOATTACH_ENABLED=true. Missing any → every call returns { ok:false }
// instead of throwing, so onboarding never blocks and prod (no token / flag off) is
// a no-op. The token must NEVER reach the browser (server-only) and is NEVER committed.

// Lazy env reads (not module consts) — safer across the Workers runtime where vars
// are injected per request, and lets tests stub process.env per case.
const cfToken = () => process.env.CF_API_TOKEN
const cfAccount = () => process.env.CF_ACCOUNT_ID
const cfZone = () => process.env.CF_ZONE_ID
const autoAttachEnabled = () => process.env.DOMAIN_AUTOATTACH_ENABLED === 'true'
/** The Worker this domain routes to. Override via env for staging; default = prod worker. */
const workerService = () => process.env.CF_WORKER_NAME || 'bokningsplatformen'
const workerEnv = () => process.env.CF_WORKER_ENV || 'production'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').toLowerCase()

export type WorkerDomain = {
  id: string
  hostname: string
  service: string
  environment: string
}

export type CfResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** A fetch with the same shape as the global — injectable so tests need no network. */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

const MISSING =
  'Worker-domän-attach är inte aktiverad (CF_API_TOKEN / CF_ACCOUNT_ID / CF_ZONE_ID + DOMAIN_AUTOATTACH_ENABLED krävs). Domänen blir live vid nästa deploy via generatorn.'

/** True when the instant-attach path is fully configured + flagged on. */
export function workerDomainsConfigured(): boolean {
  return Boolean(cfToken() && cfAccount() && cfZone() && autoAttachEnabled())
}

/** Build `<slug>.corevo.se`, lowercased + trimmed. */
export function subdomainFor(slug: string): string {
  return `${String(slug ?? '').trim().toLowerCase()}.${ROOT_DOMAIN}`
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${cfToken()}`, 'Content-Type': 'application/json' }
}

type CfEnvelope = { success?: boolean; errors?: { message?: string }[]; result?: unknown }

function cfError(env: CfEnvelope, fallback: string): string {
  const first = env.errors?.find((e) => e?.message)?.message
  return first ? `Cloudflare: ${first}` : fallback
}

/**
 * Attach `<slug>.corevo.se` to the worker as a Worker Custom Domain (idempotent —
 * CF treats PUT as upsert; re-attaching an existing domain is a no-op, never an
 * error, so this is safe to call on every onboarding). NEVER removes anything.
 * Fail-closed when not configured.
 */
export async function attachWorkerSubdomain(
  slug: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<CfResult<WorkerDomain>> {
  if (!workerDomainsConfigured()) return { ok: false, error: MISSING }
  const hostname = subdomainFor(slug)
  let res
  try {
    res = await fetchImpl(`${CF_API_BASE}/accounts/${cfAccount()}/workers/domains`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        zone_id: cfZone(),
        hostname,
        service: workerService(),
        environment: workerEnv(),
      }),
    })
  } catch {
    return { ok: false, error: 'Kunde inte nå Cloudflare. Domänen kopplas vid nästa deploy.' }
  }
  let env: CfEnvelope
  try {
    env = (await res.json()) as CfEnvelope
  } catch {
    return { ok: false, error: `Cloudflare svarade oläsbart (HTTP ${res.status}).` }
  }
  if (!res.ok || env.success === false) {
    return { ok: false, error: cfError(env, `Kunde inte koppla domän (HTTP ${res.status}).`) }
  }
  const r = (env.result ?? {}) as { id?: string; hostname?: string; service?: string; environment?: string }
  return {
    ok: true,
    data: {
      id: String(r.id ?? ''),
      hostname: String(r.hostname ?? hostname),
      service: String(r.service ?? workerService()),
      environment: String(r.environment ?? workerEnv()),
    },
  }
}

/**
 * List the Worker Custom Domains attached to our worker (for the super-admin
 * "Domäner" list + the check_domains guard). Fail-closed when not configured.
 */
export async function listWorkerDomains(
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<CfResult<WorkerDomain[]>> {
  if (!workerDomainsConfigured()) return { ok: false, error: MISSING }
  let res
  try {
    res = await fetchImpl(`${CF_API_BASE}/accounts/${cfAccount()}/workers/domains`, {
      method: 'GET',
      headers: authHeaders(),
    })
  } catch {
    return { ok: false, error: 'Kunde inte nå Cloudflare.' }
  }
  let env: CfEnvelope
  try {
    env = (await res.json()) as CfEnvelope
  } catch {
    return { ok: false, error: `Cloudflare svarade oläsbart (HTTP ${res.status}).` }
  }
  if (!res.ok || env.success === false) {
    return { ok: false, error: cfError(env, `Kunde inte lista domäner (HTTP ${res.status}).`) }
  }
  const list = Array.isArray(env.result) ? (env.result as Record<string, unknown>[]) : []
  const ours = workerService()
  return {
    ok: true,
    data: list
      .filter((r) => !r.service || r.service === ours)
      .map((r) => ({
        id: String(r.id ?? ''),
        hostname: String(r.hostname ?? ''),
        service: String(r.service ?? ours),
        environment: String(r.environment ?? workerEnv()),
      })),
  }
}
