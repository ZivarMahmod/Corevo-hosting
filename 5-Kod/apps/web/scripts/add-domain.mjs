// Manually create one exact tenant host when Superbooking is unavailable.
//
// This talks to Cloudflare only. The next deploy reads live Worker Domains and
// includes this hostname automatically; no wrangler.jsonc edit or Git commit is needed.

import { cfApi, resolveZoneId, resolveAccountId, attachWorkerDomain } from './cf-domains.mjs'
import { patternForSlug } from './domain-routes.mjs'

const DEFAULT_WORKER = process.env.CF_WORKER_NAME || 'bokningsplatformen'

export async function addDomain({ slug, token, accountId, zoneId, worker = DEFAULT_WORKER, fetchImpl }) {
  const pattern = patternForSlug(slug)
  if (!token) throw new Error('add-domain: CLOUDFLARE_API_TOKEN is required')

  const request = cfApi(token, fetchImpl)
  const account = await resolveAccountId(request, accountId)
  const zone = zoneId || (await resolveZoneId(request))
  await attachWorkerDomain(request, { accountId: account, hostname: pattern, service: worker, zoneId: zone })
  return { pattern, attached: true }
}

async function main() {
  const { pattern } = await addDomain({
    slug: process.argv[2],
    token: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
  })
  console.log(`✓ ${pattern} är ansluten till ${DEFAULT_WORKER}. Nästa deploy bevarar den automatiskt.`)
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  main().catch((error) => {
    console.error(`✖ ${error?.message ?? error}`)
    process.exit(1)
  })
}
