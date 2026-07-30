import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL(
  '../../../../../supabase/migrations/20260729134605_goal91_value_flows.sql',
  import.meta.url,
)
const migration = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8').toLowerCase() : ''
const lockAlignment = readFileSync(
  new URL(
    '../../../../../supabase/migrations/20260729153000_goal91_loyalty_lock_alignment.sql',
    import.meta.url,
  ),
  'utf8',
).toLowerCase()
const actionsUrl = new URL('./actions.ts', import.meta.url)
const actions = existsSync(actionsUrl) ? readFileSync(actionsUrl, 'utf8') : ''
const intake = readFileSync(
  new URL('../../storefront/lojalitet/intake.ts', import.meta.url),
  'utf8',
)

describe('Goal 91 lojalitet contract', () => {
  it('adds command identity, source and exact reversal links to the existing ledger', () => {
    for (const column of [
      'source_type',
      'source_id',
      'reversal_of',
      'idempotency_key',
      'request_hash',
      'actor_user_id',
      'balance_after_points',
    ]) {
      expect(migration).toContain(`add column if not exists ${column}`)
    }
    expect(migration).toContain('loyalty_ledger_tenant_reversal_unique')
    expect(migration).toContain('private.protect_loyalty_customer_merge')
  })

  it('locks one customer sequence and cannot overspend or reverse twice', () => {
    expect(migration).toContain('function public.spend_loyalty_points')
    expect(migration).toContain('function public.reverse_loyalty_spend')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('loyalty_insufficient_points')
    expect(migration).toContain('loyalty_reversal_exists')
    expect(migration).toContain("p_tenant::text || ':' || p_customer::text")
    expect(lockAlignment).toContain('function public.earn_loyalty_on_completed')
    expect(lockAlignment).toContain("new.tenant_id::text || ':' || v_customer::text")
  })

  it('routes admin spend and reversal through the DB commands', () => {
    expect(actions).toContain("rpc('spend_loyalty_points'")
    expect(actions).toContain("rpc('reverse_loyalty_spend'")
    expect(actions).not.toMatch(/from\('loyalty_ledger'\)[\s\S]{0,160}\.insert\(/)
  })

  it('never activates a paid club plan before the subscription rail exists', () => {
    expect(migration).toContain("'pending_payment'")
    expect(migration).toContain('v_plan_price')
    expect(intake).toContain('pendingPayment')
  })

  it('provides tenant reconciliation without a speculative repair engine', () => {
    expect(migration).toContain('function public.loyalty_reconciliation')
    expect(migration).not.toContain('repair_loyalty')
  })
})
