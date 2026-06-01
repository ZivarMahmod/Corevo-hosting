import 'server-only'
import { headers } from 'next/headers'

/**
 * Absolute origin of the current request (scheme + host), e.g.
 * `https://frisor1.corevo.se`. Built from the forwarded host/proto headers so
 * Stripe return/success URLs land back on the SAME tenant subdomain the admin/
 * kund is on. Falls back to NEXT_PUBLIC_SITE_URL when no host header is present.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}
