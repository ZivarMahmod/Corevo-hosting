import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(fileURLToPath(new URL(
  '../../../../supabase/migrations/20260721111357_pin_booking_verification.sql',
  import.meta.url,
)), 'utf8').toLowerCase()

describe('verified public booking migration contract', () => {
  it('keeps challenges private and never stores a clear pin', () => {
    expect(migration).toContain('create table private.booking_verification_challenges')
    expect(migration).toContain('pin_digest text not null')
    expect(migration).toContain('contact_digest text not null')
    expect(migration).not.toMatch(/\bpin\s+(text|varchar|character)/)
    expect(migration).toContain('revoke all on table private.booking_verification_challenges')
    expect(migration).not.toContain('grant select on table private.booking_verification_challenges to anon')
  })

  it('locks ttl, attempts, resend and one-time consumption in postgres', () => {
    expect(migration).toContain("interval '5 minutes'")
    expect(migration).toContain("interval '30 seconds'")
    expect(migration).toContain('v_previous.channel <> p_channel')
    expect(migration).toContain('v_previous.contact_digest <> p_contact_digest')
    expect(migration).toContain('attempt_count >= 5')
    expect(migration).toContain('consumed_at is not null')
    expect(migration).toContain('for update')
  })

  it('starts a hold and only finalizes a delivered matching challenge', () => {
    expect(migration).toContain('public.start_booking_verification')
    expect(migration).toContain('public.record_booking_verification_delivery')
    expect(migration).toContain('public.cancel_booking_verification')
    expect(migration).toContain('public.finalize_verified_storefront_booking')
    expect(migration).toContain("delivery_state <> 'delivered'")
    expect(migration).toContain('v_challenge.pin_digest <> p_pin_digest')
    expect(migration).toContain('v_challenge.contact_digest <> p_contact_digest')
    expect(migration).toContain('p_pin_digest is null or v_challenge.pin_digest <> p_pin_digest')
    expect(migration).toContain('p_session_token is null')
    expect(migration).toContain('public.place_slot_hold(')
  })

  it('serializes every overlapping hold for the same tenant and staff member', () => {
    const holdFunction = migration.match(
      /create or replace function public\.place_slot_hold[\s\S]*?\n\$\$;/,
    )?.[0]

    expect(holdFunction).toBeTruthy()
    expect(holdFunction).toContain(
      "pg_catalog.hashtextextended(v_tenant::text || ':' || p_staff::text, 0)",
    )
    expect(holdFunction).not.toContain("p_staff::text || ':' || p_start::text")
    expect(holdFunction?.indexOf('pg_advisory_xact_lock')).toBeLessThan(
      holdFunction?.indexOf('from public.slot_holds') ?? -1,
    )
  })

  it('records each PIN attempt in the outbox without persisting PIN or full contact', () => {
    expect(migration).toContain('pin_outbox_id uuid')
    expect(migration).toContain("'booking_verification_pin'")
    expect(migration).toContain("'template', 'booking_verification_pin'")
    expect(migration).toContain("'challenge_id', v_challenge")
    expect(migration).toContain('p_max_attempts => 1')
    expect(migration).toContain('set available_at = v_expires')
    expect(migration).toMatch(
      /record_booking_verification_delivery[\s\S]*?o\.id = c\.pin_outbox_id[\s\S]*?o\.status in \('sent', 'delivered'\)/,
    )
    expect(migration).not.toMatch(
      /jsonb_build_object\([\s\S]{0,220}('pin'|'contact'|'phone'|'email')/,
    )
  })

  it('atomically expires an abandoned challenge and releases only its matching hold', () => {
    expect(migration).toContain('create or replace function public.cancel_booking_verification')
    expect(migration).toContain('v_challenge.session_token <> p_session_token')
    expect(migration).toContain('delete from public.slot_holds h')
    expect(migration).toContain('where h.id = v_challenge.hold_id')
    expect(migration).toContain('hold_id = null')
  })

  it('atomically creates booking, consumes challenge and writes the outbox event', () => {
    expect(migration).toContain('public.create_storefront_booking_with_release(')
    expect(migration).toContain('public.enqueue_notification(')
    expect(migration).toContain("'booking_confirmation'")
    expect(migration).toContain('booking_id = v_booking')
    expect(migration).toContain('consumed_at = pg_catalog.statement_timestamp()')
  })

  it('can claim only the returned outbox id for immediate delivery', () => {
    expect(migration).toContain('public.claim_notification_outbox_by_id')
    expect(migration).toContain('where o.id = p_id')
    expect(migration).toContain("o.chosen_channel in ('sms', 'email')")
    expect(migration).toContain("'booking_verification_pin'")
    expect(migration).toContain('to service_role')
  })

  it('allows exactly one verified guest contact channel and keeps hold overlap protection', () => {
    expect(migration).toContain('guest_contact_required')
    expect(migration).toContain("nullif(pg_catalog.btrim(p_guest_email), '') is null")
    expect(migration).toContain("nullif(pg_catalog.btrim(p_guest_phone), '') is null")
    expect(migration).toContain('and')
    expect(migration).toContain('tstzrange(h.start_ts, h.end_ts) && tstzrange(p_start, v_end)')
    expect(migration).toContain('create or replace function public.get_public_bookable_starts')
    expect(migration).toContain('from public.slot_holds h')
    expect(migration).toContain('h.expires_at > pg_catalog.statement_timestamp()')
  })

  it('exposes write RPCs only to service_role', () => {
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).toContain('to service_role')
    expect(migration).not.toMatch(/grant execute on function public\.(start_booking_verification|record_booking_verification_delivery|cancel_booking_verification|finalize_verified_storefront_booking)[\s\s]*to (anon|authenticated)/)
  })
})
