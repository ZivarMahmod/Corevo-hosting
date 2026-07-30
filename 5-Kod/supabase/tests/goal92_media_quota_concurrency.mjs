import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const expectedRef = process.argv[2]
const password = process.env.E2E_PASSWORD
if (!expectedRef || !password) {
  throw new Error(
    'Usage: E2E_PASSWORD=... node supabase/tests/goal92_media_quota_concurrency.mjs <expected-project-ref>',
  )
}

const linkedRef = readFileSync(
  resolve(import.meta.dirname, '../.temp/project-ref'),
  'utf8',
).trim()
if (linkedRef !== expectedRef) {
  throw new Error(`Ref mismatch: expected ${expectedRef}, linked ${linkedRef}`)
}

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, '../../apps/web/.env.local'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
if (
  !supabaseUrl ||
  !anonKey ||
  !serviceRoleKey ||
  new URL(supabaseUrl).hostname !== `${expectedRef}.supabase.co`
) {
  throw new Error('Preview REST credentials missing or mismatched')
}

const tenantId = 'e2e00000-0000-0000-0000-000000000001'
const hashes = ['a'.repeat(64), 'b'.repeat(64)]
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const authenticated = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function db(run, label) {
  const result = await run()
  if (result.error) throw new Error(`${label}: ${result.error.code} ${result.error.message}`)
  return result.data
}

async function cleanup() {
  await db(
    () =>
      service
        .from('media_assets')
        .delete()
        .eq('tenant_id', tenantId)
        .in('content_hash', hashes),
    'cleanup media',
  )
  await db(
    () =>
      service
        .from('tenant_modules')
        .update({ config: { quota_bytes: 524288000 } })
        .eq('tenant_id', tenantId)
        .eq('module_key', 'media_library'),
    'restore quota',
  )
}

await cleanup()
try {
  const configured = await db(
    () =>
      service
        .from('tenant_modules')
        .update({ config: { quota_bytes: 100 } })
        .eq('tenant_id', tenantId)
        .eq('module_key', 'media_library')
        .select('tenant_id')
        .single(),
    'configure quota',
  )
  if (configured.tenant_id !== tenantId) throw new Error('E2E media fixture missing')

  const signedIn = await authenticated.auth.signInWithPassword({
    email: 'e2e-admin@frisor1.test',
    password,
  })
  if (signedIn.error) {
    throw new Error(`E2E media login: ${signedIn.error.code} ${signedIn.error.message}`)
  }

  const startedAt = Date.now()
  const results = await Promise.all([
    authenticated.rpc('reserve_media_upload', {
      p_tenant: tenantId,
      p_content_hash: hashes[0],
      p_size_bytes: 60,
      p_source: 'upload',
    }),
    authenticated.rpc('reserve_media_upload', {
      p_tenant: tenantId,
      p_content_hash: hashes[1],
      p_size_bytes: 50,
      p_source: 'upload',
    }),
  ])
  const succeeded = results.filter((result) => !result.error)
  const rejected = results.filter(
    (result) => result.error?.message.includes('media_quota_exceeded'),
  )
  if (succeeded.length !== 1 || rejected.length !== 1) {
    throw new Error(
      `Unexpected session results: ${JSON.stringify(
        results.map((result) => ({
          ok: !result.error,
          code: result.error?.code,
          message: result.error?.message,
        })),
      )}`,
    )
  }

  const assets = await db(
    () =>
      service
        .from('media_assets')
        .select('size_bytes,status')
        .eq('tenant_id', tenantId)
        .in('content_hash', hashes),
    'read media reservations',
  )
  if (
    assets.length !== 1 ||
    ![50, 60].includes(assets[0].size_bytes) ||
    !['pending', 'ready'].includes(assets[0].status)
  ) {
    throw new Error(`goal92_media_real_concurrency_invalid: ${JSON.stringify(assets)}`)
  }

  process.stdout.write(`goal92_media_real_concurrency_ok (${Date.now() - startedAt}ms)\n`)
} finally {
  await cleanup()
}
