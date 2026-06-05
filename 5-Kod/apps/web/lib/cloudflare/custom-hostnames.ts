import 'server-only'

// goal-23: thin client for the Cloudflare for SaaS "Custom Hostnames" API — the
// WRITE half of custom-domain support (the read half = 0019 resolve_tenant_by_domain
// + lib/custom-domain.ts, already live). It provisions a customer's own domain as a
// custom hostname on the corevo.se zone and surfaces the DCV (domain control
// validation) records the customer must add at their DNS provider.
//
// FAIL-CLOSED: CF_API_TOKEN / CF_ZONE_ID are server secrets, EMPTY in local/dev and
// until Zivar provisions them (ops-gated). Every call returns a typed { ok:false }
// error instead of throwing, so the build + the flag-off panel never crash. The token
// must NEVER reach the browser (server-only) and is NEVER committed.

// Env read LAZILY (not module-const): safer across runtimes where the binding isn't
// ready at module-eval, and lets tests stub process.env per case.
const cfToken = () => process.env.CF_API_TOKEN
const cfZone = () => process.env.CF_ZONE_ID
/** Optional: the SaaS fallback origin the customer CNAMEs their hostname to. */
const cfFallbackOrigin = () => process.env.CF_FALLBACK_ORIGIN
const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

/** A DNS record the customer must create for routing or SSL validation (DCV). */
export type DcvRecord = {
  type: 'TXT' | 'CNAME'
  name: string
  value: string
  /** Why this record exists (UI label): 'Routing' | 'Ägarskap' | 'SSL (DCV)'. */
  purpose: string
}

export type CustomHostname = {
  id: string
  hostname: string
  /** CF hostname status: 'pending' | 'pending_validation' | 'active' | 'blocked' | … */
  status: string
  /** CF SSL status: 'pending_validation' | 'active' | … (null when absent). */
  sslStatus: string | null
  /** Records the customer adds at their DNS provider. */
  dcv: DcvRecord[]
}

/** Result wrapper — callers branch on `ok`; no throw on the expected CF/secret paths. */
export type CfResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** A fetch with the same shape as the global — injectable so tests need no network. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/** True when both CF secrets are present (the provisioning path is available). */
export function hasCloudflareCredentials(): boolean {
  return Boolean(cfToken() && cfZone())
}

const MISSING_CREDS =
  'Cloudflare-uppgifter saknas (CF_API_TOKEN / CF_ZONE_ID). Domän-provisionering är inte aktiverad — sätts av drift.'

// ── CF response shapes (only the fields we read; defensive everywhere else) ───────
type CfEnvelope = {
  success?: boolean
  errors?: { message?: string }[]
  result?: unknown
}
type CfHostnameResult = {
  id?: string
  hostname?: string
  status?: string
  ssl?: {
    status?: string
    method?: string
    validation_records?: {
      txt_name?: string
      txt_value?: string
      cname?: string
      cname_target?: string
    }[]
  }
  ownership_verification?: { type?: string; name?: string; value?: string }
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${cfToken()}`,
    'Content-Type': 'application/json',
  }
}

function cfErrorMessage(env: CfEnvelope, fallback: string): string {
  const first = env.errors?.find((e) => e?.message)?.message
  return first ? `Cloudflare: ${first}` : fallback
}

/** Map a CF hostname result → our CustomHostname (extract DCV records defensively). */
function toCustomHostname(r: CfHostnameResult, domain: string): CustomHostname {
  const dcv: DcvRecord[] = []

  // 1) Routing: the customer CNAMEs their hostname → the SaaS fallback origin.
  const fallback = cfFallbackOrigin()
  if (fallback) {
    dcv.push({ type: 'CNAME', name: domain, value: fallback, purpose: 'Routing' })
  }
  // 2) Hostname ownership pre-validation (TXT), when CF asks for it.
  const ov = r.ownership_verification
  if (ov?.name && ov?.value) {
    dcv.push({ type: 'TXT', name: ov.name, value: ov.value, purpose: 'Ägarskap' })
  }
  // 3) SSL DCV records (TXT or CNAME), as CF returns them.
  for (const vr of r.ssl?.validation_records ?? []) {
    if (vr.txt_name && vr.txt_value) {
      dcv.push({ type: 'TXT', name: vr.txt_name, value: vr.txt_value, purpose: 'SSL (DCV)' })
    } else if (vr.cname && vr.cname_target) {
      dcv.push({ type: 'CNAME', name: vr.cname, value: vr.cname_target, purpose: 'SSL (DCV)' })
    }
  }

  return {
    id: String(r.id ?? ''),
    hostname: String(r.hostname ?? domain),
    status: String(r.status ?? 'pending'),
    sslStatus: r.ssl?.status ? String(r.ssl.status) : null,
    dcv,
  }
}

async function readEnvelope(
  res: { ok: boolean; status: number; json: () => Promise<unknown> },
  fallback: string,
): Promise<CfResult<CfHostnameResult> & { raw?: CfEnvelope }> {
  let env: CfEnvelope
  try {
    env = (await res.json()) as CfEnvelope
  } catch {
    return { ok: false, error: `Cloudflare svarade oläsbart (HTTP ${res.status}).` }
  }
  if (!res.ok || env.success === false) {
    return { ok: false, error: cfErrorMessage(env, `${fallback} (HTTP ${res.status}).`) }
  }
  return { ok: true, data: (env.result ?? {}) as CfHostnameResult }
}

/**
 * Create a custom hostname (DV/txt SSL) for `domain` on the corevo.se zone. Returns
 * the hostname id + the DCV records the customer must add. Fail-closed without creds.
 */
export async function createCustomHostname(
  domain: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<CfResult<CustomHostname>> {
  if (!hasCloudflareCredentials()) return { ok: false, error: MISSING_CREDS }
  let res
  try {
    res = await fetchImpl(`${CF_API_BASE}/zones/${cfZone()}/custom_hostnames`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        hostname: domain,
        ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } },
      }),
    })
  } catch {
    return { ok: false, error: 'Kunde inte nå Cloudflare. Försök igen.' }
  }
  const parsed = await readEnvelope(res, 'Kunde inte skapa custom hostname')
  if (!parsed.ok) return parsed
  return { ok: true, data: toCustomHostname(parsed.data, domain) }
}

/**
 * Look up a custom hostname by its name (we store no CF id — tenant_domains has no
 * column for it). Returns null-data when CF knows no such hostname.
 */
export async function getCustomHostnameByName(
  domain: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<CfResult<CustomHostname | null>> {
  if (!hasCloudflareCredentials()) return { ok: false, error: MISSING_CREDS }
  let res
  try {
    res = await fetchImpl(
      `${CF_API_BASE}/zones/${cfZone()}/custom_hostnames?hostname=${encodeURIComponent(domain)}`,
      { method: 'GET', headers: authHeaders() },
    )
  } catch {
    return { ok: false, error: 'Kunde inte nå Cloudflare. Försök igen.' }
  }
  let env: CfEnvelope
  try {
    env = (await res.json()) as CfEnvelope
  } catch {
    return { ok: false, error: `Cloudflare svarade oläsbart (HTTP ${res.status}).` }
  }
  if (!res.ok || env.success === false) {
    return { ok: false, error: cfErrorMessage(env, `Kunde inte läsa custom hostname (HTTP ${res.status}).`) }
  }
  const list = Array.isArray(env.result) ? (env.result as CfHostnameResult[]) : []
  // EXACT match only — never fall back to list[0]. CF's ?hostname= filter could return
  // a sibling (or change semantics), and verify/remove key on this result: a wrong
  // match would flip the wrong domain's verified flag or delete another tenant's
  // custom hostname. No exact match → null (the callers handle it).
  const match = list.find((r) => r.hostname === domain)
  return { ok: true, data: match ? toCustomHostname(match, domain) : null }
}

/** Delete a custom hostname by CF id. Fail-closed without creds. */
export async function deleteCustomHostname(
  id: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<CfResult<true>> {
  if (!hasCloudflareCredentials()) return { ok: false, error: MISSING_CREDS }
  if (!id) return { ok: false, error: 'Saknar custom hostname-id.' }
  let res
  try {
    res = await fetchImpl(`${CF_API_BASE}/zones/${cfZone()}/custom_hostnames/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  } catch {
    return { ok: false, error: 'Kunde inte nå Cloudflare. Försök igen.' }
  }
  const parsed = await readEnvelope(res, 'Kunde inte ta bort custom hostname')
  if (!parsed.ok) return parsed
  return { ok: true, data: true }
}
