import 'server-only'

// goal-16 — custom-domain → tenant slug resolution for middleware. A customer's
// own domain (already DNS-routed to the worker by Zivar/ops) does NOT match our
// *.corevo.se suffix, so getTenantFromHost returns kind:'unknown'. This async
// fallback asks the DB (resolve_tenant_by_domain RPC, migr 0019) which tenant —
// if any — owns that VERIFIED host on an ACTIVE tenant, and returns its slug.
//
// In-process cache (per worker isolate): positive AND negative TTL so a given host
// hits the RPC at most once per ~5 min — an unknown/unrouted host can't hammer the
// DB on every request. The isolate recycles, so this is a best-effort hot cache,
// never a correctness dependency. RLS/verified=true is the real fence (RPC-side).
const TTL_MS = 5 * 60 * 1000

type Entry = { slug: string | null; exp: number }
const cache = new Map<string, Entry>()

export async function resolveCustomDomainSlug(host: string | null | undefined): Promise<string | null> {
  if (!host) return null
  const key = host.toLowerCase()
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.exp > now) return hit.slug

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null // misconfigured env → treat as unresolved (don't cache)

  let slug: string | null = null
  try {
    // Direct PostgREST RPC (anon) — lighter than the SSR client for a per-request
    // edge lookup. The RPC is SECURITY DEFINER + verified=true/active-fenced and
    // returns a bare text scalar (the slug) or null.
    const res = await fetch(`${url}/rest/v1/rpc/resolve_tenant_by_domain`, {
      method: 'POST',
      headers: {
        apikey: anon,
        authorization: `Bearer ${anon}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_host: key }),
    })
    if (res.ok) {
      const data = await res.json()
      slug = typeof data === 'string' && data ? data : null
    }
  } catch {
    return null // network/edge hiccup → unresolved, and do NOT cache a transient miss
  }

  cache.set(key, { slug, exp: now + TTL_MS })
  return slug
}
