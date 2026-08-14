import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RESERVED_SUBDOMAINS } from '@/lib/tenant'

const canonical = [...DEFAULT_RESERVED_SUBDOMAINS]
const csv = canonical.join(',')
const read = (url: URL) => readFileSync(url, 'utf8')

describe('reserved host parity', () => {
  it('keeps both tracked env files on the exact canonical TypeScript set', () => {
    const files = [
      new URL('../../../../.env.example', import.meta.url),
      new URL('../../.env.production', import.meta.url),
    ]
    for (const file of files) {
      const value = /^NEXT_PUBLIC_RESERVED_SUBDOMAINS=(.+)$/m.exec(read(file))?.[1] ?? ''
      expect(value.split(',').filter(Boolean)).toEqual(canonical)
    }
  })

  it('keeps deploy configuration on the canonical TypeScript set', () => {
    const files = [
      new URL('../../wrangler.jsonc', import.meta.url),
      new URL('../../scripts/domain-routes.mjs', import.meta.url),
    ]
    for (const file of files) expect(read(file)).toContain(csv)
  })

  it('keeps the SQL fallback slug denylist fail-closed', () => {
    const sql = read(
      new URL(
        '../../../../supabase/migrations/20260810090000_reserve_motiontest_tenant_slug.sql',
        import.meta.url,
      ),
    )
    const block = /v_slug\s+not\s+in\s*\(([^)]+)\)/i.exec(sql)?.[1] ?? ''
    const labels = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1])
    expect(labels).toEqual(expect.arrayContaining(canonical))
    expect(new Set(labels).size).toBe(labels.length)
  })
})
