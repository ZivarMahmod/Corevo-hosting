// fix-35 — add a customer domain: `node scripts/add-domain.mjs <slug>`
//
// Does BOTH halves of making <slug>.corevo.se safe, in one command:
//   (1) FILE-PROTECT (durable): insert it into committed wrangler.jsonc top-level
//       routes[] (comment-preserving, idempotent) so EVERY future deploy re-asserts
//       it and can never detach it — same guarantee as the 3 fixed back-office hosts.
//       This is a COMMIT, not a deploy. Done first because it needs no network.
//   (2) LIVE NOW (no redeploy): attach it via the CF Workers Domains API so it is
//       live in seconds — the instant half. Needs CLOUDFLARE_API_TOKEN (DNS:Edit +
//       Workers Routes:Edit) + account/zone. Without a token, (1) still protects it
//       and it goes live at the next deploy.
//
// Idempotent: re-running is a no-op (file line already present, PUT is an upsert).
// After running, COMMIT wrangler.jsonc to lock the protection in.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { upsertCustomDomainRoute, normalizeSlug, assertSafeSlug, patternForSlug } from './domain-routes.mjs'
import { cfApi, resolveZoneId, resolveAccountId, attachWorkerDomain } from './cf-domains.mjs'

const DEFAULT_WORKER = process.env.CF_WORKER_NAME || 'bokningsplatformen'

/**
 * Core, dependency-injected: file-protect always; live-attach when a token is given.
 * Validates the slug BEFORE any side effect. Returns what happened.
 * @returns {Promise<{ added: boolean, attached: boolean, pattern: string }>}
 */
export async function addDomain({ wranglerPath, slug, token, accountId, zoneId, worker = DEFAULT_WORKER, fetchImpl }) {
  const s = normalizeSlug(slug)
  assertSafeSlug(s) // throws on empty/reserved/invalid BEFORE touching the file
  const pattern = patternForSlug(s)

  const { added } = upsertCustomDomainRoute(wranglerPath, s)

  let attached = false
  if (token) {
    const request = cfApi(token, fetchImpl)
    const acct = await resolveAccountId(request, accountId)
    const zid = zoneId || (await resolveZoneId(request))
    await attachWorkerDomain(request, { accountId: acct, hostname: pattern, service: worker, zoneId: zid })
    attached = true
  }
  return { added, attached, pattern }
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const wranglerPath = resolve(here, '..', 'wrangler.jsonc')
  const token = process.env.CLOUDFLARE_API_TOKEN

  const { added, attached, pattern } = await addDomain({
    wranglerPath,
    slug: process.argv[2],
    token,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
  })

  console.log(
    added
      ? `✓ wrangler.jsonc: added top-level route { "${pattern}", custom_domain }`
      : `• wrangler.jsonc: '${pattern}' already present (no change)`,
  )
  if (attached) {
    console.log(`✓ live now via CF API: ${pattern} → ${DEFAULT_WORKER}`)
    console.log('→ COMMIT wrangler.jsonc to protect it across all future deploys (commit ≠ deploy).')
  } else {
    console.warn(
      `⚠ CLOUDFLARE_API_TOKEN not set — skipped instant live-attach. '${pattern}' is PROTECTED in wrangler.jsonc and goes live at the next deploy. COMMIT wrangler.jsonc to lock it in.`,
    )
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`✖ add-domain failed: ${err && err.message ? err.message : err}`)
    process.exit(1)
  })
}
