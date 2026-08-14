import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { relative, resolve, sep } from 'node:path'

export const MOTIONTEST_RELEASE_REF = 'refs/heads/main'
export const MOTIONTEST_STAMP_PATH = '.open-next/motiontest-release-stamp.json'

const STAMP_SCHEMA_VERSION = 1
const REQUIRED_ARTIFACT_FILES = [
  '.open-next/cloudflare/next-env.mjs',
  '.open-next/worker.js',
  '../../pnpm-lock.yaml',
  'lib/storefront/motiontest-request-boundary.mjs',
  'lib/storefront/motiontest-worker-runtime.mjs',
  'motiontest-opennext-worker.mjs',
  'motiontest-worker.mjs',
  'open-next.config.ts',
  'package.json',
  'scripts/motiontest-child-environment.mjs',
  'wrangler.jsonc',
]

function fail(message) {
  throw new Error(`motiontest-artifact: ${message}`)
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function slashPath(value) {
  return value.split(sep).join('/')
}

function recordFile(appDir, displayPath) {
  const absolutePath = resolve(appDir, displayPath)
  if (!existsSync(absolutePath)) fail(`missing artifact input: ${displayPath}`)
  const stat = lstatSync(absolutePath)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    fail(`artifact input must be one regular file: ${displayPath}`)
  }
  const bytes = readFileSync(absolutePath)
  return { path: slashPath(displayPath), size: stat.size, sha256: sha256(bytes) }
}

function directoryFiles(appDir, displayRoot) {
  const root = resolve(appDir, displayRoot)
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    fail(`missing artifact directory: ${displayRoot}`)
  }
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name)
      if (entry.isSymbolicLink()) fail('OpenNext artifact may not contain symlinks')
      if (entry.isDirectory()) visit(absolutePath)
      else if (entry.isFile()) {
        files.push(slashPath(relative(appDir, absolutePath)))
      } else {
        fail('OpenNext artifact may contain only regular files and directories')
      }
    }
  }
  visit(root)
  return files.sort()
}

function artifactFiles(appDir) {
  const generatedFiles = directoryFiles(appDir, '.open-next').filter(
    (path) => path !== MOTIONTEST_STAMP_PATH,
  )
  if (!generatedFiles.some((path) => path.startsWith('.open-next/assets/'))) {
    fail('OpenNext assets directory is empty')
  }
  const paths = [...REQUIRED_ARTIFACT_FILES, ...generatedFiles]
  return [...new Set(paths)].sort().map((path) => recordFile(appDir, path))
}

function artifactPayload(appDir, { gitSha, releaseRef, buildEnvironment }) {
  if (!/^[a-f0-9]{40}$/.test(gitSha ?? '')) fail('Git SHA must be one exact commit')
  if (releaseRef !== MOTIONTEST_RELEASE_REF) fail('wrong motiontest release ref')
  if (
    !buildEnvironment ||
    Array.isArray(buildEnvironment) ||
    typeof buildEnvironment !== 'object'
  ) {
    fail('missing canonical build environment')
  }
  return {
    schemaVersion: STAMP_SCHEMA_VERSION,
    gitSha,
    releaseRef,
    buildEnvironment,
    files: artifactFiles(appDir),
  }
}

function withArtifactHash(payload) {
  return { ...payload, artifactSha256: sha256(canonicalJson(payload)) }
}

export function writeMotiontestArtifactStamp(appDir, identity) {
  const stamp = withArtifactHash(artifactPayload(appDir, identity))
  const stampPath = resolve(appDir, MOTIONTEST_STAMP_PATH)
  const temporaryPath = `${stampPath}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(stamp, null, 2)}\n`, { flag: 'w' })
  renameSync(temporaryPath, stampPath)
  return stamp
}

export function assertMotiontestArtifact(appDir, { gitSha, releaseRef, artifactSha256 }) {
  const stampPath = resolve(appDir, MOTIONTEST_STAMP_PATH)
  if (!existsSync(stampPath)) fail('missing motiontest release stamp')
  let stamp
  try {
    stamp = JSON.parse(readFileSync(stampPath, 'utf8'))
  } catch {
    fail('motiontest release stamp is malformed')
  }
  if (stamp.schemaVersion !== STAMP_SCHEMA_VERSION) fail('unknown release stamp schema')
  if (stamp.gitSha !== gitSha) fail('release stamp SHA does not match current Git SHA')
  if (stamp.releaseRef !== releaseRef) fail('release stamp ref does not match current release ref')
  if (artifactSha256 && stamp.artifactSha256 !== artifactSha256) {
    fail('release stamp does not match the expected artifact SHA')
  }
  const current = withArtifactHash(
    artifactPayload(appDir, {
      gitSha,
      releaseRef,
      buildEnvironment: stamp.buildEnvironment,
    }),
  )
  if (current.artifactSha256 !== stamp.artifactSha256) {
    fail('motiontest artifact is stale or tampered')
  }
  return stamp
}

function defaultRunGit(args, repoDir) {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' })
}

export function assertMotiontestReleaseIdentity({
  repoDir,
  env,
  runGit = (args) => defaultRunGit(args, repoDir),
}) {
  const expectedSha = String(env.MOTIONTEST_EXPECTED_SHA ?? '')
  const expectedRef = String(env.MOTIONTEST_EXPECTED_REF ?? '')
  if (!/^[a-f0-9]{40}$/.test(expectedSha) || !expectedRef) {
    fail('expected SHA and ref are required')
  }
  if (expectedRef !== MOTIONTEST_RELEASE_REF) fail('wrong motiontest release ref')

  const gitSha = String(runGit(['rev-parse', 'HEAD'])).trim()
  const actualSha = String(env.MOTIONTEST_ACTUAL_SHA ?? gitSha).trim()
  let releaseRef = String(env.MOTIONTEST_ACTUAL_REF ?? '').trim()
  if (!releaseRef) {
    try {
      releaseRef = String(runGit(['symbolic-ref', '--quiet', 'HEAD'])).trim()
    } catch {
      fail('detached HEAD requires the trusted actual release ref')
    }
  }
  const actualRef = String(env.MOTIONTEST_ACTUAL_REF ?? releaseRef).trim()
  if (gitSha !== expectedSha || actualSha !== expectedSha) {
    fail('current Git SHA does not match the required expected SHA')
  }
  if (releaseRef !== expectedRef || actualRef !== expectedRef) {
    fail('current release ref does not match the required expected release ref')
  }
  const dirty = String(runGit(['status', '--porcelain', '--untracked-files=all'])).trim()
  if (dirty) fail('Git tree is dirty; motiontest release requires one clean commit')
  return { gitSha, releaseRef }
}
