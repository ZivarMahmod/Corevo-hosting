import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  fileURLToPath(
    new URL('../../../../supabase/migrations/0120_customer_portal_security.sql', import.meta.url),
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
  'customer_portal_verify_challenge',
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

  it('moves the database release inventory to 0120 without pretending production is applied', () => {
    for (const workflow of [ci, deploy]) {
      expect(workflow).toContain('--expected-latest 0120')
      expect(workflow).toMatch(/--required-test-versions[^\n]*0119,0120/)
    }
    expect(deploy).toContain('PROD_DB_MIGRATION')
  })
})
