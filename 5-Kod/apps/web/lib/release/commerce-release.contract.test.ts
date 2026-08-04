import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migration = readFileSync(
  path.resolve(web, '..', '..', 'supabase', 'migrations', '0103_storefront_booking_release_truth.sql'),
  'utf8',
)
const pinMigration = readFileSync(
  path.resolve(web, '..', '..', 'supabase', 'migrations', '0118_pin_booking_verification.sql'),
  'utf8',
)

describe('pilot commerce database release fence', () => {
  it('keeps online booking payment and confirmation behind DB-owned release truth', () => {
    expect(migration).toContain('p_online_payment_released boolean default false')
    expect(migration).toContain('new.requires_online_payment := v_online_payment_released and v_online_pay')
    expect(migration).toContain('v_require_approval or new.requires_online_payment')
    expect(migration).toContain('requires_online_payment boolean not null default false')
    expect(migration).toContain(
      'returns table (booking_id uuid, requires_payment boolean, booking_status text)',
    )
    expect(pinMigration).toContain("then 'booking_confirmation' else 'booking_request_received' end")
  })
})
