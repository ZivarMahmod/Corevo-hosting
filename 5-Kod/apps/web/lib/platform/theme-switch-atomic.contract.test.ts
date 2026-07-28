import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationsDir = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
const migration = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .reverse()
  .map((name) => readFileSync(`${migrationsDir}/${name}`, 'utf8').toLowerCase())
  .find((source) => source.includes('goal 88: atomic theme switch'))
const themeAction = readFileSync(
  fileURLToPath(new URL('./actions/theme.ts', import.meta.url)),
  'utf8',
)
const tenantData = readFileSync(
  fileURLToPath(new URL('../tenant-data.ts', import.meta.url)),
  'utf8',
)
const sidaStudioLazy = readFileSync(
  fileURLToPath(new URL('../../components/platform/SidaStudioV2Lazy.tsx', import.meta.url)),
  'utf8',
)

describe('Goal 88 atomic theme switch contract', () => {
  it('serializes draft check and settings write behind the canonical tenant lock', () => {
    expect(migration).toBeTruthy()
    const tenantLock = migration!.indexOf('select t.vertical_id')
    const draftCheck = migration!.indexOf("sr.status = 'draft'")
    const verticalCas = migration!.indexOf('v_vertical_id is distinct from p_expected_vertical')
    const materialize = migration!.indexOf('insert into public.tenant_settings')
    const settingsLock = migration!.indexOf('from public.tenant_settings ts')
    const settingsCas = migration!.indexOf('v_settings is distinct from p_expected_settings')
    const settingsWrite = migration!.indexOf('update public.tenant_settings ts')

    expect(tenantLock).toBeGreaterThan(-1)
    expect(draftCheck).toBeGreaterThan(tenantLock)
    expect(verticalCas).toBeGreaterThan(draftCheck)
    expect(materialize).toBeGreaterThan(draftCheck)
    expect(materialize).toBeGreaterThan(verticalCas)
    expect(settingsLock).toBeGreaterThan(materialize)
    expect(settingsCas).toBeGreaterThan(settingsLock)
    expect(settingsWrite).toBeGreaterThan(settingsCas)
    expect(migration).toContain('on conflict (tenant_id) do nothing')
    expect(migration).toContain('p_expected_vertical text')
    expect(migration).toContain('v_vertical_id text')
    expect(migration).toContain(
      "v_settings || jsonb_build_object('theme', p_theme, 'copy', p_copy)",
    )
    expect(migration).toContain('private.canonical_site_theme(ts.settings)')
    expect(migration).toContain("else 'leander'")
  })

  it('keeps the SQL canonical theme set equal to the storefront registry', () => {
    const registryBlock = tenantData.match(/STOREFRONT_THEMES\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1]
    const helperBlock = migration?.match(
      /when p_settings ->> 'theme' in \(([\s\S]*?)\)\s*then/,
    )?.[1]
    const literals = (source: string | undefined) =>
      new Set([...(source ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]))

    expect(literals(helperBlock)).toEqual(literals(registryBlock))
  })

  it('keeps the RPC root-only, hardened and narrowly granted', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('(select auth.uid()) is null')
    expect(migration).toContain('private.is_platform_admin()')
    expect(migration).toContain("jsonb_typeof(p_expected_settings) <> 'object'")
    expect(migration).toContain("jsonb_typeof(p_copy) <> 'object'")
    expect(migration).toContain('site_theme_invalid')
    expect(migration).toContain('site_theme_settings_conflict')
    expect(migration).toContain('revoke all on function public.switch_tenant_theme')
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).toContain('grant execute on function public.switch_tenant_theme')
    expect(migration).toContain('to authenticated')
    expect(migration).not.toContain('to anon')
    expect(migration).toContain(
      'public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)',
    )
  })

  it('routes the action through the RPC and removes the split draft/upsert sequence', () => {
    expect(themeAction).toContain("supabase.rpc('switch_tenant_theme'")
    expect(themeAction).not.toContain(".from('site_revisions')")
    expect(themeAction).not.toContain(".upsert({ tenant_id: tenantId, settings }")
  })

  it('guards both draft-creating RPCs after the same tenant lock', () => {
    const save = migration!.slice(
      migration!.indexOf('create or replace function public.save_site_draft'),
      migration!.indexOf('create or replace function public.restore_site_revision'),
    )
    const restore = migration!.slice(
      migration!.indexOf('create or replace function public.restore_site_revision'),
    )

    for (const source of [save, restore]) {
      const lock = source.indexOf(
        'perform 1 from public.tenants t where t.id = p_tenant for update',
      )
      const liveTheme = source.indexOf('private.canonical_site_theme(ts.settings)')
      const conflict = source.indexOf('site_revision_theme_conflict')
      const draftWrite = source.indexOf('insert into public.site_revisions')
      expect(lock).toBeGreaterThan(-1)
      expect(liveTheme).toBeGreaterThan(lock)
      expect(conflict).toBeGreaterThan(liveTheme)
      expect(draftWrite).toBeGreaterThan(conflict)
    }
    expect(save).toContain(
      "v_snapshot_theme := private.canonical_site_theme(p_snapshot -> 'settings')",
    )
    expect(restore).toContain(
      "private.canonical_site_theme(v_snapshot -> 'settings') is distinct from v_live_theme",
    )
  })

  it('keeps the editor keyed by published theme through the success refresh handoff', () => {
    expect(sidaStudioLazy).toContain(
      'key={`${props.tenantId}:${props.publishedSnapshot.settings.theme}`}',
    )
  })
})
