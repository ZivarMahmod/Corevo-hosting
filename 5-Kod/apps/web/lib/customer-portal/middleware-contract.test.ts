import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8')

describe('middleware customer portal firewall integration', () => {
  it('applies the pure route policy before Supabase session work', () => {
    const policy = source.indexOf('decideCustomerPortalHostRoute(')
    const session = source.indexOf('updateSession(request')
    expect(policy).toBeGreaterThan(-1)
    expect(session).toBeGreaterThan(policy)
  })

  it('returns an explicitly private 404 when the policy denies', () => {
    expect(source).toContain("portalRouteDecision === 'deny'")
    expect(source).toMatch(/status:\s*404/)
    expect(source).toContain("response.headers.set('cache-control', 'no-store')")
    expect(source).toContain("response.headers.set('referrer-policy', 'no-referrer')")
    expect(source).toContain('hardenCustomerPortalResponse(new NextResponse')
  })

  it('matches static requests so mina cannot bypass the asset allowlist', () => {
    expect(source).toContain("matcher: ['/:path*']")
  })
})
