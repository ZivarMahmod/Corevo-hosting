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
const TENANT = '11111111-1111-1111-1111-111111111111'
const LOCATION = '77777777-0000-0000-0000-000000000001'
const SERVICE = '55555555-0000-0000-0000-000000000001' // Klippning, 30 min
const STAFF = '44444444-0000-0000-0000-000000000001'

// Ask the database for a genuinely free future Monday instead of letting a
// fixed calendar date expire (or collide with a previous test run).
const firstCandidate = new Date()
firstCandidate.setUTCHours(10, 0, 0, 0)
const daysUntilMonday = (8 - firstCandidate.getUTCDay()) % 7 || 7
firstCandidate.setUTCDate(firstCandidate.getUTCDate() + daysUntilMonday + 14)

const candidates = Array.from({ length: 40 }, (_, index) => {
  const candidate = new Date(firstCandidate)
  candidate.setUTCDate(candidate.getUTCDate() + index * 7)
  return candidate.toISOString()
})

const { data: bookableStarts, error: availabilityError } = await supabase.rpc(
  'get_public_bookable_starts',
  {
    p_tenant: TENANT,
    p_location: LOCATION,
    p_service: SERVICE,
    p_staff_ids: [STAFF],
    p_starts: candidates,
  },
)

if (availabilityError) {
  throw new Error(`Could not find a concurrency-test slot: ${availabilityError.code}`)
}

const START = bookableStarts?.find((row) => row.staff_id === STAFF)?.start_ts

if (!START) {
  throw new Error('Could not find a bookable concurrency-test slot in the next 40 Mondays.')
}

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
