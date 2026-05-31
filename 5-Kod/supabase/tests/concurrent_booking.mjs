// Concurrency proof: two simultaneous create_public_booking calls on the SAME
// slot must result in exactly ONE success and ONE exclusion_violation (23P01) —
// the no_double_booking EXCLUDE constraint makes double-booking impossible even
// under a race. Runs as the anon role (same path the public flow uses).
//
// Run:  node supabase/tests/concurrent_booking.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from apps/web/.env.local.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(resolve(here, '../../apps/web/.env.local'), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const supabase = createClient(url, anon, { auth: { persistSession: false } })

// Seeded frisor1 data.
const SLUG = 'frisor1'
const SERVICE = '55555555-0000-0000-0000-000000000001' // Klippning, 30 min
const STAFF = '44444444-0000-0000-0000-000000000001'
const START = '2031-01-06T10:00:00.000Z' // far-future, unlikely to collide

function callOnce(tag) {
  return supabase
    .rpc('create_public_booking', {
      p_tenant_slug: SLUG,
      p_service: SERVICE,
      p_staff: STAFF,
      p_start: START,
      p_note: `CONCURRENCY TEST ${tag}`,
    })
    .then(({ data, error }) => ({ data, error }))
}

const [a, b] = await Promise.all([callOnce('A'), callOnce('B')])

const results = [a, b]
const ok = results.filter((r) => !r.error && r.data)
const conflicts = results.filter((r) => r.error?.code === '23P01')
const other = results.filter((r) => r.error && r.error.code !== '23P01')

console.log('Booking A:', a.error ? `ERR ${a.error.code}` : `OK ${a.data}`)
console.log('Booking B:', b.error ? `ERR ${b.error.code}` : `OK ${b.data}`)

if (ok.length === 1 && conflicts.length === 1 && other.length === 0) {
  console.log('PASS: exactly one booking succeeded, the other got 23P01 (no double-booking).')
  process.exitCode = 0
} else {
  console.error('FAIL: expected exactly 1 success + 1 exclusion_violation.')
  process.exitCode = 1
}
