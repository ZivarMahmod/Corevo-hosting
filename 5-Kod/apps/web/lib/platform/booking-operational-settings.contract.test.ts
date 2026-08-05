import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../../supabase/migrations/20260803191057_atomic_booking_operational_settings.sql', import.meta.url),
  'utf8',
)

describe('atomic booking operational settings', () => {
  it('patches only booking keys behind the site-editor tenant fence', () => {
    expect(migration).toContain('perform private.assert_site_revision_access(p_tenant)')
    expect(migration).toContain("jsonb_set(")
    expect(migration).toContain("'{booking}'")
    expect(migration).toContain("then ts.settings -> 'booking'")
  })

  it('bounds URLs and writes only sanitized audit metadata', () => {
    expect(migration).toContain('v_url_count > 64')
    expect(migration).toContain('pg_column_size(v_urls) > 65536')
    expect(migration).toContain("'^service:[0-9a-f]{8}")
    expect(migration).toContain("'global_url', case when p_external_url is null then 'cleared' else 'set' end")
    expect(migration).toContain("'cta_slot_ids'")
    const audit = migration.slice(migration.indexOf('insert into public.audit_log'))
    expect(audit).not.toContain("'external_url', p_external_url")
    expect(audit).not.toContain("'external_cta_urls', v_urls")
  })

  it('migrates legacy external customers to provider external plus module live', () => {
    expect(migration).toContain('with migrated as (')
    expect(migration).toContain("'{booking,provider}'")
    expect(migration).toContain("coalesce(ts.settings #>> '{booking,provider}', '') = ''")
    expect(migration).toContain("select migrated.tenant_id, 'booking', 'live'")
    expect(migration).toContain('from migrated')
  })

  it('blocks the Corevo engine at the database boundary for external providers', () => {
    expect(migration).toContain('private.corevo_booking_provider_enabled')
    expect(migration).toContain('create or replace function public.get_public_bookable_starts')
    expect(migration).toContain("raise exception 'booking_provider_external'")
    expect(migration).toContain('before insert on private.booking_verification_challenges')
    expect(migration).toContain('before insert or update of tenant_id, staff_id, service_id, location_id, start_ts, end_ts')
  })

  it('rejects a visible external module without a valid destination', () => {
    expect(migration).toContain('private.booking_external_url_is_valid')
    expect(migration).toContain('create or replace function private.guard_booking_module_visibility')
    expect(migration).toContain("new.module_key <> 'booking' or new.state <> 'live'")
    expect(migration).toContain("raise exception 'booking_external_url_required'")
    expect(migration).toContain('before insert or update of state on public.tenant_modules')
  })
})
