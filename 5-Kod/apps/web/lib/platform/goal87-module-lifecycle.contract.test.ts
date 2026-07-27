import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260726225246_goal87_module_lifecycle.sql',
  ),
  'utf8',
).toLowerCase()
const rpcGatesMigration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260727055957_goal87_public_rpc_module_gates.sql',
  ),
  'utf8',
).toLowerCase()
const shopTokenFenceMigration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260727062701_goal87_shop_order_token_fence.sql',
  ),
  'utf8',
).toLowerCase()

describe('goal 87 module lifecycle migration', () => {
  it('owns identity, legal transitions, tenant activity and first defaults in one guard', () => {
    expect(migration).toContain(
      'create or replace function public.tenant_modules_state_guard()',
    )
    for (const column of [
      'new.id is distinct from old.id',
      'new.tenant_id is distinct from old.tenant_id',
      'new.module_key is distinct from old.module_key',
      'new.created_at is distinct from old.created_at',
      'new.activated_at is distinct from old.activated_at',
    ]) {
      expect(migration).toContain(column)
    }
    for (const transition of [
      "old.state = 'off' and new.state = 'draft'",
      "old.state = 'draft' and new.state = 'live'",
      "old.state = 'live' and new.state = 'paused'",
      "old.state = 'paused' and new.state = 'live'",
      "old.state in ('draft', 'live') and new.state = 'off'",
    ]) {
      expect(migration).toContain(transition)
    }
    expect(migration).toContain("t.status = 'active'")
    expect(migration).toMatch(
      /select m\.default_config[\s\S]*from public\.modules m[\s\S]*new\.config := v_default_config \|\| new\.config/,
    )
  })

  it('defines hardened shared public-read, public-action and readiness resolvers', () => {
    for (const signature of [
      'private.module_state(p_tenant uuid, p_module text)',
      'private.module_public_readable(p_tenant uuid, p_module text)',
      'private.module_public_action_allowed(p_tenant uuid, p_module text)',
      'private.module_readiness_missing(p_tenant uuid, p_module text)',
      'public.tenant_module_readiness(p_tenant uuid)',
    ]) {
      expect(migration).toContain(signature)
    }
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(
      6,
    )
    expect(migration).toMatch(
      /revoke all on function public\.tenant_module_readiness\(uuid\)[\s\S]*from public, anon, authenticated, service_role/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.tenant_module_readiness\(uuid\)[\s\S]*to authenticated, service_role/,
    )
  })

  it('gates every current module-owned public read policy', () => {
    const policies: Record<string, string> = {
      services_public_read: 'booking',
      staff_public_read: 'booking',
      staff_services_public_read: 'booking',
      locations_public_read: 'booking',
      location_opening_hours_public_read: 'booking',
      working_hours_public_read: 'booking',
      working_hour_slots_public_read: 'booking',
      shop_products_public_read: 'shop',
      shop_variants_public_read: 'shop',
      shop_shipping_options_public_read: 'shop',
      blog_posts_public_read: 'blogg',
      loyalty_plans_public_read: 'lojalitet',
      tenant_events_public_read: 'kurser',
      gallery_items_public_read: 'galleri',
    }
    for (const [policy, moduleKey] of Object.entries(policies)) {
      expect(migration).toMatch(
        new RegExp(
          `create policy ${policy}[\\s\\S]*private\\.module_public_readable\\([^;]*'${moduleKey}'`,
        ),
      )
    }
  })

  it('re-gates booking and shop mutation RPCs at the DB boundary', () => {
    expect(migration).toMatch(
      /module_public_action_allowed\(v_tenant, 'booking'\)/,
    )
    expect(migration).toMatch(
      /module_public_action_allowed\(v_tenant, 'shop'\)/,
    )
    expect(migration).toContain(
      'revoke all on function private.create_public_booking_goal87_impl',
    )
    expect(migration).toContain(
      'revoke all on function private.reserve_shop_order_goal87_impl',
    )
    expect(migration).toContain(
      'revoke all on function private.confirm_shop_order_goal87_impl',
    )
  })

  it('gates every RLS-bypassing public module RPC at the DB boundary', () => {
    for (const implementation of [
      'get_public_bookable_starts_goal87_impl',
      'start_booking_verification_goal87_impl',
      'event_seats_left_goal87_impl',
      'get_public_booking_goal87_impl',
      'get_public_shop_order_goal87_impl',
    ]) {
      expect(rpcGatesMigration).toContain(
        `revoke all on function private.${implementation}`,
      )
    }
    expect(rpcGatesMigration).toMatch(
      /module_public_action_allowed\(v_tenant, 'booking'\)/,
    )
    expect(rpcGatesMigration.match(/module_public_readable\(/g)).toHaveLength(4)
    expect(rpcGatesMigration.match(/set search_path = ''/g)).toHaveLength(6)
    expect(rpcGatesMigration).toContain(
      "module_state(v_tenant, 'booking') not in ('draft', 'live')",
    )
    expect(rpcGatesMigration).toContain(
      'private.create_public_booking_goal87_impl(',
    )
    expect(shopTokenFenceMigration).toContain("set search_path = ''")
    expect(shopTokenFenceMigration).toContain(
      'private.get_public_shop_order_goal87_impl(p_id, p_token)',
    )
    expect(
      shopTokenFenceMigration.indexOf('v_session_token <> p_token'),
    ).toBeLessThan(
      shopTokenFenceMigration.indexOf(
        "not private.module_public_readable(v_tenant, 'shop')",
      ),
    )
  })

  it('locks the canonical catalog and repairs the late loyalty drift', () => {
    for (const key of [
      'booking',
      'media_library',
      'shop',
      'offert',
      'blogg',
      'lojalitet',
      'presentkort',
      'kurser',
      'galleri',
    ]) {
      expect(migration).toContain(`'${key}'`)
    }
    expect(migration).toContain("default_modules - 'loyalty'")
    expect(migration).toContain("jsonb_build_object('lojalitet'")
  })
})
