import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL(
  '../../../../../supabase/migrations/20260729134605_goal91_value_flows.sql',
  import.meta.url,
)
const migration = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8').toLowerCase() : ''
const releaseMigrationUrl = new URL(
  '../../../../../supabase/migrations/20260729154000_goal91_db_release_gate.sql',
  import.meta.url,
)
const releaseMigration = existsSync(releaseMigrationUrl)
  ? readFileSync(releaseMigrationUrl, 'utf8').toLowerCase()
  : ''
const actions = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8')
const data = readFileSync(new URL('./data.ts', import.meta.url), 'utf8')
const admin = readFileSync(
  new URL('../../../components/admin/PresentkortAdmin.tsx', import.meta.url),
  'utf8',
)
const commerce = readFileSync(new URL('../../release/commerce.ts', import.meta.url), 'utf8')
const shopActions = readFileSync(
  new URL('../../../app/butik/actions.ts', import.meta.url),
  'utf8',
)

describe('Goal 91 presentkort contract', () => {
  it('stores value in an append-only, tenant-bound ledger', () => {
    expect(migration).toContain('create table public.gift_card_entries')
    expect(migration).toContain('foreign key (gift_card_id, tenant_id)')
    expect(migration).toContain('reversal_of')
    expect(migration).toContain('idempotency_key')
    expect(migration).toContain('request_hash')
    expect(migration).toContain('gift_card_entries_append_only')
  })

  it('owns every value transition in locked idempotent DB commands', () => {
    for (const command of [
      'issue_gift_card',
      'redeem_gift_card',
      'restore_gift_card_redemption',
      'void_gift_card',
      'adjust_gift_card',
    ]) {
      expect(migration).toContain(`function public.${command}`)
    }
    expect(migration.match(/for update/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(migration).toContain('gift_card_idempotency_conflict')
    expect(migration).toContain('gift_card_insufficient_balance')
    expect(migration).toContain('gift_card_expired')
  })

  it('redacts old raw codes and exposes only hash plus masked suffix', () => {
    expect(migration).toContain('code_hash')
    expect(migration).toContain('code_last_four')
    expect(migration).toContain("'redacted:'")
    expect(data).toContain('code_last_four')
    expect(data).not.toMatch(/\.select\([^)]*\bcode\b/)
    expect(admin).toContain('card.maskedCode')
    expect(admin).not.toContain('card.code}')
  })

  it('routes admin mutations through commands without direct value writes', () => {
    expect(actions).toContain("rpc('issue_gift_card'")
    expect(actions).toContain("rpc('redeem_gift_card'")
    expect(actions).toContain("rpc('void_gift_card'")
    expect(actions).not.toMatch(/from\('gift_cards'\)[\s\S]{0,200}\.(insert|update|delete)\(/)
  })

  it('keeps paid gift cards behind their own closed release fence', () => {
    expect(commerce).toContain('COREVO_GIFT_CARD_VALUE_RELEASE')
    expect(commerce).toContain('COREVO_GIFT_CARD_TENANT_IDS')
    expect(shopActions).toContain('giftCardValueReleased')
    expect(shopActions).toContain("kind === 'giftcard'")
    expect(releaseMigration).toContain('create table private.gift_card_value_releases')
    expect(releaseMigration).toContain('trg_gift_card_entries_release')
    expect(releaseMigration).toContain('gift_card_value_not_released')
    expect(releaseMigration).toContain("new.entry_type in ('issue', 'redeem', 'adjustment')")
  })
})
