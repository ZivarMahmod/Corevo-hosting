// Generate the production deploy config from the live Cloudflare Worker Domains.
//
// A tenant's exact <slug>.corevo.se hostname is created in Cloudflare at onboarding.
// Cloudflare is therefore the canonical owner for tenant routes. Before every
// deployment we read that list and write a temporary config containing every live
// hostname, so a new build cannot detach an existing tenant site.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { REQUIRED_FIXED_ROUTES } from './domain-routes.mjs'
import { cfApi, resolveAccountId, listWorkerDomains } from './cf-domains.mjs'

const WORKER = process.env.CF_WORKER_NAME || 'bokningsplatformen'

export const REQUIRED_FIXED_HOSTS = [
  'booking.corevo.se',
  'superbooking.corevo.se',
  'minbooking.corevo.se',
  'mina.corevo.se',
]

function normalizeHost(host) {
  return String(host ?? '').trim().toLowerCase()
}

/** Union the committed fixed routes with every domain Cloudflare says is live. */
export function buildRoutes(baseRoutes, liveDomains) {
  const routes = [...baseRoutes]
  const present = new Set(routes.map((route) => normalizeHost(route?.pattern)))
  const missing = REQUIRED_FIXED_HOSTS.filter((host) => !present.has(host))
  if (missing.length) {
    throw new Error(
      `gen-deploy-config: required fixed host(s) missing from wrangler.jsonc: ${missing.join(', ')}`,
    )
  }

  for (const hostname of [...new Set((liveDomains || []).map(normalizeHost).filter(Boolean))].sort()) {
    if (!present.has(hostname)) {
      routes.push({ pattern: hostname, custom_domain: true })
      present.add(hostname)
    }
  }
  return routes
}

/** Parse the committed base config and return the deploy-only route union. */
export function createDeployConfig(sourceText, liveDomains) {
  const config = parseJsonc(sourceText, [], { allowTrailingComma: true })
  if (!config || !Array.isArray(config.routes)) {
    throw new Error('gen-deploy-config: wrangler.jsonc has no top-level routes[] array')
  }
  const fixedPatterns = new Set(config.routes.map((route) => normalizeHost(route?.pattern)))
  const missingFixed = REQUIRED_FIXED_ROUTES.filter((route) => !fixedPatterns.has(route))
  if (missingFixed.length) {
    throw new Error(`gen-deploy-config: fixed route(s) missing: ${missingFixed.join(', ')}`)
  }
  return { ...config, routes: buildRoutes(config.routes, liveDomains) }
}

export function writeDeployConfig({ sourceText, liveDomains, outputPath }) {
  const config = createDeployConfig(sourceText, liveDomains)
  writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return config
}

function outputPathFromArgs(args) {
  const index = args.indexOf('--output')
  return index >= 0 ? args[index + 1] : null
}

async function main() {
  const outputPath = outputPathFromArgs(process.argv.slice(2))
  if (!outputPath) {
    throw new Error('gen-deploy-config: pass --output <path>')
  }
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('gen-deploy-config: CLOUDFLARE_API_TOKEN is required')

  const here = dirname(fileURLToPath(import.meta.url))
  const appDir = resolve(here, '..')
  const sourceText = readFileSync(resolve(appDir, 'wrangler.jsonc'), 'utf8')
  const request = cfApi(token)
  const accountId = await resolveAccountId(request, process.env.CLOUDFLARE_ACCOUNT_ID)
  const liveDomains = await listWorkerDomains(request, accountId, WORKER)
  const config = writeDeployConfig({ sourceText, liveDomains, outputPath: resolve(appDir, outputPath) })

  console.log(`✓ Generated deploy config from ${liveDomains.length} live Worker domain(s).`)
  console.log(`  deploy routes: ${config.routes.map((route) => route.pattern).join(', ')}`)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  main().catch((error) => {
    console.error(String(error?.message ?? error))
    process.exit(1)
  })
}
