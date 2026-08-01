import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../../../../supabase/migrations/0126_customer_portal_security_devices.sql',
    import.meta.url,
  ),
  'utf8',
)

describe('customer portal security devices migration contract', () => {
  it('lists only neutral session and booking-trust metadata through the live cookie session', () => {
    expect(migration).toContain('create or replace function public.customer_portal_security_snapshot')
    expect(migration).toContain('private.customer_portal_resolve_session')
    expect(migration).toContain('private.customer_portal_sessions')
    expect(migration).toContain('private.customer_booking_trusts')
    expect(migration).toContain("'isCurrent'")
    expect(migration).toContain("'createdAt'")
    expect(migration).toContain("'lastSeenAt'")
    expect(migration).not.toMatch(/p_(tenant|customer)_id/i)
    expect(migration).not.toMatch(/jsonb_build_object\([^;]*(secret_digest|public_id|ip|user_agent)/i)
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain(
      'revoke all on function public.customer_portal_security_snapshot(uuid, text)',
    )
    expect(migration).toContain(
      'grant execute on function public.customer_portal_security_snapshot(uuid, text) to service_role',
    )
  })
})
