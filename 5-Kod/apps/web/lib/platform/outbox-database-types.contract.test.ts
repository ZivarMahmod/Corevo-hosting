import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const types = readFileSync(resolve(import.meta.dirname, '../../../../packages/db/types.ts'), 'utf8')

describe('generated platform outbox Database signatures', () => {
  it('contains the deployed platform_outbox_summary return shape', () => {
    expect(types).toMatch(
      /platform_outbox_summary:\s*\{[\s\S]*?Args: never[\s\S]*?customers_total: number[\s\S]*?failed_30d: number[\s\S]*?name: string[\s\S]*?prefs_rows: number[\s\S]*?push_subs_active: number[\s\S]*?sent_30d: number[\s\S]*?skipped_30d: number[\s\S]*?slug: string[\s\S]*?sms_cost_ore_30d: number[\s\S]*?tenant_id: string[\s\S]*?\}\[\]/,
    )
  })

  it('contains optional filters and PII-free returns for platform_outbox_rows', () => {
    expect(types).toMatch(
      /platform_outbox_rows:\s*\{[\s\S]*?p_category\?: string[\s\S]*?p_channel\?: string[\s\S]*?p_limit\?: number[\s\S]*?p_status\?: string[\s\S]*?p_tenant\?: string[\s\S]*?chosen_channel: string \| null[\s\S]*?cost_ore: number \| null[\s\S]*?provider_ref: string \| null[\s\S]*?skip_reason: string \| null[\s\S]*?tenant_id: string[\s\S]*?tenant_name: string[\s\S]*?tenant_slug: string[\s\S]*?\}\[\]/,
    )
  })
})
