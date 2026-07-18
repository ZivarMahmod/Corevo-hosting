import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0116_partner_management_summary.sql'),
  'utf8',
)

describe('0116 partner management summary', () => {
  it('synchronizes the open local month before frontend reads', () => {
    expect(sql).toContain('create or replace function public.sync_partner_license_open_month(')
    expect(sql).toContain('private.partner_month(p.id, now())')
    expect(sql).toContain('on conflict (partner_id, tenant_id, month) do update')
    expect(sql).toContain('to authenticated')
  })

  it('exposes one server-scoped summary for root and the current partner only', () => {
    expect(sql).toContain('create or replace function public.platform_partner_summaries()')
    expect(sql).toContain('private.has_platform_access()')
    expect(sql).toContain('private.is_platform_admin()')
    expect(sql).toContain('p.id = (select private.partner_id())')
    expect(sql).toContain('grant execute on function public.platform_partner_summaries() to authenticated')
  })

  it('derives the live open-month license amount from the editable unit price', () => {
    expect(sql).toContain("private.partner_month(p.id, now())")
    expect(sql).toContain("lm.month = private.partner_month(p.id, now())")
    expect(sql).toContain('sum(lm.unit_price_ore)')
    expect(sql).toContain("t.status = 'active'")
  })

  it('attributes current-month communication cost through tenant ownership', () => {
    expect(sql).toContain('o.partner_id = p.id')
    expect(sql).not.toContain('ot.partner_id = p.id')
    expect(sql).toContain("o.created_at >= (private.partner_month(p.id, now())::timestamp at time zone p.timezone)")
    expect(sql).toContain('sum(coalesce(o.cost_ore, 0))')
    expect(sql).toContain("o.chosen_channel = 'sms'")
    expect(sql).toContain("o.status <> 'simulated'")
    expect(sql).toContain("coalesce(sms_total.currency, 'SEK')")
    expect(sql).toContain('max(o.cost_currency)')
  })
})
