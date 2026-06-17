// fix-35 — the ONE comment-preserving editor for customer domains in wrangler.jsonc.
//
// Locked contract (the spec's shared seam — onboarding-auto + CI-sync reuse THIS,
// never re-implement): a customer domain becomes deploy-safe by living in the
// committed wrangler.jsonc top-level `routes[]` (like the 3 fixed back-office hosts,
// which never go down). Writing the line is a COMMIT, not a deploy.
//
//   upsertCustomDomainRoute(wranglerPath, slug) -> { added: boolean, pattern: string }
//
// Guarantees: comment/format-preserving (jsonc-parser modify+applyEdits, NEVER
// JSON.parse+stringify — that murders the comments, the original FX-14 cause),
// idempotent (added=false when already present), refuses reserved/POS labels and
// any invalid label, NEVER produces a wildcard pattern, and touches ONLY top-level
// routes — never env.staging.routes (which must stay []), the 3 fixed hosts, the
// POS zone, or the *.boka.corevo.se wildcard.

import { readFileSync, writeFileSync } from 'node:fs'
import { parse as parseJsonc, parseTree, findNodeAtLocation } from 'jsonc-parser'

export const ROOT_DOMAIN = 'corevo.se'

/** Routes that MUST be present in every committed wrangler.jsonc, or the platform
 *  loses a door / all storefronts. The 3 back-office custom_domains PLUS the
 *  *.boka.corevo.se/* storefront wildcard (a zone_name route — NOT a custom_domain,
 *  so it never shows up in readCustomDomainPatterns; it must be asserted separately). */
export const REQUIRED_FIXED_ROUTES = [
  'booking.corevo.se',
  'superbooking.corevo.se',
  'minbooking.corevo.se',
  '*.boka.corevo.se/*',
]

// Reserved labels that can NEVER be minted as a tenant subdomain. Mirrors
// gen-deploy-config.mjs RESERVED / lib/tenant.ts DEFAULT_RESERVED so neither the
// generator nor this editor can ever attach a POS host.
export const RESERVED = new Set(
  'booking,admin,app,www,api,superadmin,kiosk,dev,odoo,superbooking,minbooking,boka'.split(','),
)

/** A valid customer DNS label: lowercase letters/digits/hyphen only (no dots, no `*`). */
const VALID_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export function normalizeSlug(raw) {
  return String(raw ?? '').trim().toLowerCase()
}

/** Throws if the slug can't be a safe customer subdomain (empty/reserved/invalid/wildcard). */
export function assertSafeSlug(slug) {
  if (!slug) throw new Error('domain-routes: empty slug')
  if (RESERVED.has(slug)) throw new Error(`domain-routes: '${slug}' is a reserved/POS label — refusing`)
  if (!VALID_LABEL.test(slug)) {
    throw new Error(`domain-routes: '${slug}' is not a valid DNS label (a-z 0-9 -, no dots/wildcards)`)
  }
}

export function patternForSlug(slug) {
  return `${slug}.${ROOT_DOMAIN}`
}

/** All `custom_domain: true` route patterns in a wrangler config TEXT (pure). */
export function readCustomDomainPatternsFromText(text) {
  const cfg = parseJsonc(text, [], { allowTrailingComma: true })
  return (cfg?.routes || [])
    .filter((r) => r && r.custom_domain === true && typeof r.pattern === 'string')
    .map((r) => r.pattern)
}

/** Read the committed custom_domain patterns from a wrangler.jsonc on disk. */
export function readCustomDomainPatterns(wranglerPath) {
  return readCustomDomainPatternsFromText(readFileSync(wranglerPath, 'utf8'))
}

/** EVERY top-level route pattern (custom_domain AND zone_name) in a config TEXT — so
 *  callers can assert the *.boka wildcard, which is NOT a custom_domain. */
export function readAllRoutePatternsFromText(text) {
  const cfg = parseJsonc(text, [], { allowTrailingComma: true })
  return (cfg?.routes || []).filter((r) => r && typeof r.pattern === 'string').map((r) => r.pattern)
}

/** Read all top-level route patterns from a wrangler.jsonc on disk. */
export function readAllRoutePatterns(wranglerPath) {
  return readAllRoutePatternsFromText(readFileSync(wranglerPath, 'utf8'))
}

/**
 * Pure: return the edited wrangler text with `<slug>.corevo.se` inserted as a
 * top-level custom_domain route, in the SAME compact single-line style as the
 * sibling routes (manual offset insertion — never reflows an existing route, never
 * touches comments). Idempotent. Throws if the edit would lose a fixed host or yield
 * a wildcard pattern (writes nothing).
 * @returns {{ text: string, added: boolean, pattern: string }}
 */
export function applyCustomDomainEdit(text, rawSlug) {
  const slug = normalizeSlug(rawSlug)
  assertSafeSlug(slug)
  const pattern = patternForSlug(slug)

  const root = parseTree(text, [], { allowTrailingComma: true })
  const routesNode = root && findNodeAtLocation(root, ['routes'])
  if (!routesNode || routesNode.type !== 'array') {
    throw new Error('domain-routes: wrangler.jsonc has no top-level routes[] array')
  }
  const items = routesNode.children || []
  const existing = items.map((n) => {
    const p = findNodeAtLocation(n, ['pattern'])
    return p ? p.value : undefined
  })
  if (existing.includes(pattern)) return { text, added: false, pattern }

  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const entry = `{ "pattern": "${pattern}", "custom_domain": true }`
  let next
  if (items.length === 0) {
    // Empty array `[]` → open it up with the one entry (never our top-level case,
    // but kept correct for completeness).
    const open = routesNode.offset + 1 // just after '['
    next = `${text.slice(0, open)}${nl}    ${entry}${nl}  ${text.slice(open)}`
  } else {
    const last = items[items.length - 1]
    const insertAt = last.offset + last.length // just after the last element's '}'
    next = `${text.slice(0, insertAt)},${nl}    ${entry}${text.slice(insertAt)}`
  }

  // Post-edit safety re-parse: fixed routes intact, no wildcard customer pattern.
  const after = parseJsonc(next, [], { allowTrailingComma: true })
  const patterns = (after?.routes || []).map((r) => r && r.pattern)
  for (const fixed of REQUIRED_FIXED_ROUTES) {
    if (!patterns.includes(fixed)) throw new Error(`domain-routes: edit would drop fixed route '${fixed}' — aborting`)
  }
  if (patterns.some((p) => typeof p === 'string' && p.startsWith('*.corevo.se'))) {
    throw new Error('domain-routes: refusing — a *.corevo.se wildcard would capture POS subdomains')
  }
  return { text: next, added: true, pattern }
}

/**
 * Read wrangler.jsonc, insert `<slug>.corevo.se` as a committed custom_domain route
 * (idempotent, comment-preserving), write back only if changed.
 * @returns {{ added: boolean, pattern: string }}
 */
export function upsertCustomDomainRoute(wranglerPath, slug) {
  const text = readFileSync(wranglerPath, 'utf8')
  const { text: next, added, pattern } = applyCustomDomainEdit(text, slug)
  if (added) writeFileSync(wranglerPath, next, 'utf8')
  return { added, pattern }
}
