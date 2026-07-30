import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { slugify } from './types'

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
const actions = readFileSync(resolve(import.meta.dirname, 'actions.ts'), 'utf8')
const admin = readFileSync(
  resolve(import.meta.dirname, '../../../components/admin/BloggAdmin.tsx'),
  'utf8',
)

describe('Goal 90 blogg contract', () => {
  it('normaliserar både egen slug och rubrik till en giltig URL-identitet', () => {
    expect(slugify('  ÅÄÖ & Élan  ')).toBe('aao-elan')
    expect(slugify('💐')).toBe('')
    expect(actions).toContain('slugify(slugRaw || title)')
    expect(actions).toContain("if (!slug) return { error: 'Ange en giltig slug.' }")
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

  it('låter actions skapa draft och använda RPC utan read-then-update', () => {
    expect(actions).toContain("status: 'draft'")
    expect(actions).toContain(".rpc('set_blog_post_status'")
    expect(actions).not.toContain(".select('status, published_at')")
    expect(actions).not.toContain(".select('published_at')")
  })

  it('visar arkivering i stället för permanent delete efter publicering', () => {
    expect(admin).toContain(
      "const nextStatus = isPublished ? 'archived' : 'published'",
    )
    expect(admin).toContain('Publicerad historik bevaras.')
    expect(admin).toContain('post.published_at ? (')
  })
})
