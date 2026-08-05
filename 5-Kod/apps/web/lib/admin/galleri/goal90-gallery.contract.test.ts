import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (url: URL) => (existsSync(url) ? readFileSync(url, 'utf8') : '')
const migration = read(
  new URL(
    '../../../../../supabase/migrations/20260729114000_goal90_gallery_media_contract.sql',
    import.meta.url,
  ),
).toLowerCase()
const preflightMigration = read(
  new URL(
    '../../../../../supabase/migrations/20260729113000_goal90_gallery_media_preflight.sql',
    import.meta.url,
  ),
).toLowerCase()
const reviewMigration = read(
  new URL(
    '../../../../../supabase/migrations/20260729125000_goal90_review_corrections.sql',
    import.meta.url,
  ),
).toLowerCase()
describe('Goal 90 gallery/media contract', () => {
  it('binds every media reference to the same tenant and restricts silent deletion', () => {
    expect(migration).toContain('media_assets_id_tenant_unique')
    for (const table of [
      'blog_posts',
      'content_slots',
      'gallery_items',
      'shop_products',
      'shop_product_variants',
    ]) {
      expect(migration).toContain(`${table}_asset_tenant_fkey`)
    }
    expect(migration.match(/on delete restrict/g)?.length ?? 0).toBe(5)
    for (const table of [
      'blog_posts',
      'content_slots',
      'gallery_items',
      'shop_products',
      'shop_product_variants',
    ]) {
      expect(preflightMigration).toContain(`${table} has % invalid asset reference(s)`)
    }
  })

  it('owns contextual alternative text and decorative intent on the usage row', () => {
    expect(migration).toContain('alt_override text')
    expect(migration).toContain('decorative boolean not null')
    expect(migration).toContain('gallery_items_accessibility_check')
    expect(reviewMigration).toContain("nullif(btrim(coalesce(g.caption, '')), '') is null")
    expect(reviewMigration).toContain("nullif(btrim(coalesce(m.alt, '')), '') is not null")
  })

  it('reorders one complete tenant set atomically through a locked RPC', () => {
    expect(migration).toContain('public.reorder_gallery_items')
    expect(migration).toContain('for update')
    expect(migration).toContain('gallery_reorder_incomplete')
    expect(migration).toContain('with ordinality')
    expect(migration).toContain('insert into public.audit_log')
  })

  it('normalizes legacy negative order before adding the non-negative constraint', () => {
    expect(preflightMigration).toContain('set sort_order = 0')
    expect(preflightMigration).toContain('where sort_order < 0')
  })
})
