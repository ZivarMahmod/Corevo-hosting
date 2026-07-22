import 'server-only'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/platform/service'
import { portalSessionDigest } from './crypto'
import { PORTAL_SESSION_COOKIE, parsePortalSessionCookie } from './session'

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}
const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

export async function logoutCurrentPortalSession(): Promise<
  { ok: true; tenantSlug: string } | { ok: false }
> {
  try {
    const store = await cookies()
    const credential = parsePortalSessionCookie(store.get(PORTAL_SESSION_COOKIE)?.value)
    const client = createServiceClient() as unknown as RpcClient | null
    if (!credential || !client) return { ok: false }
    const secretDigest = await portalSessionDigest(credential.secret)
    const snapshot = await client.rpc('customer_portal_session_snapshot', {
      p_session_public_id: credential.sessionPublicId,
      p_secret_digest: secretDigest,
    })
    if (snapshot.error || !Array.isArray(snapshot.data) || snapshot.data.length !== 1) {
      return { ok: false }
    }
    const row = snapshot.data[0]
    if (!row || typeof row !== 'object') return { ok: false }
    const record = row as Record<string, unknown>
    const snapshotValue = record.snapshot
    const tenantSlug = record.outcome === 'ok' && snapshotValue && typeof snapshotValue === 'object'
      ? (snapshotValue as Record<string, unknown>).tenantSlug
      : record.outcome === 'expired' ? record.recovery_tenant_slug : null
    if (typeof tenantSlug !== 'string' || !TENANT_SLUG_PATTERN.test(tenantSlug)) return { ok: false }

    const revoked = await client.rpc('customer_portal_revoke_session', {
      p_session_public_id: credential.sessionPublicId,
      p_secret_digest: secretDigest,
    })
    if (revoked.error || revoked.data !== 'ok') return { ok: false }
    store.set(PORTAL_SESSION_COOKIE, '', {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return { ok: true, tenantSlug }
  } catch {
    return { ok: false }
  }
}
