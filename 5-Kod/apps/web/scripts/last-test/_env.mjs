// Delad uppkoppling för belastningstesterna (goal-67).
// Läser nycklar ur apps/web/.env.local. Ingen ny dependency — @supabase/supabase-js
// finns redan i workspacet.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(here, '../../.env.local')
const env = readFileSync(envPath, 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()

export const URL_ = get('NEXT_PUBLIC_SUPABASE_URL')
export const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY')

/** Anon-klient = exakt samma väg som en självbokande kund. */
export const anonClient = () =>
  createClient(URL_, ANON, { auth: { persistSession: false } })

/** Service-klient = bara till seed/städ av den ISOLERADE testtenanten. */
export const svcClient = () =>
  createClient(URL_, SERVICE, { auth: { persistSession: false } })

/** Fasta, uppenbart fejkade id:n. Allt vi rör bär dessa. */
export const T = {
  tenantSlug: 'lasttest-zzz-fejk',
  tenantId: '9e000000-0000-4000-8000-000000000001',
  locationId: '9e000000-0000-4000-8000-000000000002',
  staffId: '9e000000-0000-4000-8000-000000000003',
  staff2Id: '9e000000-0000-4000-8000-000000000013',
  serviceId: '9e000000-0000-4000-8000-000000000004',
  // Långt fram i tiden: 2030-06-05 är en onsdag (dow=3).
  base: '2030-06-05T10:00:00.000Z',
}

/** Seedar en isolerad testtenant. Idempotent (upsert). */
export async function seed(svc) {
  await svc.from('tenants').upsert({
    id: T.tenantId, slug: T.tenantSlug, name: 'LASTTEST FEJK AB', status: 'active',
  })
  await svc.from('locations').upsert({
    id: T.locationId, tenant_id: T.tenantId, name: 'Lasttest-plats', is_primary: true, active: true,
  })
  for (const [id, title] of [[T.staffId, 'Lasttest Resurs A'], [T.staff2Id, 'Lasttest Resurs B']]) {
    await svc.from('staff').upsert({
      id, tenant_id: T.tenantId, title, active: true, location_id: T.locationId,
    })
  }
  await svc.from('services').upsert({
    id: T.serviceId, tenant_id: T.tenantId, name: 'Lasttest-tjänst', duration_min: 30,
    price_cents: 0, active: true, location_id: T.locationId,
  })
  for (const s of [T.staffId, T.staff2Id]) {
    await svc.from('staff_services').upsert({ tenant_id: T.tenantId, staff_id: s, service_id: T.serviceId })
    // working_hours krävs av staff↔location-fencet i RPC:n. Alla veckodagar, brett fönster.
    for (let d = 0; d <= 6; d++) {
      await svc.from('working_hours').insert({
        tenant_id: T.tenantId, staff_id: s, location_id: T.locationId,
        weekday: d, start_time: '00:00:00', end_time: '23:59:00',
      })
    }
  }
}

/**
 * Tar bort testets bokningar. ALLTID tenant-filtrerat på fejktenanten.
 *
 * VARFÖR CLI OCH INTE .delete(): bookings har `trg_bookings_no_delete`
 * (build-once-never-delete) och barnraderna i booking_status_history är
 * append-only. En vanlig DELETE kastar P0001. Vi stänger av triggrarna för
 * den EGNA sessionen (session_replication_role=replica) — påverkar ingen
 * annan session och ändrar inget schema.
 */
export function cleanupBookings() {
  sql(
    `delete from public.booking_status_history where booking_id in (select id from public.bookings where tenant_id='${T.tenantId}')`,
    `delete from public.bookings where tenant_id='${T.tenantId}'`,
  )
}

function sql(...statements) {
  const q = `set local session_replication_role='replica'; ${statements.join('; ')}`
  execSync(`npx supabase db query --linked "${q}"`, {
    cwd: resolve(here, '../../../..'), stdio: 'ignore',
  })
}

/** Tar bort HELA fejktenanten. Varje DELETE är tenant-filtrerad. */
export async function cleanupAll() {
  const t = `tenant_id='${T.tenantId}'`
  sql(
    `delete from public.booking_status_history where booking_id in (select id from public.bookings where ${t})`,
    `delete from public.bookings where ${t}`,
    `delete from public.working_hours where ${t}`,
    `delete from public.staff_services where ${t}`,
    `delete from public.services where ${t}`,
    `delete from public.staff where ${t}`,
    `delete from public.locations where ${t}`,
    `delete from public.tenants where id='${T.tenantId}'`,
  )
}

/** Räknar rader i DB för en slot — sanningen, inte vad RPC:n påstod. */
export async function rowsAt(svc, startIso, staffId = T.staffId) {
  const { data } = await svc
    .from('bookings')
    .select('id, status, start_ts, end_ts, staff_id')
    .eq('tenant_id', T.tenantId)
    .eq('staff_id', staffId)
    .eq('start_ts', startIso)
  return data ?? []
}
