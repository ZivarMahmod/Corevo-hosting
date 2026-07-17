import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')

describe('publika skriv-RPC:er', () => {
  it('går genom server-only writer efter appens rate-limit och validering', () => {
    const cases = [
      ['apps/web/app/boka/actions.ts', "writer.rpc('create_public_booking'"],
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

    const booking =
      'create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'
    expect(migration).toContain(`revoke all on function public.${booking} from anon`)
    expect(migration).toContain(`grant execute on function public.${booking} to authenticated`)
    expect(migration).toContain(`grant execute on function public.${booking} to service_role`)
  })
})
