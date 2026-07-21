import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')

describe('publika skriv-RPC:er', () => {
  it('går genom server-only writer efter appens rate-limit och validering', () => {
    const cases = [
      ['apps/web/app/boka/actions.ts', "'finalize_verified_storefront_booking'"],
      ['apps/web/app/butik/actions.ts', "writer.rpc('reserve_shop_order'"],
      ['apps/web/lib/storefront/lojalitet/intake.ts', "writer.rpc('join_loyalty_club'"],
    ] as const

    for (const [path, call] of cases) {
      const source = read(path)
      expect(source).toContain("import { createServiceClient } from '@/lib/platform/service'")
      expect(source).toContain('const writer = createServiceClient()')
      expect(source).toContain(call)
    }
  })

  it('stänger direkta anon-anrop men bevarar nödvändiga server/användarroller', () => {
    const migration = read('supabase/migrations/0085_protect_payment_commit_rpcs.sql').toLowerCase()
    const anonymousOnly = [
      'reserve_shop_order(text,jsonb,text,text,integer)',
      'join_loyalty_club(text,text,text,uuid)',
    ]
    for (const fn of anonymousOnly) {
      expect(migration).toContain(`revoke all on function public.${fn} from anon`)
      expect(migration).toContain(`revoke all on function public.${fn} from authenticated`)
      expect(migration).toContain(`grant execute on function public.${fn} to service_role`)
    }

    const customerBooking =
      'create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'
    const integrity = read('supabase/migrations/0093_public_booking_integrity.sql').toLowerCase()
    const compactIntegrity = integrity.replace(/\s+/g, '')
    expect(compactIntegrity).toContain(`revokeallonfunctionpublic.${customerBooking}`)
    expect(compactIntegrity).toContain(`grantexecuteonfunctionpublic.${customerBooking}`)
    expect(integrity).toContain('to authenticated')
    expect(integrity).not.toMatch(
      /grant execute on function public\.create_public_booking[\s\S]{0,180}to service_role/,
    )

    const release = read('supabase/migrations/0103_storefront_booking_release_truth.sql').toLowerCase()
    const legacyStorefront =
      'create_storefront_booking(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid)'
    const releasedStorefront =
      'create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
    const compactRelease = release.replace(/\s+/g, '')
    expect(compactRelease).toContain(`revokeexecuteonfunctionpublic.${legacyStorefront}`)
    expect(release).toContain('from service_role')
    expect(compactRelease).toContain(`grantexecuteonfunctionpublic.${releasedStorefront}`)
    expect(release).toContain('to service_role')

    const pinBooking = read(
      'supabase/migrations/0118_pin_booking_verification.sql',
    ).toLowerCase()
    const verifiedStorefront =
      'finalize_verified_storefront_booking(uuid,uuid,text,text,text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
    const compactPinBooking = pinBooking.replace(/\s+/g, '')
    expect(compactPinBooking).toContain(`revokeallonfunctionpublic.${verifiedStorefront}`)
    expect(compactPinBooking).toContain(`grantexecuteonfunctionpublic.${verifiedStorefront}`)
    expect(pinBooking).toContain('to service_role')
  })
})
