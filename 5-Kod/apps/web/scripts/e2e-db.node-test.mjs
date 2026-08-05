import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

// Run explicitly with `node --test`; the filename intentionally avoids Vitest discovery.

import { assertE2ETarget, parseRows, prepareSeed, verifyCleanRows, withTempSql } from './e2e-db.mjs'

const STAGING_REF = 'aaaaaaaaaaaaaaaaaaaa'
const PRODUCTION_REF = 'bbbbbbbbbbbbbbbbbbbb'
const PASSWORD = 'E2e!caller_supplied_password_123'

function targetEnv(overrides = {}) {
  return {
    E2E_SUPABASE_PROJECT_REF: STAGING_REF,
    E2E_ALLOWED_SUPABASE_PROJECT_REF: STAGING_REF,
    PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    ...overrides,
  }
}

test('target guard requires an explicit E2E project reference', () => {
  assert.throws(
    () => assertE2ETarget(targetEnv({ E2E_SUPABASE_PROJECT_REF: '' }), STAGING_REF),
    /E2E_SUPABASE_PROJECT_REF/,
  )
})

test('target guard rejects a project outside the staging allowlist', () => {
  assert.throws(
    () =>
      assertE2ETarget(
        targetEnv({ E2E_ALLOWED_SUPABASE_PROJECT_REF: 'cccccccccccccccccccc' }),
        STAGING_REF,
      ),
    /allowlist/,
  )
})

test('target guard rejects a linked project that differs from the requested project', () => {
  assert.throws(() => assertE2ETarget(targetEnv(), 'cccccccccccccccccccc'), /linked project/)
})

test('target guard can never accept the production project', () => {
  assert.throws(
    () =>
      assertE2ETarget(
        targetEnv({
          E2E_SUPABASE_PROJECT_REF: PRODUCTION_REF,
          E2E_ALLOWED_SUPABASE_PROJECT_REF: PRODUCTION_REF,
        }),
        PRODUCTION_REF,
      ),
    /production/,
  )
})

test('seed requires and uses the caller password without returning it in logs', () => {
  const { query, message } = prepareSeed("select crypt('__E2E_PASSWORD__', gen_salt('bf'));", {
    E2E_PASSWORD: PASSWORD,
  })

  assert.equal(query.includes(PASSWORD), true)
  assert.doesNotMatch(query, /__E2E_PASSWORD__/)
  assert.equal(message.includes(PASSWORD), false)
  assert.throws(() => prepareSeed('select 1;', { E2E_PASSWORD: PASSWORD }), /placeholder/)
  assert.throws(() => prepareSeed("select '__E2E_PASSWORD__';", {}), /E2E_PASSWORD/)
})

test('database output must be valid JSON with a rows array', () => {
  assert.deepEqual(
    parseRows('Connecting...\n{"rows":[{"label":"tenants","dirty":0}]}'),
    [{ label: 'tenants', dirty: 0 }],
  )
  assert.throws(() => parseRows('not json'), /JSON/)
  assert.throws(() => parseRows('notice\n{"rows":'), /JSON/)
  assert.throws(() => parseRows('{"result":"ok"}'), /rows/)
})

test('clean verification requires every expected check with a numeric zero', () => {
  const clean = [
    { label: 'tenants', dirty: 0 },
    { label: 'auth.users', dirty: 0 },
    { label: 'public.users', dirty: 0 },
    { label: 'roles', dirty: 0 },
    { label: 'orphan bookings', dirty: 0 },
  ]

  assert.equal(verifyCleanRows(clean).dirty, 0)
  assert.throws(() => verifyCleanRows([]), /missing database check/)
  assert.throws(
    () =>
      verifyCleanRows(clean.map((row, index) => (index === 0 ? { ...row, dirty: 'nan' } : row))),
    /invalid count/,
  )
})

test('temporary SQL is removed even when the CLI runner fails', async () => {
  let sqlPath = ''

  await assert.rejects(
    withTempSql('select 1;', async (file) => {
      sqlPath = file
      assert.equal(existsSync(file), true)
      throw new Error('runner failed')
    }),
    /runner failed/,
  )

  assert.equal(existsSync(sqlPath), false)
})
