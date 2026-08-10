// Production route contract.
//
// Tenant domains are NOT hand-maintained in wrangler.jsonc. Cloudflare Worker
// Domains is their runtime owner; gen-deploy-config.mjs reads that live list before
// every deploy and emits the temporary Wrangler config. The committed config owns
// only fixed platform doors.

import { readFileSync } from 'node:fs'
import { parse as parseJsonc } from 'jsonc-parser'

export const ROOT_DOMAIN = 'corevo.se'

/** Routes that must exist in every production deployment. */
export const REQUIRED_FIXED_ROUTES = [
  'booking.corevo.se',
  'superbooking.corevo.se',
  'minbooking.corevo.se',
  'mina.corevo.se',
]

/** Labels that can never be minted as tenant addresses on the shared POS zone. */
export const RESERVED = new Set(
  'booking,admin,app,www,api,superadmin,kiosk,dev,odoo,superbooking,minbooking,boka,mina,internal,localhost,portal,sms,motiontest'.split(
    ',',
  ),
)

const VALID_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export function normalizeSlug(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/** Fail closed before Cloudflare receives a tenant hostname. */
export function assertSafeSlug(slug) {
  if (!slug) throw new Error('domain-routes: empty slug')
  if (RESERVED.has(slug))
    throw new Error(`domain-routes: '${slug}' is a reserved/POS label — refusing`)
  if (!VALID_LABEL.test(slug)) {
    throw new Error(
      `domain-routes: '${slug}' is not a valid DNS label (a-z 0-9 -, no dots/wildcards)`,
    )
  }
}

export function patternForSlug(rawSlug) {
  const slug = normalizeSlug(rawSlug)
  assertSafeSlug(slug)
  return `${slug}.${ROOT_DOMAIN}`
}

export function readAllRoutePatternsFromText(text) {
  const cfg = parseJsonc(text, [], { allowTrailingComma: true })
  return (cfg?.routes || []).filter((r) => r && typeof r.pattern === 'string').map((r) => r.pattern)
}

export function readAllRoutePatterns(wranglerPath) {
  return readAllRoutePatternsFromText(readFileSync(wranglerPath, 'utf8'))
}
