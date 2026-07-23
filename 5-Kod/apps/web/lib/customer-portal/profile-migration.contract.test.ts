import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../../supabase/migrations/0123_customer_portal_profile.sql', import.meta.url),
  'utf8',
)
const runtime = readFileSync(
  new URL('../../../../supabase/tests/customer_portal_profile_0123_test.sql', import.meta.url),
  'utf8',
)

describe('0123 customer portal profile security contract', () => {
  it('returns atomic server-only evidence and never treats a presentation mask as identity proof', () => {
    expect(migration).toMatch(/customer_portal_profile_snapshot[\s\S]*?'proofs', v_proofs/)
    expect(migration).toContain('private.booking_verification_challenges')
    expect(migration).toContain('contact_masked')
    expect(migration).toContain("'contactDigest', proof.contact_digest")
    expect(migration).toContain("'phone', v_customer.phone")
    expect(migration).toContain("'email', v_customer.email")
    expect(migration).toContain('customer_portal_safe_contact_mask')
    expect(migration).not.toMatch(/v_primary_mask\s*<>\s*v_current_(phone|email)_mask/)
    expect(migration).not.toMatch(/contact_masked[^;]*v_current_(phone|email)_mask/)
    expect(runtime).toContain('profile_sms_mask_collision_evidence_invalid')
    expect(runtime).toContain('profile_email_mask_collision_evidence_invalid')
    expect(runtime).toContain('profile_hostile_mask_not_closed')
  })

  it('hardens update-name around the live session and same tenant/customer row', () => {
    const updateName = migration.match(
      /create or replace function public\.customer_portal_update_name[\s\S]*?\n\$\$;/,
    )?.[0] ?? ''
    expect(updateName).toContain("security definer")
    expect(updateName).toContain("set search_path = ''")
    expect(updateName).toContain('for update of s, c')
    expect(updateName).toContain('c.tenant_id = s.tenant_id')
    expect(updateName).toContain("c.status = 'active'")
    expect(updateName).toMatch(/length\(v_name\) not between 2 and 120/)
    expect(updateName).toContain('private.customer_portal_safe_name(v_name)')
    expect(migration).toContain('customer_portal_forbidden_unicode')
    expect(runtime).toContain('profile_devanagari_name_rejected')
    expect(runtime).toContain('profile_unicode17_name_rejected')
    expect(runtime).toContain('profile_unassigned_name_accepted')
    expect(updateName).toContain("'profile_name_updated'")
    expect(updateName).toContain("return 'expired'")
    expect(updateName).toContain('updated_at = v_now')
  })

  it('keeps every callable profile function service-role-only', () => {
    for (const signature of [
      'public.customer_portal_profile_snapshot(uuid, text)',
      'public.customer_portal_update_name(uuid, text, text)',
    ]) {
      expect(migration).toContain(`revoke all on function ${signature}`)
      expect(migration).toContain('from public, anon, authenticated, service_role;')
      expect(migration).toContain(`grant execute on function ${signature}`)
    }
  })

  it('ships isolated runtime coverage for projection, ambiguity, race binding and ACLs', () => {
    expect(runtime).toContain('customer_portal_profile_snapshot')
    expect(runtime).toContain('profile_secondary_verified_invalid')
    expect(runtime).toContain('profile_name_cross_tenant_write')
    expect(runtime).toContain('profile_revoked_session_updated_name')
    expect(runtime).toContain('profile_snapshot_acl_invalid')
    expect(runtime).toContain('profile_update_name_acl_invalid')
    expect(runtime.trimEnd()).toMatch(/rollback;$/)
  })

  it('rejects Unicode format controls in SQL masks with the same closed policy as TypeScript', () => {
    expect(migration).toMatch(/customer_portal_safe_contact_mask[\s\S]*?customer_portal_forbidden_unicode/)
    expect(runtime).toContain('profile_email_mask_zwsp_accepted')
  })
})
