import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { slugify } from './types'

const mocks = vi.hoisted(() => ({
  moduleCtx: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
  resolveReadyTenantAssetId: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/admin/module-ctx', () => ({ moduleCtx: mocks.moduleCtx }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenant: mocks.revalidateTenant }))
vi.mock('@/lib/media/lifecycle', () => ({
  resolveReadyTenantAssetId: mocks.resolveReadyTenantAssetId,
}))

import { createBlogPost, updateBlogPost } from './actions'

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../../supabase/migrations/20260729081929_goal90_blogg_contract.sql',
  ),
  'utf8',
).toLowerCase()
const scopeMigration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../../supabase/migrations/20260729124000_goal90_content_scope_guard.sql',
  ),
  'utf8',
).toLowerCase()

describe('Goal 90 blogg contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.moduleCtx.mockResolvedValue({
      tenant: { id: 'tenant-1', slug: 'blogg-test' },
    })
  })

  it.each([
    ['create', createBlogPost],
    ['update', updateBlogPost],
  ])('rejects a blank title through the shared %s parser', async (_, action) => {
    const fd = new FormData()
    fd.set('id', 'post-1')
    fd.set('title', '   ')

    await expect(action({}, fd)).resolves.toEqual({ error: 'Ange en rubrik.' })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('normaliserar både egen slug och rubrik till en giltig URL-identitet', () => {
    expect(slugify('  ÅÄÖ & Élan  ')).toBe('aao-elan')
    expect(slugify('💐')).toBe('')
  })

  it('låser icke-tom och tenantunik slug i databasen', () => {
    expect(migration).toContain('alter column slug set not null')
    expect(migration).toContain("check (pg_catalog.btrim(slug) <> '')")
    expect(migration).toMatch(
      /unique index[\s\S]*blog_posts[\s\S]*tenant_id[\s\S]*lower\(slug\)/,
    )
  })

  it('äger statusövergång, första publicering och audit i ett låst DB-kommando', () => {
    expect(migration).toContain(
      'create or replace function public.set_blog_post_status',
    )
    expect(migration).toContain('for update')
    expect(migration).toContain('coalesce(v_post.published_at, pg_catalog.now())')
    expect(migration).toContain('insert into public.audit_log')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain(
      'revoke all on function public.set_blog_post_status(uuid, uuid, text)',
    )
    expect(migration).toMatch(
      /grant execute on function public\.set_blog_post_status\(uuid, uuid, text\)\s+to authenticated/,
    )
    expect(migration).toContain('blog_post_lifecycle_is_db_owned')
    expect(migration).toContain('before insert or update on public.blog_posts')
  })

  it('kräver organisationsomfattning även genom SECURITY DEFINER', () => {
    expect(scopeMigration).toContain('private.require_goal90_content_admin')
    expect(scopeMigration).toContain('private.has_organization_scope()')
    expect(scopeMigration).toContain("'blog_post_status_access_denied'")
    expect(scopeMigration).toContain(
      'revoke all on function private.goal90_set_blog_post_status_impl',
    )
  })

  it('förbjuder hard delete efter första publicering', () => {
    expect(migration).toContain('published_blog_post_delete_forbidden')
    expect(migration).toContain('before delete on public.blog_posts')
  })
})
