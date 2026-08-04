import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_CODE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
)

describe('atomic customer erasure database contract', () => {
  const migration = readFileSync(
    path.join(REPO_CODE_ROOT, 'supabase/migrations/0099_atomic_tenant_customer_erase.sql'),
    'utf8',
  )
  const bookingIntegrityMigration = readFileSync(
    path.join(REPO_CODE_ROOT, 'supabase/migrations/0093_public_booking_integrity.sql'),
    'utf8',
  )

  it('RPC:n är service-only, fixed-search-path och har en privat testbar transaktionskärna', () => {
    expect(migration).toMatch(
      /create or replace function private\.atomic_erase_tenant_customer_tx\([\s\S]*security definer[\s\S]*set search_path = ''/,
    )
    expect(migration).toMatch(
      /create or replace function public\.atomic_erase_tenant_customer\([\s\S]*security definer[\s\S]*set search_path = ''/,
    )
    expect(migration).toMatch(
      /revoke all on function public\.atomic_erase_tenant_customer\([\s\S]*from public, anon, authenticated, service_role/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.atomic_erase_tenant_customer\([\s\S]*to service_role/,
    )
  })

  it('transaktionen omfattar alla aktuella PII-band och audit i samma funktion', () => {
    for (const relation of [
      'public.bookings',
      'public.customer_favorites',
      'public.customer_notes',
      'public.customer_notification_prefs',
      'public.push_subscriptions',
      'public.notifications_outbox',
      'private.customer_account_claims',
      'public.loyalty_members',
      'public.shop_orders',
      'public.shop_order_items',
      'public.gift_cards',
      'public.event_registrations',
      'public.offert_requests',
      'public.customers',
      'public.audit_log',
    ]) {
      expect(migration).toContain(relation)
    }
    expect(migration).not.toMatch(/delete from public\.bookings/)
    expect(migration).not.toMatch(/delete from public\.payments/)
    for (const piiColumn of [
      'gift_recipient_name',
      'gift_recipient_email',
      'gift_message',
      'recipient_name',
      'recipient_email',
      'reply_message',
    ]) {
      expect(migration).toContain(piiColumn)
    }
  })

  it('Auth-fasen har ett service-only claim/fail/ack-protokoll med lås och lease', () => {
    expect(migration).toContain('claim_customer_erasure_auth_cleanup')
    expect(migration).toContain('fail_customer_erasure_auth_cleanup')
    expect(migration).toContain('ack_customer_erasure_auth_cleanup')
    expect(migration).toContain('claim_token')
    expect(migration).toContain('claim_expires_at')
    expect(migration).toMatch(/customer_erasure_auth_cleanup[\s\S]*for update/)
    for (const rpc of [
      'claim_customer_erasure_auth_cleanup',
      'fail_customer_erasure_auth_cleanup',
      'ack_customer_erasure_auth_cleanup',
    ]) {
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*to service_role`),
      )
    }
  })

  it('gdpr-pending JWT kan inte skapa ny bokning/PII men storefront service-flödet bevaras', () => {
    expect(migration).toContain('reject_contained_profile_booking')
    expect(migration).toContain('gdpr_pending_auth_delete')
    expect(migration).toMatch(/create trigger[\s\S]*on public\.bookings/)
    expect(migration).toContain('auth.uid()')
    expect(migration).toContain("u.status = 'active'")
    expect(migration).toContain('u.tenant_id = new.tenant_id')
    expect(migration).toContain('new.customer_profile_id = v_auth_user')
    expect(migration).toContain('c.auth_user_id = v_auth_user')
    expect(bookingIntegrityMigration).toMatch(
      /grant execute on function public\.create_storefront_booking\([\s\S]*\) to service_role/,
    )
  })
})
