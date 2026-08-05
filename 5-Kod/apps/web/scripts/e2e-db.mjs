#!/usr/bin/env node
/**
 * Isolated E2E database fixture.
 *
 *   node apps/web/scripts/e2e-db.mjs seed
 *   node apps/web/scripts/e2e-db.mjs teardown
 *   node apps/web/scripts/e2e-db.mjs verify
 *
 * Every command requires an explicitly linked, allowlisted staging project.
 * `seed` also requires a caller-generated E2E_PASSWORD and never prints it.
 */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SEEDS = path.join(ROOT, 'supabase', 'seeds')
const PROJECT_REF_FILE = path.join(ROOT, 'supabase', '.temp', 'project-ref')
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/
const PASSWORD_PATTERN = /^[A-Za-z0-9_!.-]{20,128}$/
const CLEAN_LABELS = ['tenants', 'auth.users', 'public.users', 'roles', 'orphan bookings']

function requiredProjectRef(env, name) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  if (!PROJECT_REF_PATTERN.test(value)) throw new Error(`${name} is not a valid project reference`)
  return value
}

export function assertE2ETarget(env, linkedRef) {
  const requestedRef = requiredProjectRef(env, 'E2E_SUPABASE_PROJECT_REF')
  const allowedRef = requiredProjectRef(env, 'E2E_ALLOWED_SUPABASE_PROJECT_REF')
  const productionRef = requiredProjectRef(env, 'PRODUCTION_SUPABASE_PROJECT_REF')

  if (requestedRef === productionRef) {
    throw new Error('e2e-db refuses the production project')
  }
  if (requestedRef !== allowedRef) {
    throw new Error('E2E_SUPABASE_PROJECT_REF is not in the staging allowlist')
  }
  if (linkedRef !== requestedRef) {
    throw new Error('linked project does not match E2E_SUPABASE_PROJECT_REF')
  }

  return requestedRef
}

export function prepareSeed(template, env) {
  const password = env.E2E_PASSWORD
  if (!password) throw new Error('E2E_PASSWORD is required')
  if (!PASSWORD_PATTERN.test(password)) {
    throw new Error('E2E_PASSWORD must be 20-128 safe ephemeral characters')
  }
  if (!template.includes('__E2E_PASSWORD__')) {
    throw new Error('e2e-seed.sql is missing its password placeholder')
  }

  return {
    query: template.replaceAll('__E2E_PASSWORD__', password),
    message: 'e2e-db: fixture seeded (tenant frisor1).',
  }
}

export function parseRows(output) {
  const jsonStart = output.indexOf('{')
  if (jsonStart < 0) throw new Error('database output did not contain JSON')

  let payload
  try {
    payload = JSON.parse(output.slice(jsonStart))
  } catch {
    throw new Error('database output contained malformed JSON')
  }
  if (!Array.isArray(payload.rows)) throw new Error('database JSON is missing its rows array')
  return payload.rows
}

export function verifyCleanRows(rows) {
  if (!Array.isArray(rows)) throw new Error('database checks must be an array')

  const checks = new Map()
  for (const row of rows) {
    const label = typeof row?.label === 'string' ? row.label : ''
    if (!CLEAN_LABELS.includes(label))
      throw new Error(`unexpected database check: ${label || '<missing>'}`)
    if (checks.has(label)) throw new Error(`duplicate database check: ${label}`)

    const rawCount = row.dirty
    const count =
      typeof rawCount === 'number'
        ? rawCount
        : typeof rawCount === 'string' && /^(0|[1-9]\d*)$/.test(rawCount)
          ? Number(rawCount)
          : Number.NaN
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`invalid count for database check: ${label}`)
    }
    checks.set(label, count)
  }

  for (const label of CLEAN_LABELS) {
    if (!checks.has(label)) throw new Error(`missing database check: ${label}`)
  }

  return {
    dirty: [...checks.values()].reduce((sum, count) => sum + count, 0),
    checks: CLEAN_LABELS.map((label) => ({ label, dirty: checks.get(label) })),
  }
}

export async function withTempSql(query, run) {
  const file = path.join(tmpdir(), `corevo-e2e-${randomBytes(6).toString('hex')}.sql`)
  try {
    await writeFile(file, query, { encoding: 'utf8', mode: 0o600 })
    return await run(file)
  } finally {
    await rm(file, { force: true })
  }
}

async function linkedProjectRef() {
  try {
    return (await readFile(PROJECT_REF_FILE, 'utf8')).trim()
  } catch {
    throw new Error('linked project is missing; run supabase link explicitly')
  }
}

async function sql(query) {
  assertE2ETarget(process.env, await linkedProjectRef())

  return withTempSql(query, async (file) => {
    const cliEnv = { ...process.env, COREVO_E2E_SQL_FILE: file }
    delete cliEnv.E2E_PASSWORD
    const { stdout } = await execFileAsync(
      'bash',
      ['-lc', 'npx --yes supabase@2.110.0 db query --linked --output-format json -f "$COREVO_E2E_SQL_FILE"'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: cliEnv,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
    )
    return stdout
  })
}

async function seed() {
  const template = await readFile(path.join(SEEDS, 'e2e-seed.sql'), 'utf8')
  const prepared = prepareSeed(template, process.env)
  await sql(prepared.query)
  console.log(prepared.message)
}

async function teardown() {
  await sql(await readFile(path.join(SEEDS, 'e2e-teardown.sql'), 'utf8'))
  console.log('e2e-db: fixture removed.')
}

async function verify() {
  const result = verifyCleanRows(
    parseRows(
      await sql(`
select 'tenants' as label, count(*)::integer as dirty
from public.tenants where slug = 'frisor1' or slug like 'e2e%'
union all
select 'auth.users', count(*)::integer
from auth.users where id::text like 'e2e00000%'
union all
select 'public.users', count(*)::integer
from public.users
where id::text like 'e2e00000%'
   or email in ('e2e-admin@frisor1.test','e2e-staff@frisor1.test','e2e-platform@corevo.se')
union all
select 'roles', count(*)::integer
from public.roles where id::text like 'e2e00000%'
union all
select 'orphan bookings', count(*)::integer
from public.bookings b
left join public.tenants t on t.id = b.tenant_id
where t.id is null;
`),
    ),
  )

  for (const check of result.checks) {
    const log = check.dirty ? console.error : console.log
    log(`${check.dirty ? '✗' : '✓'} ${check.label}: ${check.dirty}`)
  }
  if (result.dirty) throw new Error(`${result.dirty} E2E database row(s) remain`)
  console.log('e2e-db: database is clean.')
}

async function main(command) {
  if (command === 'seed') await seed()
  else if (command === 'teardown') await teardown()
  else if (command === 'verify') await verify()
  else {
    console.error('usage: e2e-db.mjs seed | teardown | verify')
    process.exitCode = 2
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv[2])
  } catch (error) {
    console.error(`e2e-db: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
