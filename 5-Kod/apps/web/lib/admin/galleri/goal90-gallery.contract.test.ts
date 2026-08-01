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
const actions = read(new URL('./actions.ts', import.meta.url))
const admin = read(new URL('../../../components/admin/GalleriAdmin.tsx', import.meta.url))
const page = read(new URL('../../../app/(admin)/admin/galleri/page.tsx', import.meta.url))
const areas = read(new URL('../../../lib/auth/admin-areas.ts', import.meta.url))
const nav = read(new URL('../../../components/portal/nav-items.ts', import.meta.url))
const mediaActions = read(new URL('../media/actions.ts', import.meta.url))
const loader = read(new URL('../../storefront/galleri/load-galleri.ts', import.meta.url))
const themeModules = [
  'layouts/florist/ateljevinter.modules.tsx',
  'layouts/florist/aurora.modules.tsx',
  'layouts/florist/blomstertorget.modules.tsx',
  'layouts/florist/calytrix.modules.tsx',
  'layouts/florist/eloria.modules.tsx',
  'layouts/florist/lunaria.modules.tsx',
  'layouts/florist/onyx.modules.tsx',
  'layouts/florist/solsalt.modules.tsx',
  'layouts/florist/sivsav.modules.tsx',
  'layouts/salong/kalla.modules.tsx',
  'layouts/salong/siluett.modules.tsx',
  'layouts/salong/snitt.modules.tsx',
].map((path) => read(new URL(`../../../components/storefront/${path}`, import.meta.url)))

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
    expect(mediaActions).toContain("error?.code === '23503'")
    expect(mediaActions).toContain('Bilden används')
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
    expect(admin).toContain('name="alt_override"')
    expect(admin).toContain('name="decorative"')
    expect(loader).toContain('alt_override, decorative')
    for (const theme of themeModules) expect(theme).toContain('g.decorative')
    expect(reviewMigration).toContain("nullif(btrim(coalesce(g.caption, '')), '') is null")
    expect(reviewMigration).toContain("nullif(btrim(coalesce(m.alt, '')), '') is not null")
  })

  it('reorders one complete tenant set atomically through a locked RPC', () => {
    expect(migration).toContain('public.reorder_gallery_items')
    expect(migration).toContain('for update')
    expect(migration).toContain('gallery_reorder_incomplete')
    expect(migration).toContain('with ordinality')
    expect(migration).toContain('insert into public.audit_log')
    expect(actions).toContain("rpc('reorder_gallery_items'")
    expect(loader).toContain(".order('sort_order'")
    expect(loader).toContain(".order('id'")
  })

  it('adds a module-gated customer surface with paused read-only behavior', () => {
    expect(areas).toContain("| 'galleri'")
    expect(nav).toContain("href: '/admin/galleri'")
    expect(page).toContain("requireAdminArea('galleri')")
    expect(page).toContain("moduleAdminState(states, 'galleri')")
    expect(page).toContain('readOnly={state ===')
    expect(actions).toContain("moduleCtx(fd, 'galleri')")
    expect(actions).not.toContain("fd.get('tenantId')")
  })

  it('uses real keyboard/touch buttons for ordering instead of drag-only controls', () => {
    expect(admin).toContain('Flytta')
    expect(admin).toContain('upp')
    expect(admin).toContain('ned')
    expect(admin).not.toContain('draggable=')
  })

  it('normalizes legacy negative order before adding the non-negative constraint', () => {
    expect(preflightMigration).toContain('set sort_order = 0')
    expect(preflightMigration).toContain('where sort_order < 0')
  })
})
