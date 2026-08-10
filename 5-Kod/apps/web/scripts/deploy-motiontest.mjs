import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseJsonc } from 'jsonc-parser'
import {
  assertMotiontestArtifact,
  assertMotiontestReleaseIdentity,
} from './motiontest-artifact.mjs'
import {
  MOTIONTEST_PROPAGATION_PENDING_CODE,
  verifyLiveFreshCutBaseline,
  verifyMotiontestRelease,
} from './verify-motiontest-release.mjs'
import { motiontestSystemEnvironment } from './motiontest-child-environment.mjs'

const MOTIONTEST_ENV = 'motiontest'
const MOTIONTEST_WORKER = 'freshcut-motiontest'
const MOTIONTEST_HOST = 'motiontest.corevo.se'
const MOTIONTEST_MAIN = './motiontest-worker.mjs'
const CANONICAL_SUPABASE_PROJECT_REF = 'clylvowtowbtotrahuad'
const DEFAULT_PROPAGATION_INTERVAL_MS = 2_000
const DEFAULT_PROPAGATION_TIMEOUT_MS = 120_000
const ALLOWED_ENV_FIELDS = new Set([
  'name',
  'main',
  'workers_dev',
  'preview_urls',
  'triggers',
  'assets',
  'observability',
  'routes',
  'vars',
])
const PUBLIC_SUPABASE_VARS = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL']
const GENERATED_ENV_MODES = ['development', 'production', 'test']
const ALLOWED_EMBEDDED_ENV_KEYS = new Set([
  'NEXT_PUBLIC_CUSTOMER_PORTAL_HOST',
  'NEXT_PUBLIC_PLATFORM_HOST',
  'NEXT_PUBLIC_RESERVED_SUBDOMAINS',
  'NEXT_PUBLIC_ROOT_DOMAIN',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPERADMIN_HOST',
  'NEXT_PUBLIC_TENANT_HOST_SUFFIX',
  'NEXT_PUBLIC_TENANT_MODE',
  ...PUBLIC_SUPABASE_VARS,
])
const here = dirname(fileURLToPath(import.meta.url))
const defaultAppDir = resolve(here, '..')

export function parseMotiontestArgs(args) {
  if (args.length === 0) return { dryRun: false }
  if (args.length === 1 && args[0] === '--dry-run') return { dryRun: true }
  throw new Error(`deploy-motiontest: unknown arguments: ${args.join(' ')}`)
}

function fail(message) {
  throw new Error(`deploy-motiontest: ${message}`)
}

function sleep(durationMs) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, durationMs))
}

export async function verifyMotiontestAfterPropagation({
  intervalMs = DEFAULT_PROPAGATION_INTERVAL_MS,
  liveBaseline,
  nowImpl = Date.now,
  sleepImpl = sleep,
  timeoutMs = DEFAULT_PROPAGATION_TIMEOUT_MS,
  verifyImpl = verifyMotiontestRelease,
}) {
  if (
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0 ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    typeof nowImpl !== 'function' ||
    typeof sleepImpl !== 'function' ||
    typeof verifyImpl !== 'function'
  ) {
    fail('propagation retry inputs are invalid')
  }

  const deadlineAt = nowImpl() + timeoutMs
  let attempts = 0
  let lastError
  while (true) {
    attempts += 1
    try {
      const verified = await verifyImpl({ deadlineAt, liveBaseline })
      if (nowImpl() > deadlineAt) {
        fail(`public verification exceeded its ${timeoutMs} ms propagation deadline`)
      }
      return verified
    } catch (error) {
      if (error?.code !== MOTIONTEST_PROPAGATION_PENDING_CODE) throw error
      lastError = error
    }

    const remainingMs = deadlineAt - nowImpl()
    if (remainingMs <= 0) {
      fail(
        `public verification did not converge within ${timeoutMs} ms after ${attempts} attempts: ${String(lastError?.message ?? lastError)}`,
      )
    }
    await sleepImpl(Math.min(intervalMs, remainingMs))
  }
}

function samePath(left, right) {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase()
}

function validatePublicSupabaseVars(vars, canonicalVars) {
  if (!vars || Object.keys(vars).sort().join(',') !== PUBLIC_SUPABASE_VARS.join(',')) {
    fail(`motiontest must expose only public Supabase vars: ${PUBLIC_SUPABASE_VARS.join(', ')}`)
  }

  let url
  let payload
  try {
    url = new URL(vars.NEXT_PUBLIC_SUPABASE_URL)
    payload = JSON.parse(
      Buffer.from(vars.NEXT_PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString('utf8'),
    )
  } catch {
    fail('motiontest public Supabase vars are malformed')
  }

  const projectRef = url.hostname.split('.')[0]
  if (
    url.protocol !== 'https:' ||
    !/^[a-z]{20}\.supabase\.co$/.test(url.hostname) ||
    payload.iss !== 'supabase' ||
    payload.role !== 'anon' ||
    payload.ref !== projectRef ||
    projectRef !== CANONICAL_SUPABASE_PROJECT_REF ||
    vars.NEXT_PUBLIC_SUPABASE_URL !== canonicalVars?.NEXT_PUBLIC_SUPABASE_URL ||
    vars.NEXT_PUBLIC_SUPABASE_ANON_KEY !== canonicalVars?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    fail('motiontest must use the exact canonical production Supabase project and anon key')
  }
}

export function validateMotiontestConfig(config, { appDir, configPath }) {
  const canonicalConfigPath = resolve(appDir, 'wrangler.jsonc')
  if (!samePath(configPath, canonicalConfigPath)) {
    fail('only the canonical wrangler.jsonc config is allowed')
  }

  const motiontest = config?.env?.[MOTIONTEST_ENV]
  if (!motiontest || typeof motiontest !== 'object') fail('missing env.motiontest')

  const unexpected = Object.keys(motiontest).filter((key) => !ALLOWED_ENV_FIELDS.has(key))
  if (unexpected.length) fail(`motiontest has unexpected field(s): ${unexpected.join(', ')}`)
  if (motiontest.name !== MOTIONTEST_WORKER) fail(`motiontest Worker must be ${MOTIONTEST_WORKER}`)
  if (motiontest.main !== MOTIONTEST_MAIN) {
    fail(`motiontest entrypoint must be ${MOTIONTEST_MAIN}, never the production scheduler`)
  }
  if (motiontest.workers_dev !== false) fail('motiontest workers.dev must be disabled')
  if (motiontest.preview_urls !== false) fail('motiontest preview URLs must be disabled')

  if (
    !motiontest.triggers ||
    Object.keys(motiontest.triggers).join(',') !== 'crons' ||
    !Array.isArray(motiontest.triggers.crons) ||
    motiontest.triggers.crons.length !== 0
  ) {
    fail('motiontest cron triggers must be exactly empty')
  }

  if (
    !motiontest.assets ||
    Object.keys(motiontest.assets).sort().join(',') !== 'binding,directory,run_worker_first' ||
    motiontest.assets.binding !== 'ASSETS' ||
    motiontest.assets.directory !== '.open-next/assets' ||
    motiontest.assets.run_worker_first !== true
  ) {
    fail('motiontest assets must run Worker first through the isolated OpenNext ASSETS binding')
  }

  if (
    !motiontest.observability ||
    Object.keys(motiontest.observability).join(',') !== 'enabled' ||
    motiontest.observability.enabled !== false
  ) {
    fail('motiontest observability must be explicitly disabled')
  }

  if (!Array.isArray(motiontest.routes) || motiontest.routes.length !== 1) {
    fail('motiontest must have exactly one route')
  }
  const route = motiontest.routes[0]
  if (Object.keys(route).sort().join(',') !== 'custom_domain,pattern') {
    fail('motiontest route may contain only pattern and custom_domain')
  }
  if (route.pattern !== MOTIONTEST_HOST) fail(`motiontest route must be ${MOTIONTEST_HOST}`)
  if (route.custom_domain !== true) fail('motiontest route must be a custom domain')

  validatePublicSupabaseVars(motiontest.vars, config.vars)
  return motiontest
}

export function motiontestBuildEnvironment(config, options) {
  const motiontest = validateMotiontestConfig(config, options)
  const expectedTopLevel = {
    NEXT_PUBLIC_ROOT_DOMAIN: 'corevo.se',
    NEXT_PUBLIC_PLATFORM_HOST: 'booking.corevo.se',
    NEXT_PUBLIC_SUPERADMIN_HOST: 'superbooking.corevo.se',
    NEXT_PUBLIC_CUSTOMER_PORTAL_HOST: 'mina.corevo.se',
    NEXT_PUBLIC_TENANT_HOST_SUFFIX: 'corevo.se',
  }
  for (const [key, expected] of Object.entries(expectedTopLevel)) {
    if (config.vars?.[key] !== expected) fail(`canonical production ${key} is unexpected`)
  }
  const reserved = String(config.vars?.NEXT_PUBLIC_RESERVED_SUBDOMAINS ?? '')
  if (!reserved.split(',').includes('motiontest')) {
    fail('canonical reserved subdomains must include motiontest')
  }
  return {
    ...expectedTopLevel,
    NEXT_PUBLIC_RESERVED_SUBDOMAINS: reserved,
    NEXT_PUBLIC_TENANT_MODE: 'live',
    NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se',
    NEXT_PUBLIC_SUPABASE_URL: motiontest.vars.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: motiontest.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export function assertMotiontestBuild(appDir) {
  const workerPath = resolve(appDir, '.open-next/worker.js')
  const assetsPath = resolve(appDir, '.open-next/assets')
  if (!existsSync(workerPath) || !statSync(workerPath).isFile()) {
    fail('missing OpenNext Worker build (.open-next/worker.js)')
  }
  if (!existsSync(assetsPath) || !statSync(assetsPath).isDirectory()) {
    fail('missing OpenNext assets build (.open-next/assets)')
  }
}

export function assertNoEmbeddedPrivateEnv(appDir, expectedBuildEnvironment) {
  const generatedEnvPath = resolve(appDir, '.open-next/cloudflare/next-env.mjs')
  if (!existsSync(generatedEnvPath) || !statSync(generatedEnvPath).isFile()) {
    fail('missing OpenNext generated env contract (.open-next/cloudflare/next-env.mjs)')
  }

  const source = readFileSync(generatedEnvPath, 'utf8').trim()
  const modes = new Map()
  for (const line of source.split(/\r?\n/)) {
    const match = /^export const (development|production|test) = (\{.*\});$/.exec(line)
    if (!match || modes.has(match[1])) fail('OpenNext generated env contract is malformed')

    let values
    try {
      values = JSON.parse(match[2])
    } catch {
      fail('OpenNext generated env contract is malformed')
    }
    if (!values || Array.isArray(values) || typeof values !== 'object') {
      fail('OpenNext generated env contract is malformed')
    }
    modes.set(match[1], values)
  }

  if (GENERATED_ENV_MODES.some((mode) => !modes.has(mode)) || modes.size !== 3) {
    fail('OpenNext generated env contract must contain exactly development, production, and test')
  }

  for (const mode of ['development', 'test']) {
    if (Object.keys(modes.get(mode)).length !== 0) {
      fail(`${mode} embedded env must be empty in the motiontest artifact`)
    }
  }

  const production = modes.get('production')
  const actualKeys = Object.keys(production).sort()
  const expectedKeys = Object.keys(expectedBuildEnvironment).sort()
  const privateKeys = actualKeys.filter((key) => !ALLOWED_EMBEDDED_ENV_KEYS.has(key))
  if (privateKeys.length) fail(`private embedded env is forbidden: ${privateKeys.join(', ')}`)
  if (actualKeys.join(',') !== expectedKeys.join(',')) {
    fail('production embedded env must contain exactly the canonical motiontest public values')
  }
  for (const key of expectedKeys) {
    if (production[key] !== expectedBuildEnvironment[key]) {
      fail('production embedded env must contain exactly the canonical motiontest public values')
    }
  }
}

export function assertNoGeneratedConfigRedirect(appDir) {
  const redirectPath = resolve(appDir, '.wrangler/deploy/config.json')
  if (existsSync(redirectPath)) {
    fail('generated config redirect is forbidden; deploy must read canonical wrangler.jsonc')
  }
}

export function createWranglerInvocation({ appDir, dryRun, env, wranglerBinPath }) {
  if (!/[\\/]wrangler[\\/]bin[\\/]wrangler\.js$/i.test(wranglerBinPath)) {
    fail('Wrangler entrypoint must be the local wrangler/bin/wrangler.js, never a deploy script')
  }

  const childEnv = motiontestSystemEnvironment(env)
  if (!dryRun) {
    childEnv.CLOUDFLARE_API_TOKEN = env.MOTIONTEST_CLOUDFLARE_API_TOKEN
    childEnv.CLOUDFLARE_ACCOUNT_ID = env.MOTIONTEST_CLOUDFLARE_ACCOUNT_ID
  }

  return {
    command: process.execPath,
    args: [
      wranglerBinPath,
      'deploy',
      '--config',
      resolve(appDir, 'wrangler.jsonc'),
      '--env',
      MOTIONTEST_ENV,
      '--strict',
      ...(dryRun ? ['--dry-run'] : []),
    ],
    options: {
      cwd: appDir,
      env: childEnv,
      shell: false,
      stdio: 'inherit',
    },
  }
}

function resolveWranglerBin() {
  return createRequire(import.meta.url).resolve('wrangler/bin/wrangler.js')
}

function requireDeployCredentials(env) {
  if (
    !String(env.MOTIONTEST_CLOUDFLARE_API_TOKEN ?? '').trim() ||
    !String(env.MOTIONTEST_CLOUDFLARE_ACCOUNT_ID ?? '').trim()
  ) {
    fail('real publish requires motiontest-specific Cloudflare deploy credentials before spawn')
  }
}

function expectedArtifactSha(env) {
  const value = String(env.MOTIONTEST_EXPECTED_ARTIFACT_SHA ?? '').trim()
  if (!/^[a-f0-9]{64}$/.test(value)) fail('expected artifact SHA is required')
  return value
}

export async function runMotiontestDeploy({
  appDir = defaultAppDir,
  args = process.argv.slice(2),
  env = process.env,
  log = console.log,
  spawnSyncImpl = spawnSync,
  wranglerBinPath = resolveWranglerBin(),
  releaseIdentityImpl = assertMotiontestReleaseIdentity,
  artifactImpl = assertMotiontestArtifact,
  nowImpl = Date.now,
  preflightImpl = verifyLiveFreshCutBaseline,
  propagationIntervalMs = DEFAULT_PROPAGATION_INTERVAL_MS,
  propagationTimeoutMs = DEFAULT_PROPAGATION_TIMEOUT_MS,
  sleepImpl = sleep,
  verifyImpl = verifyMotiontestRelease,
} = {}) {
  const { dryRun } = parseMotiontestArgs(args)
  const configPath = resolve(appDir, 'wrangler.jsonc')
  const parseErrors = []
  const config = parseJsonc(readFileSync(configPath, 'utf8'), parseErrors, {
    allowTrailingComma: true,
  })
  if (parseErrors.length) fail('canonical wrangler.jsonc is not valid JSONC')

  validateMotiontestConfig(config, { appDir, configPath })
  const buildEnvironment = motiontestBuildEnvironment(config, { appDir, configPath })
  assertNoGeneratedConfigRedirect(appDir)
  assertMotiontestBuild(appDir)
  assertNoEmbeddedPrivateEnv(appDir, buildEnvironment)
  const repoDir = resolve(appDir, '../../..')
  const identity = releaseIdentityImpl({ repoDir, env })
  const artifactSha256 = expectedArtifactSha(env)
  const artifact = artifactImpl(appDir, { ...identity, artifactSha256 })
  if (!dryRun) requireDeployCredentials(env)
  if (!existsSync(wranglerBinPath) || !statSync(wranglerBinPath).isFile()) {
    fail('local Wrangler CLI is missing')
  }

  const invocation = createWranglerInvocation({ appDir, dryRun, env, wranglerBinPath })
  const liveBaseline = dryRun ? null : await preflightImpl()
  const result = spawnSyncImpl(invocation.command, invocation.args, invocation.options)
  if (result.error) fail(`Wrangler failed to start: ${result.error.message}`)
  if (result.status !== 0) fail(`Wrangler exited with status ${result.status ?? 'unknown'}`)

  if (dryRun) {
    log('Motiontest dry-run complete; nothing was published.')
  } else {
    await verifyMotiontestAfterPropagation({
      intervalMs: propagationIntervalMs,
      liveBaseline,
      nowImpl,
      sleepImpl,
      timeoutMs: propagationTimeoutMs,
      verifyImpl,
    })
    log('Motiontest Worker published and public isolation verified.')
  }
  return { dryRun, invocation, identity, artifact }
}

const invokedDirectly = process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url))

if (invokedDirectly) {
  runMotiontestDeploy().catch((error) => {
    console.error(String(error?.message ?? error))
    process.exitCode = 1
  })
}
