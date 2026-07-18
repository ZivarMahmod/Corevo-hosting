import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')

const readWeb = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')
const readCode = (relative: string) => fs.readFileSync(path.join(CODE_ROOT, relative), 'utf8')

describe('customer relationship proof', () => {
  it('uses the durable customer relation for claimed guest history and staff bands', () => {
    const bookings = readWeb('lib/kund/bookings.ts')
    const loyalty = readWeb('lib/kund/loyalty.ts')

    expect(bookings).toContain('customer_id.eq.${customerId}')
    expect(loyalty).toContain('customer_id.eq.${customerId}')
    expect(loyalty).toContain(".eq('status', 'completed')")
  })

  it('keeps internal notes out of every customer-facing relationship surface', () => {
    const portal = [
      readWeb('app/(kund)/konto/page.tsx'),
      readWeb('app/(kund)/konto/bokningar/[id]/page.tsx'),
      readWeb('components/kund/StylistCard.tsx'),
      readWeb('components/kund/UsualCard.tsx'),
      readWeb('components/kund/AccountHistory.tsx'),
    ].join('\n')

    expect(portal).not.toMatch(/\.from\(['"]customer_notes['"]\)/)
    expect(portal).not.toMatch(/\binternal_note\b\s*[),}]/)
    expect(readWeb('lib/kund/bookings.ts')).not.toContain('customer_notes')
  })

  it('carries the booking location into the staff-only notes write', () => {
    const calendar = readWeb('lib/personal/calendar.ts')
    const desktop = readWeb('components/personal/Calendar.tsx')
    const pwa = readWeb('components/personal/PersonalCalendarPwa.tsx')
    const card = readWeb('components/personal/ClientCard.tsx')
    const form = readWeb('components/personal/CustomerNotesForm.tsx')
    const actions = readWeb('lib/personal/actions.ts')

    expect(calendar).toContain('locationId: r.location_id')
    expect(desktop).toContain('locationId={b.locationId}')
    expect(pwa).toContain('locationId={selected.locationId}')
    expect(card).toContain('locationId={locationId}')
    expect(form).toContain('name="locationId"')
    expect(actions).toContain(".eq('location_id', locationId)")
    expect(actions).toContain('location_id: existingNote?.location_id ?? locationId')
  })

  it('fences the contact reveal by tenant, role, accessible location and operational window', () => {
    const migration = readCode('supabase/migrations/0101_customer_relationship_access.sql')

    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('v_row.tenant_id = v_tenant')
    expect(migration).toContain('v_level >= 3')
    expect(migration).toContain('(select private.can_access_customer(p_customer))')
    expect(migration).toContain('(select private.can_access_location(b.location_id))')
    expect(migration).toContain('b.tenant_id = v_row.tenant_id')
    expect(migration).toContain("b.status in ('pending', 'confirmed', 'completed')")
    expect(migration).toContain('grant execute on function public.get_customer_contact')
    expect(migration).toContain('to authenticated')
    expect(migration).not.toMatch(/grant execute[\s\S]*?get_customer_contact[\s\S]*?to anon/)
    expect(migration).toContain('v_before_h constant int := 720')
    expect(migration).toContain('v_after_h constant int := 24')
    expect(migration).toContain('make_interval(hours => v_before_h)')
    expect(migration).toContain('make_interval(hours => v_after_h)')
    expect(migration).not.toContain('make_interval(hours => p_before_h)')
    expect(migration).not.toContain('make_interval(hours => p_after_h)')
  })

  it('keeps the customer-id continuity proof in the database fixture', () => {
    const sql = readCode('supabase/tests/customer_relationship_0101_test.sql')

    expect(sql).toContain('same_customer_after_claim')
    expect(sql).toContain('claimed_history_completed_only')
    expect(sql).toContain('internal_note_hidden_from_customer')
    expect(sql).toContain('contact_hidden_outside_window')
    expect(sql).toContain('caller_window_override_blocked')
    expect(sql).toContain('contact_visible_for_other_location')
  })

  it('keeps merged internal notes owner-only when customer cards came from different locations', () => {
    const claimMigration = readCode('supabase/migrations/0096_customer_account_claim.sql')
    const claimRuntime = readCode('supabase/tests/customer_account_claim_0096_test.sql')

    expect(claimMigration).toContain(
      'when public.customer_notes.location_id is not distinct from excluded.location_id',
    )
    expect(claimMigration).toContain('else null')
    expect(claimRuntime).toContain('cross_location_note_not_owner_only')
  })
})
