import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')

describe('anonyma PII-intag', () => {
  it('skriver endast server-side genom serviceklienten efter appvalideringen', () => {
    for (const path of [
      'apps/web/lib/storefront/kontakt/intake.ts',
      'apps/web/lib/storefront/offert/intake.ts',
    ]) {
      const source = read(path)
      expect(source).toContain("import { createServiceClient } from '@/lib/platform/service'")
      expect(source).toContain('const writer = createServiceClient()')
      expect(source).toContain("writer.from('")
    }

    const eventAction = read('apps/web/app/(public)/kurser/actions.ts')
    expect(eventAction).toContain('const writer = createServiceClient()')
    expect(eventAction).toContain("writer.rpc('create_onsite_event_registration'")
    expect(eventAction).not.toContain("writer.from('event_registrations').insert")
  })

  it('har ingen direkt anon-INSERT-väg i databasen', () => {
    const migration = read('supabase/migrations/0084_close_anonymous_intake_tables.sql').toLowerCase()
    expect(migration).toContain('drop policy if exists contact_messages_public_insert')
    expect(migration).toContain('drop policy if exists offert_requests_public_insert')
    expect(migration).toContain('drop policy if exists event_registrations_public_insert')
    for (const table of ['contact_messages', 'offert_requests', 'event_registrations']) {
      expect(migration).toContain(
        `revoke insert on public.${table} from public, anon, authenticated`,
      )
      expect(migration).toContain(`grant insert on public.${table} to service_role`)
    }
  })

  it('gör kurskapacitet och anmälan atomisk med server-only radlås', () => {
    const migration = read(
      'supabase/migrations/0086_atomic_onsite_event_registration.sql',
    ).toLowerCase()

    expect(migration).toContain('for update')
    expect(migration).toContain("r.status = 'confirmed'")
    expect(migration).toContain('v_event.reserved_qty')
    expect(migration).toContain('insert into public.event_registrations')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })
})
