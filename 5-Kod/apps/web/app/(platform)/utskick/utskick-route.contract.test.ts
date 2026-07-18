import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagePath = resolve(import.meta.dirname, 'page.tsx')
const viewPath = resolve(import.meta.dirname, 'UtskickCenter.tsx')

describe('/utskick server route contract', () => {
  it('self-gates and applies URL filters in typed server-side RPC reads', () => {
    expect(existsSync(pagePath), '/utskick/page.tsx is missing').toBe(true)
    if (!existsSync(pagePath)) return

    const page = readFileSync(pagePath, 'utf8')
    expect(page).toContain('await requirePlatformAdmin()')
    expect(page).toContain("supabase.rpc('platform_outbox_summary')")
    expect(page).toContain("supabase.rpc('platform_outbox_rows', rowArgs)")
    expect(page).toContain('searchParams: Promise<')
    expect(page).toContain('p_tenant')
    expect(page).toContain('p_channel')
    expect(page).toContain('p_status')
    expect(page).toContain('p_category')
    expect(page).toContain('p_limit: 100')
    expect(page).toContain('<UtskickCenter')
  })

  it('keeps the view PII-free and reuses the portal table/component language', () => {
    expect(existsSync(viewPath), 'UtskickCenter.tsx is missing').toBe(true)
    if (!existsSync(viewPath)) return

    const view = readFileSync(viewPath, 'utf8')
    expect(view).toContain('PageHead')
    expect(view).toContain('Stat')
    expect(view).toContain('Card')
    expect(view).toContain('Badge')
    expect(view).toContain('EmptyState')
    expect(view).toMatch(/<table className="ptable"/)
    expect(view).toContain("overflowX: 'auto'")
    expect(view).toContain('<form')
    expect(view).toContain('name="tenant"')
    expect(view).toContain('name="channel"')
    expect(view).toContain('name="status"')
    expect(view).toContain('name="category"')
    expect(view).not.toMatch(/customer_(id|email|phone)|payload/)
  })
})
