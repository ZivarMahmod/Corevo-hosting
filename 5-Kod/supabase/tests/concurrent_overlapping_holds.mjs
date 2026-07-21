// Staging proof: two independent database clients request different starts
// that overlap for the same staff member. Exactly one hold must succeed.
//
// Run after the PIN migration has been applied:
//   node supabase/tests/concurrent_overlapping_holds.mjs
//
// Required environment variables (never printed):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this staging test.',
  )
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }
const clientA = createClient(url, serviceRoleKey, clientOptions)
const clientB = createClient(url, serviceRoleKey, clientOptions)

// Seeded frisor1 fixture. The 30-minute service makes starts 15 minutes apart overlap.
const SLUG = 'frisor1'
const SERVICE = '55555555-0000-0000-0000-000000000001'
const STAFF = '44444444-0000-0000-0000-000000000001'

const firstMonday = new Date()
firstMonday.setUTCHours(10, 0, 0, 0)
const daysUntilMonday = (8 - firstMonday.getUTCDay()) % 7 || 7
firstMonday.setUTCDate(firstMonday.getUTCDate() + daysUntilMonday + 14)

const pairs = Array.from({ length: 40 }, (_, index) => {
  const startA = new Date(firstMonday)
  startA.setUTCDate(startA.getUTCDate() + index * 7)
  const startB = new Date(startA.getTime() + 15 * 60 * 1000)
  return [startA.toISOString(), startB.toISOString()]
})
const firstStart = pairs[0][0]
const lastEnd = new Date(
  new Date(pairs.at(-1)[1]).getTime() + 60 * 60 * 1000,
).toISOString()

const [{ data: service, error: serviceError }, bookingsResult, holdsResult] = await Promise.all([
  clientA.from('services').select('duration_min').eq('id', SERVICE).single(),
  clientA
    .from('bookings')
    .select('start_ts,end_ts')
    .eq('staff_id', STAFF)
    .in('status', ['pending', 'confirmed', 'completed'])
    .lt('start_ts', lastEnd)
    .gt('end_ts', firstStart),
  clientA
    .from('slot_holds')
    .select('start_ts,end_ts')
    .eq('staff_id', STAFF)
    .gt('expires_at', new Date().toISOString())
    .lt('start_ts', lastEnd)
    .gt('end_ts', firstStart),
])

if (serviceError || !service || bookingsResult.error || holdsResult.error) {
  throw new Error('Could not read the seeded staging fixture for the hold test.')
}
if (service.duration_min <= 15) {
  throw new Error('The seeded service must be longer than 15 minutes for this overlap proof.')
}

const occupied = [...(bookingsResult.data ?? []), ...(holdsResult.data ?? [])]
const overlaps = (start, end, interval) => (
  new Date(interval.start_ts) < end && new Date(interval.end_ts) > start
)
const pair = pairs.find(([candidateA, candidateB]) => {
  const startA = new Date(candidateA)
  const startB = new Date(candidateB)
  const endB = new Date(startB.getTime() + service.duration_min * 60 * 1000)
  return !occupied.some((interval) => overlaps(startA, endB, interval))
})

if (!pair) {
  throw new Error('Could not find a free overlapping test pair in the next 40 Mondays.')
}

const [startA, startB] = pair
const tokenA = randomUUID()
const tokenB = randomUUID()

const place = (client, start, token) => client.rpc('place_slot_hold', {
  p_tenant_slug: SLUG,
  p_staff: STAFF,
  p_service: SERVICE,
  p_start: start,
  p_token: token,
  p_ttl_min: 5,
})

let results = []
try {
  results = await Promise.all([
    place(clientA, startA, tokenA),
    place(clientB, startB, tokenB),
  ])

  const successes = results.filter(({ data, error }) => data && !error)
  const conflicts = results.filter(({ error }) => error?.code === '23P01')
  const unexpected = results.filter(({ error }) => error && error.code !== '23P01')

  if (successes.length !== 1 || conflicts.length !== 1 || unexpected.length !== 0) {
    const codes = results.map(({ error }) => error?.code ?? 'OK').join(', ')
    throw new Error(`Expected exactly one success and one 23P01 conflict; got ${codes}.`)
  }

  console.log('PASS: overlapping starts were serialized; exactly one hold succeeded.')
} finally {
  await Promise.allSettled([
    clientA.rpc('release_slot_hold', {
      p_staff: STAFF,
      p_start: startA,
      p_token: tokenA,
    }),
    clientB.rpc('release_slot_hold', {
      p_staff: STAFF,
      p_start: startB,
      p_token: tokenB,
    }),
  ])
}
