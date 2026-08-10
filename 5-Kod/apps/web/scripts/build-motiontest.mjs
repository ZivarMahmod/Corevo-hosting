import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseJsonc } from 'jsonc-parser'
import {
  assertNoEmbeddedPrivateEnv,
  assertMotiontestBuild,
  motiontestBuildEnvironment,
} from './deploy-motiontest.mjs'
import {
  assertMotiontestReleaseIdentity,
  writeMotiontestArtifactStamp,
} from './motiontest-artifact.mjs'
import { motiontestSystemEnvironment } from './motiontest-child-environment.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const defaultAppDir = resolve(here, '..')
const LOCAL_ENV_FILES = ['.env', '.env.local', '.env.production.local']

function fail(message) {
  throw new Error(`build-motiontest: ${message}`)
}

function samePath(left, right) {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase()
}

function readConfig(appDir) {
  const configPath = resolve(appDir, 'wrangler.jsonc')
  const errors = []
  const config = parseJsonc(readFileSync(configPath, 'utf8'), errors, {
    allowTrailingComma: true,
  })
  if (errors.length) fail('canonical wrangler.jsonc is not valid JSONC')
  return { config, configPath }
}

function serializeDotenv(values) {
  return `${Object.entries(values)
    .map(([key, value]) => {
      const text = String(value)
      if (!/^NEXT_PUBLIC_[A-Z0-9_]+$/.test(key) || /[\r\n]/.test(text)) {
        fail('canonical public build environment is malformed')
      }
      return `${key}=${text}`
    })
    .join('\n')}\n`
}

export function assertNoLocalMotiontestEnv(appDir) {
  const found = LOCAL_ENV_FILES.filter((name) => existsSync(resolve(appDir, name)))
  if (found.length) fail(`local dotenv override is forbidden: ${found.join(', ')}`)
}

export function createMotiontestBuildInvocation({ appDir, cliPath, systemEnv, publicEnv }) {
  if (!/[\\/]@opennextjs[\\/]cloudflare[\\/].+[\\/]cli[\\/]index\.js$/i.test(cliPath)) {
    fail('OpenNext entrypoint must be the local @opennextjs/cloudflare CLI')
  }
  const childEnv = motiontestSystemEnvironment(systemEnv)
  Object.assign(childEnv, publicEnv, { NODE_ENV: 'production' })
  return {
    command: process.execPath,
    args: [cliPath, 'build'],
    options: {
      cwd: appDir,
      env: childEnv,
      shell: false,
      stdio: 'inherit',
    },
  }
}

export function resolveOpenNextCli() {
  const require = createRequire(import.meta.url)
  const apiPath = require.resolve('@opennextjs/cloudflare')
  const cliPath = resolve(dirname(apiPath), '../cli/index.js')
  if (!existsSync(cliPath) || !statSync(cliPath).isFile()) {
    fail('local @opennextjs/cloudflare package has no CLI')
  }
  return cliPath
}

export function runMotiontestBuild({
  appDir = defaultAppDir,
  env = process.env,
  publicEnv,
  cliPath = resolveOpenNextCli(),
  spawnSyncImpl = spawnSync,
  releaseIdentityImpl = assertMotiontestReleaseIdentity,
  stampImpl = writeMotiontestArtifactStamp,
  log = console.log,
} = {}) {
  assertNoLocalMotiontestEnv(appDir)
  const repoDir = resolve(appDir, '../../..')
  const identity = releaseIdentityImpl({ repoDir, env })
  let canonicalPublicEnv = publicEnv
  if (!canonicalPublicEnv) {
    const { config, configPath } = readConfig(appDir)
    canonicalPublicEnv = motiontestBuildEnvironment(config, { appDir, configPath })
  }
  if (!existsSync(cliPath) || !statSync(cliPath).isFile()) fail('local OpenNext CLI is missing')

  const temporaryEnvPath = resolve(appDir, '.env.production.local')
  const invocation = createMotiontestBuildInvocation({
    appDir,
    cliPath,
    systemEnv: env,
    publicEnv: canonicalPublicEnv,
  })
  let result
  try {
    writeFileSync(temporaryEnvPath, serializeDotenv(canonicalPublicEnv), { flag: 'wx' })
    result = spawnSyncImpl(invocation.command, invocation.args, invocation.options)
  } finally {
    if (existsSync(temporaryEnvPath)) unlinkSync(temporaryEnvPath)
  }
  if (result?.error) fail(`OpenNext failed to start: ${result.error.message}`)
  if (result?.status !== 0) fail(`OpenNext exited with status ${result?.status ?? 'unknown'}`)

  assertMotiontestBuild(appDir)
  assertNoEmbeddedPrivateEnv(appDir, canonicalPublicEnv)
  const settledIdentity = releaseIdentityImpl({ repoDir, env })
  if (
    settledIdentity.gitSha !== identity.gitSha ||
    settledIdentity.releaseRef !== identity.releaseRef
  ) {
    fail('release identity changed during build')
  }
  const stamp = stampImpl(appDir, { ...identity, buildEnvironment: canonicalPublicEnv })
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `artifact_sha=${stamp.artifactSha256}\n`)
  }
  log(`Motiontest build stamped for ${identity.gitSha}: ${stamp.artifactSha256}`)
  return { identity, invocation, stamp }
}

const invokedDirectly = process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url))

if (invokedDirectly) {
  try {
    runMotiontestBuild()
  } catch (error) {
    console.error(String(error?.message ?? error))
    process.exitCode = 1
  }
}
