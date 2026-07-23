import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../../supabase/migrations/0124_customer_portal_contact_change.sql', import.meta.url),
  'utf8',
)
const runtime = readFileSync(
  new URL('../../../../supabase/tests/customer_portal_contact_change_0124_test.sql', import.meta.url),
  'utf8',
)

function body(name: string): string {
  return migration.match(new RegExp(
    `create or replace function public\\.${name}[\\s\\S]*?\\n\\$\\$;`,
  ))?.[0] ?? ''
}

describe('0124 verified contact change security contract', () => {
  it('keeps flows and verification truth private and service-role-only', () => {
    expect(migration).toContain('create table private.customer_portal_contact_change_flows')
    expect(migration).toContain('create table private.customer_portal_verified_contacts')
    expect(migration).toMatch(/alter table private\.customer_portal_contact_change_flows enable row level security/)
    expect(migration).toMatch(/revoke all on table private\.customer_portal_contact_change_flows[\s\S]*?service_role/)
    expect(migration).toMatch(/revoke all on table private\.customer_portal_verified_contacts[\s\S]*?service_role/)
    expect(migration).not.toMatch(/grant (select|insert|update|delete)[^;]*customer_portal_contact_change_flows/i)
  })

  it('starts only from a live cookie session and binds the current verified evidence', () => {
    const start = body('customer_portal_start_contact_change')
    expect(start).toContain("security definer")
    expect(start).toContain("set search_path = ''")
    expect(start).toContain('private.customer_portal_resolve_session')
    expect(start).toContain('for update')
    expect(start).toContain('private.customer_portal_contact_is_verified')
    expect(start).toContain('current_contact_digest')
    expect(start).toContain('v_normalized.normalized is distinct from p_current_destination')
    expect(start).toContain('current_contact_masked')
    expect(start).toContain("p_action not in ('change_phone', 'add_phone', 'change_email')")
    expect(start).not.toContain('p_tenant_id')
    expect(start).not.toContain('p_customer_id')
    expect(start).toMatch(/f\.completed_at is null[\s\S]*?f\.revoked_at is null[\s\S]*?coalesce\(f\.step_up_expires_at, f\.flow_expires_at\) > v_now/)
    expect(runtime).toContain('contact_change_attempt_budget_reset_invalid')
    expect(runtime).toContain('contact_change_resend_cooldown_invalid')
    expect(runtime).toContain('contact_change_five_error_lock_invalid')
    expect(runtime).toContain('contact_change_locked_resend_invalid')
    expect(runtime).toContain('contact_change_locked_restart_invalid')
  })

  it('requires recorded delivery and bounded constant-time HMAC proof for both PINs', () => {
    const delivery = body('customer_portal_record_contact_change_delivery')
    const current = body('customer_portal_verify_contact_change_current')
    const finalize = body('customer_portal_finalize_contact_change')
    expect(current).toContain("current_delivery_state <> 'delivered'")
    expect(finalize).toContain("new_delivery_state <> 'delivered'")
    for (const fn of [current, finalize]) {
      expect(fn).toContain('attempt_count')
      expect(fn).toContain('max_attempts')
      expect(fn).toContain('private.customer_portal_digest_equal')
    }
    expect(migration).toContain("max_attempts integer not null default 5 check (max_attempts = 5)")
    expect(delivery).toContain('p_code_digest text')
    expect(delivery).toMatch(/digest_equal\(v_flow\.(current|new)_code_digest, p_code_digest\)/)
    expect(migration).toContain("interval '5 minutes'")
    expect(current).toContain("interval '10 minutes'")
    const resend = body('customer_portal_resend_contact_change')
    expect(resend).toContain("interval '30 seconds'")
    expect(resend).not.toContain('attempt_count = 0')
    expect(resend).toContain('least(p_expires_at, v_flow.step_up_expires_at)')
    expect(resend).not.toContain('pg_catalog.extract')
  })

  it('locks the channel to the server action and rejects same/conflicting destinations neutrally', () => {
    const destination = body('customer_portal_prepare_contact_change_destination')
    const finalize = body('customer_portal_finalize_contact_change')
    expect(destination).toContain("v_flow.action in ('change_phone', 'add_phone')")
    expect(destination).toContain("v_flow.action = 'change_email'")
    expect(destination).toContain('private.customer_portal_normalize_recovery_lookup')
    expect(destination).toContain("return query select 'same'::text")
    expect(destination).toContain("return query select 'conflict'::text")
    expect(destination).toContain('v_flow.new_code_digest is not null')
    expect(destination).not.toContain('new_attempt_count = 0')
    expect(destination).toMatch(/customer_portal_verified_contacts vc[\s\S]*?vc\.revoked_at is null/)
    expect(finalize).toMatch(/customer_portal_verified_contacts vc[\s\S]*?vc\.revoked_at is null/)
    expect(destination).toContain("p_new_channel || ':' || v_new.normalized")
    expect(finalize).toContain("v_flow.new_channel || ':' || v_flow.new_destination")
    expect(destination).not.toMatch(/select[^;]*(other|conflict).*customer_id/i)
  })

  it('guards channel-unique customer contacts for every database writer', () => {
    expect(migration).toContain('private.customer_portal_guard_customer_contact_uniqueness')
    expect(migration).toContain('create trigger customer_portal_guard_customer_contact_uniqueness')
    expect(migration).toContain('before insert or update of tenant_id, phone, email, status on public.customers')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('raise unique_violation')
    expect(runtime).toContain('contact_change_direct_writer_conflict_invalid')
    expect(migration).toMatch(/customer_portal_verified_contacts verified[\s\S]*?set revoked_at/)
    expect(migration).toMatch(/customer_portal_sessions session_row[\s\S]*?set revoked_at/)
    expect(migration).toMatch(/customer_booking_trusts trust_row[\s\S]*?set revoked_at/)
    expect(migration).toMatch(/customer_portal_links link_row[\s\S]*?set revoked_at/)
    expect(migration).toMatch(/customer_portal_challenges challenge_row[\s\S]*?set revoked_at/)
    expect(runtime).toContain('contact_change_direct_writer_session_not_revoked')
    expect(runtime).toContain('contact_change_direct_writer_binding_not_revoked')
    expect(runtime).toContain('contact_change_direct_writer_trust_not_revoked')
    expect(runtime).toContain('contact_change_direct_writer_link_not_revoked')
    expect(runtime).toContain('contact_change_direct_writer_challenge_not_revoked')
  })

  it('gives active exact bindings precedence over legacy booking proof', () => {
    const verified = migration.match(/create or replace function private\.customer_portal_contact_is_verified[\s\S]*?\n\$\$;/)?.[0] ?? ''
    const profile = body('customer_portal_profile_snapshot')
    expect(migration).toContain('customer_portal_verified_contacts_active_destination_uidx')
    expect(migration).toContain('customer_portal_verified_contacts_active_customer_channel_uidx')
    expect(verified).toContain('case when exists')
    expect(verified).toContain('active_binding.revoked_at is null')
    expect(profile).toContain('not exists')
    expect(profile).toContain('active_binding.revoked_at is null')
  })

  it('scrubs transient destinations on revoke, expiry and GDPR erase', () => {
    const scrub = migration.match(/create or replace function private\.customer_portal_scrub_expired_contact_changes[\s\S]*?\n\$\$;/)?.[0] ?? ''
    const gdpr = body('customer_portal_gdpr_scrub')
    const start = body('customer_portal_start_contact_change')
    expect(scrub).toContain('set new_destination = null')
    expect(scrub).toContain('f.flow_expires_at <= p_now')
    expect(start).toContain('new_destination = null')
    expect(gdpr).toContain('delete from private.customer_portal_contact_change_flows')
    expect(gdpr).toContain('delete from private.customer_portal_verified_contacts')
    expect(migration).toContain("'corevo-scrub-expired-contact-changes'")
    expect(migration).toContain('create or replace function public.sweep_customer_portal_contact_changes')
    expect(migration).toContain('grant execute on function public.sweep_customer_portal_contact_changes(timestamptz)')
    expect(runtime).toContain('contact_change_completed_destination_not_scrubbed')
    expect(runtime).toContain('contact_change_revoked_destination_not_scrubbed')
    expect(runtime).toContain('contact_change_expired_destination_not_scrubbed')
    expect(runtime).toContain('contact_change_gdpr_scrub_invalid')
  })

  it('finalizes contact, proof, revocations and deterministic current-session rotation atomically', () => {
    const finalize = body('customer_portal_finalize_contact_change')
    expect(finalize).toContain('for update')
    expect(finalize).toMatch(/update public\.customers[\s\S]*?(phone|email)/)
    expect(finalize.indexOf('update public.customers')).toBeLessThan(
      finalize.lastIndexOf('insert into private.customer_portal_verified_contacts'),
    )
    expect(finalize).toContain('private.customer_portal_verified_contacts')
    expect(finalize).toContain('private.customer_portal_links')
    expect(finalize).toContain('private.customer_booking_trusts')
    expect(finalize).toContain('private.customer_portal_sessions')
    expect(finalize).toContain('private.customer_portal_challenges')
    expect(finalize).toContain('rotated_session_id')
    expect(finalize).toContain("v_flow.completed_at > v_now - interval '15 minutes'")
    expect(finalize).toMatch(/original\.public_id = p_session_public_id[\s\S]*?original\.secret_digest = p_secret_digest/)
    expect(finalize).toMatch(/rotated\.id = v_flow\.rotated_session_id[\s\S]*?rotated\.revoked_at is null/)
    expect(finalize).toContain('p_current_contact_digest text')
    expect(finalize).toMatch(/private\.customer_portal_digest_equal\(\s*\n\s*v_flow\.current_contact_digest, p_current_contact_digest\s*\n\s*\)/)
    expect(finalize).toContain('v_current.normalized is distinct from p_current_destination')
    expect(finalize).toContain("'contact_changed'")
    expect(finalize).not.toMatch(/metadata[^;]*(destination|phone|email|contact)/i)
    expect(runtime).toContain('contact_change_atomic_rollback_invalid')
    expect(runtime).toContain('contact_change_forced_rollback_customer_invalid')
    expect(runtime).toContain('exception when unique_violation')
    expect(runtime).toContain('contact_change_replay_idempotent_invalid')
    expect(runtime).toContain('contact_change_replay_wrong_session_invalid')
    expect(runtime).toContain('contact_change_replay_stale_invalid')
    expect(runtime).toContain('contact_change_concurrent_winner_invalid')
    expect(runtime).toContain('contact_change_contact_hash_not_updated')
  })

  it('keeps every callable endpoint closed to browser roles', () => {
    for (const signature of [
      'customer_portal_start_contact_change(uuid, text, text, uuid, text, text, text, text, text, integer, timestamptz)',
      'customer_portal_record_contact_change_delivery(uuid, text, uuid, text, text, text, boolean)',
      'customer_portal_verify_contact_change_current(uuid, text, uuid, text, text)',
      'customer_portal_contact_change_context(uuid, text, uuid, text)',
      'customer_portal_prepare_contact_change_destination(uuid, text, uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz)',
      'customer_portal_resend_contact_change(uuid, text, uuid, text, text, text, text, text, timestamptz)',
      'customer_portal_finalize_contact_change(uuid, text, uuid, text, text, text, text, uuid, text, integer)',
      'sweep_customer_portal_contact_changes(timestamptz)',
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature}`)
      expect(migration).toContain(`grant execute on function public.${signature}`)
    }
  })

  it('ships isolated SQL runtime coverage and rolls it back', () => {
    for (const marker of [
      'contact_change_wrong_session_invalid',
      'contact_change_current_undelivered_invalid',
      'contact_change_new_undelivered_invalid',
      'contact_change_same_destination_invalid',
      'contact_change_cross_tenant_conflict_invalid',
      'contact_change_other_sessions_not_revoked',
      'contact_change_trusts_not_revoked',
      'contact_change_old_links_not_revoked',
      'contact_change_audit_contains_pii',
      'contact_change_acl_invalid',
    ]) expect(runtime).toContain(marker)
    expect(runtime.trimEnd()).toMatch(/rollback;$/)
  })
})
