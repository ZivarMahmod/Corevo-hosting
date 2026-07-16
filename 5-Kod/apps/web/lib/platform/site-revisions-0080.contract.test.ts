import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const MIGRATION = path.join(CODE_ROOT, 'supabase', 'migrations', '0080_site_revisions.sql')

const sql = () => (fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8').toLowerCase() : '')
const rpc = (source: string, name: string) => {
  const start = source.indexOf(`create or replace function public.${name}(`)
  const end = source.indexOf(`revoke all on function public.${name}`, start)
  return start >= 0 && end > start ? source.slice(start, end) : ''
}

describe('0080 site revision foundation', () => {
  it('stores one optimistic draft and immutable published history per tenant', () => {
    const source = sql()

    expect(source).toContain('create table public.site_revisions')
    expect(source).toContain('snapshot jsonb not null')
    expect(source).toContain('lock_version bigint not null')
    expect(source).toMatch(/status text not null[\s\S]*?check \(status in \('draft', 'published'\)\)/)
    expect(source).toMatch(
      /create unique index site_revisions_one_draft_per_tenant_idx[\s\S]*?on public\.site_revisions \(tenant_id\)[\s\S]*?where \(status = 'draft'\)/,
    )
    expect(source).toContain('source_revision_id uuid')
    expect(source).toContain('create trigger trg_site_revisions_immutable')
    expect(source).toMatch(/if tg_op in \('update', 'delete'\)[\s\S]*?old\.status = 'published'/)
  })

  it('keeps revisions private behind organization-scoped RLS and explicit grants', () => {
    const source = sql()

    expect(source).toContain('alter table public.site_revisions enable row level security')
    expect(source).toContain('create policy site_revisions_read on public.site_revisions')
    expect(source).toContain('(select private.is_platform_admin())')
    expect(source).toContain('tenant_id = (select private.tenant_id())')
    expect(source).toContain('(select private.has_organization_scope())')
    expect(source).toContain('revoke all on table public.site_revisions from public, anon, authenticated')
    expect(source).toContain('grant select on table public.site_revisions to authenticated')
    expect(source).not.toMatch(/grant\s+[^;]*on table public\.site_revisions to anon/)
    expect(source).not.toContain('create policy site_revisions_insert')
    expect(source).not.toContain('create policy site_revisions_update')
    expect(source).not.toContain('create policy site_revisions_delete')
    expect(source).toContain('create or replace function private.assert_site_snapshot(')
    expect(source).toContain('create or replace function private.assert_site_snapshot_branding(')
    expect(source).toMatch(/create or replace function public\.save_site_draft\([\s\S]*?perform private\.assert_site_snapshot\(p_snapshot\)/)
  })

  it('accepts only the canonical normal form emitted by the TypeScript boundary', () => {
    const source = sql()
    const validator = source.slice(
      source.indexOf('create or replace function private.assert_site_snapshot('),
      source.indexOf('revoke all on function private.assert_site_snapshot(jsonb)'),
    )
    const branding = source.slice(
      source.indexOf('create or replace function private.assert_site_snapshot_branding('),
      source.indexOf('revoke all on function private.assert_site_snapshot_branding(jsonb)'),
    )

    expect(validator).toContain("jsonb_array_length(v_value) not between 1 and 31")
    expect(source).toContain('create or replace function private.site_js_trim(p_value text)')
    expect(source).toContain('create or replace function private.site_font_is_safe(p_value text)')
    expect(source).toContain('not private.site_font_is_safe(v_branding ->> v_key)')
    expect(source).not.toContain('[:space:]')
    expect(source).toContain('chr(65279)')
    expect(validator).toContain("(v_tenant ->> 'name') <> private.site_js_trim(v_tenant ->> 'name')")
    expect(validator).toContain("length(private.site_js_trim(v_value ->> 'phone')) not between 1 and 320")
    expect(validator).toContain("length(private.site_js_trim(v_location ->> 'address')) not between 1 and 500")
    expect(branding).toContain("(v_branding ->> v_key) <> private.site_js_trim(v_branding ->> v_key)")
    expect(branding).toContain("(v_item #>> '{}') <> private.site_js_trim(v_item #>> '{}')")
    expect(branding).toContain("where key <> all(array[")
  })

  it('provides fenced optimistic save, discard and restore primitives', () => {
    const source = sql()

    expect(source).toMatch(
      /create or replace function private\.assert_site_revision_access\([\s\S]*?\(select auth\.uid\(\)\) is null[\s\S]*?private\.is_platform_admin\(\)[\s\S]*?private\.tenant_id\(\)\) = p_tenant[\s\S]*?private\.has_organization_scope\(\)/,
    )

    for (const fn of ['save_site_draft', 'discard_site_draft', 'restore_site_revision']) {
      const body = rpc(source, fn)
      expect(source).toContain(`create or replace function public.${fn}(`)
      expect(body).toContain('security definer')
      expect(body).toContain("set search_path = ''")
      expect(body).toContain('perform private.assert_site_revision_access(p_tenant)')
      expect(body).toContain('tenant_id = p_tenant')
      expect(source).toContain(`revoke all on function public.${fn}`)
      expect(source).toContain(`grant execute on function public.${fn}`)
    }

    expect(source).toContain('site_revision_conflict')
    expect(rpc(source, 'save_site_draft')).toContain('for update')
    expect(rpc(source, 'save_site_draft')).toMatch(/lock_version\s*=\s*\w+\.lock_version \+ 1/)
    expect(rpc(source, 'save_site_draft')).toContain("errcode = '40001'")
    expect(rpc(source, 'discard_site_draft')).toContain("status = 'draft'")
    expect(rpc(source, 'discard_site_draft')).toContain('p_expected_lock_version')
    expect(rpc(source, 'restore_site_revision')).toContain("status = 'published'")
    expect(rpc(source, 'restore_site_revision')).toContain('source_revision_id')
  })

  it('publishes only site-owned tenant, settings, branding and primary-address fields atomically', () => {
    const source = sql()
    const publish = rpc(source, 'publish_site_draft')

    expect(publish).toContain('security definer')
    expect(publish).toContain("set search_path = ''")
    expect(publish).toContain('perform private.assert_site_revision_access(p_tenant)')
    expect(publish).toContain('for update')
    expect(publish).toContain('p_expected_lock_version')
    expect(publish).toContain("status = 'draft'")
    expect(publish).toContain("errcode = '40001'")
    expect(publish).toContain('update public.tenants')
    expect(publish).toContain('insert into public.tenant_settings')
    expect(publish).toContain('update public.locations')
    expect(publish).toContain('insert into public.locations')
    expect(publish).not.toContain('site_primary_location_missing')
    expect(publish).toContain('is_primary = true')
    expect(publish).toContain("status = 'published'")
    expect(publish).not.toContain('public.staff')
    expect(publish).not.toContain('public.services')
    expect(publish).toContain('private.merge_site_owned_json')
    expect(publish).toContain('perform private.assert_site_snapshot(v_snapshot)')
    expect(publish).toContain("array['variant', 'pickermode', 'staffavatars']")
    expect(publish).toContain("tenant_settings.settings -> 'booking'")
    expect(publish).toMatch(/tenant_settings\.settings[\s\S]*?- 'copy'[\s\S]*?- 'booking'/)
    expect(publish).toMatch(/tenant_settings\.branding[\s\S]*?- 'color_primary'[\s\S]*?- 'stats'/)
    expect(publish).not.toMatch(/set\s+settings\s*=\s*v_snapshot\s*->\s*'settings'/)
    expect(publish).not.toMatch(/set\s+branding\s*=\s*v_snapshot\s*->\s*'branding'/)
    expect(publish).toMatch(/returns table \(revision_id uuid, lock_version bigint, snapshot jsonb\)/)
    expect(publish).toContain('return query select v_revision_id, v_lock_version, v_snapshot')

    for (const key of ['copy', 'booking', 'contact', 'social', 'map', 'opening_hours']) {
      expect(publish).toContain(`'${key}'`)
    }
    expect(publish).not.toMatch(/array\[[^\]]*'theme'/)
    expect(publish).not.toContain("- 'theme'")
    for (const key of [
      'color_primary',
      'color_bg',
      'color_fg',
      'color_accent',
      'font_body',
      'font_display',
      'logo_url',
      'hero_images',
      'gallery_images',
      'about_image',
      'closing_image',
      'stats',
    ]) {
      expect(publish).toContain(`'${key}'`)
    }
  })

  it('validates normalized email and social hrefs at the direct RPC boundary', () => {
    const source = sql()
    const validator = source.slice(
      source.indexOf('create or replace function private.assert_site_snapshot('),
      source.indexOf('revoke all on function private.assert_site_snapshot(jsonb)'),
    )

    expect(validator).toContain("v_value ->> 'email'")
    expect(validator).toContain("not between 1 and 200")
    expect(validator).toContain("^[^@]+@[^@]+\\.[^@]+$")
    expect(validator).toContain('private.site_has_js_whitespace')
    expect(validator).toContain('select 1 from jsonb_each(v_value) item')
    expect(validator).toContain("not between 1 and 300")
    expect(validator).toContain("^https?://")
  })

  it('exposes every mutating RPC only to authenticated callers', () => {
    const source = sql()

    for (const fn of [
      'save_site_draft',
      'discard_site_draft',
      'restore_site_revision',
      'publish_site_draft',
    ]) {
      expect(source).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]*?from public, anon`))
      expect(source).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]*?to authenticated`))
    }
  })
})
