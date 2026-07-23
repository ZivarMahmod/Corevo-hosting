import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  fileURLToPath(
    new URL('../../../../supabase/migrations/0120_customer_portal_security.sql', import.meta.url),
  ),
  'utf8',
).toLowerCase()
const runtimeSql = readFileSync(
  fileURLToPath(
    new URL('../../../../supabase/tests/customer_portal_security_0120_test.sql', import.meta.url),
  ),
  'utf8',
).toLowerCase()

const ci = readFileSync(
  fileURLToPath(new URL('../../../../../.github/workflows/ci.yml', import.meta.url)),
  'utf8',
)
const deploy = readFileSync(
  fileURLToPath(new URL('../../../../../.github/workflows/deploy.yml', import.meta.url)),
  'utf8',
)

const criticalRpcs = [
  'customer_portal_mint_link',
  'customer_portal_exchange_link',
  'customer_portal_session_snapshot',
  'customer_portal_list_bookings',
  'customer_portal_get_booking',
  'customer_portal_cancel_booking',
  'customer_portal_update_name',
  'customer_portal_create_challenge',
  'customer_portal_record_challenge_delivery',
  'customer_portal_verify_challenge',
  'customer_portal_start_recovery',
  'customer_portal_record_recovery_delivery',
  'customer_portal_recovery_delivery_target',
  'customer_portal_prepare_recovery_delivery',
  'customer_portal_record_recovery_outbox_delivery',
  'customer_portal_recovery_outbox_candidates',
  'customer_portal_prepare_recovery_resend',
  'customer_portal_resend_recovery',
  'customer_portal_recovery_state',
  'customer_portal_verify_recovery_and_mint_session',
  'customer_portal_revoke_session',
  'customer_portal_revoke_other_sessions',
  'customer_portal_revoke_booking_trusts',
  'customer_portal_gdpr_scrub',
] as const

describe('customer portal 0120 migration contract', () => {
  it('keeps every credential table private and hash-only', () => {
    for (const table of [
      'customer_portal_links',
      'customer_portal_sessions',
      'customer_booking_trusts',
      'customer_portal_challenges',
      'customer_portal_audit',
    ]) {
      expect(migration).toContain(`create table private.${table}`)
      expect(migration).toContain(`revoke all on table private.${table}`)
    }

    expect(migration).toContain('token_digest text not null')
    expect(migration).toContain('secret_digest text not null')
    expect(migration).toContain('contact_digest text not null')
    expect(migration).toContain('code_digest text not null')
    expect(migration).not.toMatch(/\b(raw_token|raw_secret|raw_code|plain_token|plain_secret|plain_code)\b/)
  })

  it('stores the single portal mode in canonical tenant settings and fails closed', () => {
    expect(migration).toContain("'{customer_portal}'")
    expect(migration).toContain("'mode', 'legacy_account'")
    expect(migration).toContain("#>> '{customer_portal,mode}'")
    expect(migration).toContain("= 'passwordless_tenant'")
    expect(migration).toContain("is distinct from 'passwordless_tenant'")
    expect(migration).not.toContain("customer_portal_mode(p_tenant) <> 'passwordless_tenant'")
    expect(migration).toContain("'global_account'")
    expect(migration).not.toMatch(/add column[^;]*customer_portal_mode/)
  })

  it('exposes only narrow service-role RPCs with pinned search paths', () => {
    for (const rpc of criticalRpcs) {
      expect(migration).toContain(`create or replace function public.${rpc}`)
      expect(migration).toMatch(
        new RegExp(
          `create or replace function public\\.${rpc}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${rpc}\\([\\s\\S]*?from public, anon, authenticated, service_role`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*?to service_role`),
      )
    }

    expect(migration).not.toMatch(
      /grant execute on function public\.customer_portal_[\s\S]*?to (anon|authenticated)/,
    )
  })

  it('serializes exchange and cancellation and binds every booking to session ownership', () => {
    expect(migration).toMatch(
      /customer_portal_exchange_link[\s\S]*?for update[\s\S]*?consumed_at/,
    )
    const cancel = migration.match(
      /create or replace function public\.customer_portal_cancel_booking[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(cancel).toBeTruthy()
    expect(cancel).toContain('for update')
    expect(cancel).toContain('b.tenant_id = v_session.tenant_id')
    expect(cancel).toContain('b.customer_id = v_session.customer_id')
    expect(migration).toContain("'booking:' || v_booking.id::text || ':cancelled'")
    expect(migration).toContain("'already_cancelled'")
    expect(migration).toContain("'not_found'")
    expect(migration).toContain("'not_allowed'")
    expect(migration).toContain('p_idempotency_key')
  })

  it('enforces replay, expiry, rotation, bounded pages and GDPR revocation in postgres', () => {
    expect(migration).toContain('consumed_at is not null')
    expect(migration).toContain('revoked_at is not null')
    expect(migration).toContain('idle_expires_at')
    expect(migration).toContain('absolute_expires_at')
    expect(migration).toContain('rotated_secret_digest')
    expect(migration).toContain("v_session.last_seen_at <= v_now - interval '15 minutes'")
    expect(migration).toContain('v_challenge.subject_digest is distinct from p_subject_digest')
    expect(migration).toContain('v_challenge.code_digest is distinct from p_code_digest')
    expect(migration).toMatch(
      /customer_portal_create_challenge[\s\S]*?returns table \(outcome text, challenge_public_id uuid, should_deliver boolean\)/,
    )
    expect(migration).toMatch(
      /customer_portal_create_challenge[\s\S]*?pg_advisory_xact_lock[\s\S]*?customer_portal_challenges/,
    )
    expect(migration).toContain('least(greatest(p_page_size, 1), 20)')
    expect(migration).toContain('limit v_limit + 1')
    expect(migration).toContain("'hasmore'")
    expect(migration).toContain("'nextcursor'")
    expect(migration).not.toMatch(/pg_catalog\.(?:coalesce|least|greatest)\s*\(/)
    expect(migration).toMatch(/customer_portal_gdpr_scrub[\s\S]*?update private\.customer_portal_links[\s\S]*?update private\.customer_portal_sessions/)
  })

  it('binds recovery to consumed Goal-74 proof and explicit delivery truth', () => {
    const start = migration.match(
      /create or replace function public\.customer_portal_start_recovery[\s\S]*?\n\$\$;/,
    )?.[0]
    const delivery = migration.match(
      /create or replace function public\.customer_portal_record_recovery_delivery[\s\S]*?\n\$\$;/,
    )?.[0]
    const verify = migration.match(
      /create or replace function public\.customer_portal_verify_recovery_and_mint_session[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(start).toContain('private.booking_verification_challenges')
    expect(start).toContain("bv.delivery_state = 'delivered'")
    expect(start).toContain('bv.consumed_at is not null')
    expect(start).toContain('b.customer_id = c.id')
    expect(start).toContain('b.tenant_id = v_tenant_id')
    expect(start).toContain('bv.contact_digest = p_booking_contact_digest')
    expect(start).toContain('pg_advisory_xact_lock')
    expect(start).toContain('count(*) over () as candidate_count')
    expect(start).toContain('v_candidate_count <> 1')
    expect(start).toContain('customer_id, purpose, channel')
    expect(migration).toContain("delivery_state text not null default 'pending'")
    expect(delivery).toContain('for update')
    expect(delivery).toContain("delivery_state = case when v_delivered then 'delivered' else 'failed' end")
    expect(delivery).toMatch(/p_delivered is true\s+and v_challenge\.customer_id is not null/)
    expect(verify).toContain("v_challenge.delivery_state <> 'delivered'")
    expect(verify).toContain('for update')
    expect(verify).toContain('insert into private.customer_portal_sessions')
    expect(verify).toContain('set consumed_at = v_now')
    expect(verify).toContain("'recovery_verified'")
  })

  it('persists an identical PII-free async outbox path for real and decoy recovery', () => {
    const start = migration.match(
      /create or replace function public\.customer_portal_start_recovery[\s\S]*?\n\$\$;/,
    )?.[0]
    const resend = migration.match(
      /create or replace function public\.customer_portal_resend_recovery[\s\S]*?\n\$\$;/,
    )?.[0]
    const state = migration.match(
      /create or replace function public\.customer_portal_recovery_state[\s\S]*?\n\$\$;/,
    )?.[0]
    for (const producer of [start, resend]) {
      expect(producer).toContain("'customer_portal_recovery_code'")
      expect(producer).toContain("'challenge_id'")
      expect(producer).toContain('outbox_id uuid')
      expect(producer).not.toContain('should_deliver')
      expect(producer).not.toContain('delivery_destination')
    }
    expect(migration).toContain('recovery_outbox_id uuid')
    expect(state).not.toContain('contact_masked')
    expect(state).not.toContain("delivery_state = 'pending'")
    expect(state).not.toContain("'delivery_failed'::text")
    expect(migration).toMatch(
      /claim_sms_notification_outbox[\s\S]*?event_type <> 'customer_portal_recovery_code'/,
    )
    expect(migration).toMatch(
      /claim_notification_outbox[\s\S]*?event_type <> 'customer_portal_recovery_code'/,
    )
    expect(migration).toMatch(
      /claim_notification_outbox_by_id[\s\S]*?'customer_portal_recovery_code'/,
    )
  })

  it('prepares recovery delivery only after outbox lease and current-contact revalidation', () => {
    const target = migration.match(
      /create or replace function public\.customer_portal_recovery_delivery_target[\s\S]*?\n\$\$;/,
    )?.[0]
    const prepare = migration.match(
      /create or replace function public\.customer_portal_prepare_recovery_delivery[\s\S]*?\n\$\$;/,
    )?.[0]
    const record = migration.match(
      /create or replace function public\.customer_portal_record_recovery_outbox_delivery[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(target).toContain("o.status = 'delivery_started'")
    expect(target).toContain('o.lease_token = p_lease_token')
    expect(prepare).toContain('for update')
    expect(prepare).toContain('verified.normalized = current_contact.normalized')
    expect(prepare).toContain('v_challenge.contact_digest is distinct from p_current_contact_digest')
    expect(prepare).toContain('v_challenge.booking_contact_digest is distinct from p_current_booking_contact_digest')
    expect(prepare).toContain('set code_digest = p_code_digest')
    expect(record).toContain("o.status = 'delivery_started'")
    expect(record).toContain('o.lease_token = p_lease_token')
  })

  it('keeps resend credential-bound and exposes no public recipient or provider state', () => {
    const resend = migration.match(
      /create or replace function public\.customer_portal_resend_recovery[\s\S]*?\n\$\$;/,
    )?.[0]
    const prepare = migration.match(
      /create or replace function public\.customer_portal_prepare_recovery_resend[\s\S]*?\n\$\$;/,
    )?.[0]
    const state = migration.match(
      /create or replace function public\.customer_portal_recovery_state[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(resend).toContain('p_challenge_public_id')
    expect(resend).toContain('p_subject_digest')
    expect(resend).not.toContain('p_lookup')
    expect(resend).not.toContain('p_current_destination')
    expect(resend).not.toContain('p_current_booking_contact_digest')
    expect(resend).toContain("'customer_portal_recovery_code'")
    expect(resend).toContain('outbox_id uuid')
    expect(resend).toContain('for update')
    expect(resend).toContain('pg_advisory_xact_lock')
    expect(resend).toContain('set revoked_at = v_now')
    expect(state).toContain('p_subject_digest')
    expect(state).not.toContain('delivery_state')
    expect(state).not.toContain('contact_masked')
    expect(state).not.toContain('masked_contact')
    expect(state).not.toContain('channel text')
    expect(state).not.toContain('delivery_failed')
    expect(state).not.toContain('delivery_destination')
    expect(prepare).toContain('delivery_destination')
    expect(prepare).toContain('p_subject_digest')
  })

  it('selects only bounded claimable recovery rows so terminal history cannot starve new work', () => {
    const candidates = migration.match(
      /create or replace function public\.customer_portal_recovery_outbox_candidates[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(candidates).toContain("event_type = 'customer_portal_recovery_code'")
    expect(candidates).toContain("o.status = 'queued'")
    expect(candidates).toContain("o.status = 'attempting'")
    expect(candidates).toContain('o.available_at <= p_now')
    expect(candidates).toContain('o.lease_expires_at <= p_now')
    expect(candidates).toContain('order by o.available_at, o.created_at, o.id')
    expect(candidates).toContain('limit least(greatest(coalesce(p_limit, 50), 1), 50)')
    expect(candidates).not.toMatch(/where[\s\S]*?event_type[\s\S]*?limit 50\s*\)/)
  })

  it('keeps the generic challenge lifecycle coherent by allowing contact_change only', () => {
    const genericCreate = migration.match(
      /create or replace function public\.customer_portal_create_challenge[\s\S]*?\n\$\$;/,
    )?.[0]
    const genericVerify = migration.match(
      /create or replace function public\.customer_portal_verify_challenge[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(genericCreate).toContain("p_purpose <> 'contact_change'")
    expect(genericCreate).not.toContain("p_purpose not in ('recovery', 'contact_change')")
    expect(genericCreate).toContain('p_customer is not null')
    expect(genericCreate).not.toMatch(/select 'accepted'::text, p_public_id, true/)
    expect(genericVerify).toContain("v_challenge.purpose <> 'contact_change'")
    expect(runtimeSql).toContain('portal_generic_recovery_purpose_created')
  })

  it('requires a service-only generic delivery CAS before challenge verification', () => {
    const record = migration.match(
      /create or replace function public\.customer_portal_record_challenge_delivery[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(record).toContain('for update')
    expect(record).toContain("v_challenge.purpose <> 'contact_change'")
    expect(record).toContain("v_challenge.delivery_state <> 'pending'")
    expect(record).toContain("case when p_delivered is true then 'delivered' else 'failed' end")
    expect(record).toContain("return 'ok'")
  })

  it('takes every recovery advisory lock before any challenge row lock', () => {
    const start = migration.match(
      /create or replace function public\.customer_portal_start_recovery[\s\S]*?\n\$\$;/,
    )?.[0] ?? ''
    const resend = migration.match(
      /create or replace function public\.customer_portal_resend_recovery[\s\S]*?\n\$\$;/,
    )?.[0] ?? ''
    expect(start.indexOf('pg_advisory_xact_lock')).toBeGreaterThan(-1)
    expect(start.indexOf('pg_advisory_xact_lock')).toBeLessThan(
      start.indexOf('update private.customer_portal_challenges'),
    )
    expect(resend.indexOf('pg_advisory_xact_lock')).toBeGreaterThan(-1)
    expect(resend.indexOf('pg_advisory_xact_lock')).toBeLessThan(resend.indexOf('for update'))
    expect(runtimeSql).toContain('portal_recovery_lock_order_invalid')
  })

  it('returns a recovery tenant slug only for a correctly digested expired session', () => {
    const snapshot = migration.match(
      /create or replace function public\.customer_portal_session_snapshot[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(snapshot).toContain('recovery_tenant_slug text')
    expect(snapshot).toContain('s.secret_digest = p_secret_digest')
    expect(snapshot).toContain("select 'expired'::text, null::jsonb, v_recovery_tenant_slug")
    expect(snapshot).toContain("select 'expired'::text, null::jsonb, null::text")
    expect(snapshot).not.toMatch(/select 'expired'::text,\s*v_snapshot/)
  })

  it('projects canonical portal identity and bookings without request-host trust or payment joins', () => {
    const snapshot = migration.match(
      /create or replace function public\.customer_portal_session_snapshot[\s\S]*?\n\$\$;/,
    )?.[0]
    const list = migration.match(
      /create or replace function public\.customer_portal_list_bookings[\s\S]*?\n\$\$;/,
    )?.[0]
    const detail = migration.match(
      /create or replace function public\.customer_portal_get_booking[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(snapshot).toContain("'logourl'")
    expect(snapshot).toContain("'verticallabel'")
    expect(snapshot).toContain("'bookingorigin'")
    expect(snapshot).toContain("'sv-se'")
    expect(snapshot).toContain("'se'::text")
    expect(snapshot).toContain("'cancellationcutoffhours'")
    expect(snapshot).toContain('public.tenant_domains')
    expect(snapshot).toContain('public.verticals')
    expect(snapshot).not.toContain("'tenantid'")
    expect(snapshot).not.toContain("'customerid'")

    for (const projection of [list, detail]) {
      expect(projection).toContain("'durationminutes'")
      expect(projection).toContain("'location'")
      expect(projection).toContain("'cancancel'")
      expect(projection).toContain("'canceldeadline'")
      expect(projection).toContain("'publicrebookurl'")
      expect(projection).toContain('left join lateral')
      expect(projection).not.toMatch(/join public\.payments\s+pay\s+on/)
      expect(projection).not.toContain('request.headers')
    }
    expect(list).toContain("b.start_ts < v_now or b.status not in ('pending', 'confirmed')")
  })

  it('moves the database release inventory to 0123 without pretending production is applied', () => {
    for (const workflow of [ci, deploy]) {
      expect(workflow).toContain('--expected-latest 0123')
      expect(workflow).toMatch(/--required-test-versions[^\n]*0120,0121,0122,0123/)
    }
    expect(deploy).toContain('PROD_DB_MIGRATION')
  })
})
