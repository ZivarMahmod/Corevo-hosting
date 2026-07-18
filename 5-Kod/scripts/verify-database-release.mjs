import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Corevo keeps one readable, monotonically increasing four-digit series.
// Supabase also accepts timestamp versions, but mixing the two formats is what
// caused production history drift in July 2026. Keep timestamp metadata out of
// filenames; the remote applied-at time is operational evidence, not identity.
const VERSION_PATTERN = /^(\d{4})_[a-z0-9][a-z0-9_]*\.sql$/
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

export function verifyInventory({
  migrationFiles,
  testFiles,
  expectedLatest,
  requiredTestVersions = [],
}) {
  const versions = []
  const seen = new Set()
  for (const file of migrationFiles) {
    const match = basename(file).match(VERSION_PATTERN)
    if (!match) {
      throw new Error(
        `invalid migration filename ${basename(file)}; expected NNNN_lowercase_name.sql`,
      )
    }
    const version = match[1]
    if (seen.has(version)) throw new Error(`duplicate migration version ${version}`)
    seen.add(version)
    versions.push(version)
  }
  versions.sort((left, right) => left.localeCompare(right))
  if (versions.length === 0) throw new Error('no migration files found')

  const latest = versions.at(-1)
  if (expectedLatest && latest !== expectedLatest) {
    throw new Error(`latest migration is ${latest}; expected ${expectedLatest}`)
  }

  for (const version of requiredTestVersions) {
    const found = testFiles.some((file) => (
      basename(file).endsWith('.sql') && basename(file).includes(`_${version}_test.sql`)
    ))
    if (!found) throw new Error(`missing pgTAP test for migration ${version}`)
  }

  return { versions, latest, migrationCount: versions.length }
}

export function parseMigrationList(text) {
  const cleanText = text.replace(ANSI_PATTERN, '').trim()
  try {
    const payload = JSON.parse(cleanText)
    if (Array.isArray(payload?.migrations)) {
      const local = payload.migrations
        .map((entry) => entry?.local)
        .filter((value) => typeof value === 'string' && /^\d{4,14}$/.test(value))
      const remote = payload.migrations
        .map((entry) => entry?.remote)
        .filter((value) => typeof value === 'string' && /^\d{4,14}$/.test(value))
      return { local: uniqueSorted(local), remote: uniqueSorted(remote) }
    }
  } catch {
    // Supabase's human-readable table is handled below.
  }

  const local = []
  const remote = []
  for (const rawLine of cleanText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || !/[|\u2502]/.test(line)) continue
    const columns = line.split(/[|\u2502]/).map((value) => (
      value.trim().replace(/^`(\d{4,14})`$/, '$1')
    ))
    const localVersion = columns[0]?.match(/^\d{4,14}$/)?.[0]
    const remoteVersion = columns[1]?.match(/^\d{4,14}$/)?.[0]
    if (localVersion) local.push(localVersion)
    if (remoteVersion) remote.push(remoteVersion)
  }
  return { local: uniqueSorted(local), remote: uniqueSorted(remote) }
}

export function assertHistoryParity({ expected, actual, label = 'remote' }) {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  const missing = expected.filter((version) => !actualSet.has(version))
  const extra = actual.filter((version) => !expectedSet.has(version))
  if (missing.length || extra.length) {
    const details = [
      missing.length ? `missing ${label}ly: ${missing.join(', ')}` : null,
      extra.length ? `unexpected ${label}ly: ${extra.join(', ')}` : null,
    ].filter(Boolean).join('; ')
    throw new Error(`migration history drift (${details})`)
  }
}

export function migrationFingerprint(entries) {
  const hash = createHash('sha256')
  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    hash.update(entry.name)
    hash.update('\0')
    // Git checkouts may expose the same SQL as LF or CRLF. The release identity
    // must describe the migration contents, not the operator's platform.
    hash.update(entry.content.replace(/\r\n?/g, '\n'))
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

export function assertProductionCheckpoint({
  checkpoint,
  expectedLatest,
  declaredLatest,
  expectedFingerprint,
}) {
  if (checkpoint.status !== 'verified') {
    throw new Error(`production schema checkpoint is ${checkpoint.status ?? 'missing'}`)
  }
  if (checkpoint.historyAligned !== true) {
    throw new Error('production migration history has not been proven aligned')
  }
  if (checkpoint.schemaAligned !== true) {
    throw new Error('production schema has not been proven aligned')
  }
  if (checkpoint.requiredLatest !== expectedLatest) {
    throw new Error(
      `production checkpoint requires ${checkpoint.requiredLatest}; release requires ${expectedLatest}`,
    )
  }
  if (checkpoint.observedHistoryLatest !== expectedLatest) {
    throw new Error(
      `production history ends at ${checkpoint.observedHistoryLatest}; expected ${expectedLatest}`,
    )
  }
  if (declaredLatest !== expectedLatest) {
    throw new Error(`PROD_DB_MIGRATION is ${declaredLatest || 'unset'}; expected ${expectedLatest}`)
  }
  if (!checkpoint.verifiedAt || !checkpoint.verifiedBy?.trim()) {
    throw new Error('production checkpoint lacks operator evidence')
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(checkpoint.migrationFingerprint ?? '')) {
    throw new Error('production checkpoint lacks a valid migration fingerprint')
  }
  if (checkpoint.migrationFingerprint !== expectedFingerprint) {
    throw new Error('production checkpoint migration fingerprint does not match this release')
  }
  const verifiedAt = Date.parse(checkpoint.verifiedAt)
  if (!Number.isFinite(verifiedAt) || verifiedAt > Date.now() + 5 * 60_000) {
    throw new Error('production checkpoint has an invalid verification timestamp')
  }
  if (!checkpoint.verificationEvidence?.trim()) {
    throw new Error('production checkpoint lacks a verification evidence reference')
  }
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1]
}

function filesAt(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
}

function main() {
  const args = process.argv.slice(2)
  const migrationDirectory = resolve(valueAfter(args, '--migration-dir') ?? 'supabase/migrations')
  const testsDirectory = resolve(valueAfter(args, '--tests-dir') ?? 'supabase/tests')
  const expectedLatest = valueAfter(args, '--expected-latest')
  const requiredTests = (valueAfter(args, '--required-test-versions') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const inventory = verifyInventory({
    migrationFiles: filesAt(migrationDirectory),
    testFiles: filesAt(testsDirectory),
    expectedLatest,
    requiredTestVersions: requiredTests,
  })
  const fingerprint = migrationFingerprint(
    filesAt(migrationDirectory)
      .filter((name) => VERSION_PATTERN.test(name))
      .map((name) => ({
        name,
        content: readFileSync(resolve(migrationDirectory, name), 'utf8'),
      })),
  )

  const historyFile = valueAfter(args, '--history-file')
  const historySide = valueAfter(args, '--history-side')
  if (historyFile && historySide) {
    const history = parseMigrationList(readFileSync(resolve(historyFile), 'utf8'))
    if (historySide === 'local') {
      assertHistoryParity({ expected: inventory.versions, actual: history.local, label: 'local' })
    } else if (historySide === 'remote') {
      assertHistoryParity({ expected: inventory.versions, actual: history.remote, label: 'remote' })
    } else {
      throw new Error(`unknown history side ${historySide}`)
    }
  }

  const checkpointFile = valueAfter(args, '--production-checkpoint')
  if (checkpointFile) {
    assertProductionCheckpoint({
      checkpoint: JSON.parse(readFileSync(resolve(checkpointFile), 'utf8')),
      expectedLatest: inventory.latest,
      declaredLatest: valueAfter(args, '--declared-latest') ?? '',
      expectedFingerprint: fingerprint,
    })
  }

  console.log(
    `database release inventory OK: ${inventory.migrationCount} migrations through ${inventory.latest}; ${fingerprint}`,
  )
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(`database release verification failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
