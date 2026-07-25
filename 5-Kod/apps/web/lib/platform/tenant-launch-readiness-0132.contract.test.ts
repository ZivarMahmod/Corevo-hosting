import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/0132_tenant_launch_booking_tuple.sql',
)
const correctionPath = resolve(
  process.cwd(),
  '../../supabase/migrations/0133_tenant_launch_booking_default.sql',
)
const runtimePath = resolve(
  process.cwd(),
  '../../supabase/tests/tenant_launch_booking_tuple_0132_test.sql',
)
const previewFixturePath = resolve(
  process.cwd(),
  '../../supabase/seeds/preview/goal84-freshcut-fixture.sql',
)
const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
const runtime = readFileSync(runtimePath, 'utf8').toLowerCase()
const previewFixture = existsSync(previewFixturePath)
  ? readFileSync(previewFixturePath, 'utf8').toLowerCase()
  : ''

const freshCutServiceIds = [
  '55555555-0000-0000-0000-000000000001',
  '55555555-0000-0000-0000-000000000004',
  '55555555-0000-0000-0000-000000000003',
  '55555555-0000-0000-0000-000000000005',
  '55555555-0000-0000-0000-000000000006',
  '55555555-0000-0000-0000-000000000007',
  '55555555-0000-0000-0000-000000000002',
]

describe('goal-84 launch readiness booking tuple', () => {
  it('ships the unapplied correction as one migration with one contract', () => {
    expect(existsSync(correctionPath)).toBe(false)
    expect(migration).toContain('create or replace function private.tenant_launch_missing(p_tenant uuid)')
    expect(migration).toContain('create or replace function public.tenant_launch_readiness(p_tenant uuid)')
    expect(migration).toContain('create or replace function public.publish_tenant(p_tenant uuid)')
    expect(
      migration.match(
        /select coalesce\(\([\s\S]*?tm\.state = 'live'[\s\S]*?\), true\) into v_booking_required;/g,
      ),
    ).toHaveLength(3)
  })

  it('requires one real service/staff/location weekday tuple for working_hours', () => {
    for (const table of [
      'public.services svc',
      'public.staff_services ss',
      'public.staff st',
      'public.working_hours wh',
      'public.location_opening_hours loh',
      'public.working_hour_slots ws',
    ]) expect(migration).toContain(table)
    expect(migration).toContain('ws.active = true')
    expect(migration).toContain('ws.weekday = wh.weekday')
    expect(migration).toContain('not exists (')
    expect(migration).toContain('coalesce(svc.slot_step_min, st.slot_step_min, l.slot_step_min, 15)')
    expect(migration).toContain("date '2000-01-01' + ws.start_time")
    expect(migration).toContain("date '2000-01-01' + wh.start_time")
    expect(migration).toContain("pg_catalog.date_part('epoch', wh.end_time - wh.start_time)")
    expect(migration).not.toContain('pg_catalog.extract(')
    expect(migration).toContain("'working_hours'")
    expect(migration).toContain("'confirmed_opening_hours'")
  })

  it('hardens every definer and exposes only the intended public RPCs', () => {
    expect(migration.match(/security definer/g)).toHaveLength(3)
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3)
    expect(migration).toMatch(
      /revoke all on function private\.tenant_launch_missing\(uuid\)\s+from public, anon, authenticated, service_role/,
    )
    for (const fn of ['tenant_launch_readiness', 'publish_tenant']) {
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${fn}\\(uuid\\)\\s+from public, anon, authenticated, service_role`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function public\\.${fn}\\(uuid\\)\\s+to authenticated, service_role`,
        ),
      )
    }
  })

  it('aligns opening-hours reads with the partner-capable tenant write gate', () => {
    expect(migration).toMatch(
      /drop policy if exists location_opening_hours_read\s+on public\.location_opening_hours/,
    )
    expect(migration).toMatch(
      /create policy location_opening_hours_read\s+on public\.location_opening_hours\s+for select to authenticated\s+using \(\s*\(select private\.can_access_tenant\(location_opening_hours\.tenant_id\)\)/,
    )
    expect(migration).toContain(
      'location_opening_hours.tenant_id = (select private.tenant_id())',
    )
    expect(migration).toContain(
      '(select private.can_access_location(location_opening_hours.location_id))',
    )
    expect(migration).toContain('(select private.role_level()) = 2')
  })

  it('keeps direct setup claim-free and resets only after service-role module restoration', () => {
    const serviceRole = "perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);"
    const serviceClaims = '\'{"role":"service_role"}\''
    const roleReset = "perform pg_catalog.set_config('request.jwt.claim.role', '', true);"
    const claimsReset = "perform pg_catalog.set_config('request.jwt.claims', '{}', true);"
    const initialLiveEnd = runtime.indexOf("values (v_tenant, 'booking', 'live');")
    const websitePublish = runtime.indexOf('v_readiness := public.publish_tenant(v_tenant);')
    const websiteStatusReset = runtime.indexOf(
      "update public.tenants set status = 'provisioning' where id = v_tenant;",
      websitePublish,
    )
    const bookingLiveRestore = runtime.indexOf(
      "update public.tenant_modules set state = 'live'",
      websiteStatusReset,
    )
    const serviceRoleBeforePublish = runtime.lastIndexOf(serviceRole, websitePublish)
    const serviceClaimsBeforePublish = runtime.lastIndexOf(serviceClaims, websitePublish)
    const firstRoleReset = runtime.indexOf(roleReset, serviceRoleBeforePublish)
    const firstClaimsReset = runtime.indexOf(claimsReset, serviceClaimsBeforePublish)
    expect(initialLiveEnd).toBeGreaterThan(0)
    expect(runtime.slice(0, initialLiveEnd)).not.toContain(
      "set_config('request.jwt.claim",
    )
    expect(
      runtime.match(
        /perform pg_catalog\.set_config\('request\.jwt\.claim\.role', '', true\);\s*perform pg_catalog\.set_config\('request\.jwt\.claims', '\{\}', true\);/g,
      ) ?? [],
    ).toHaveLength(3)
    expect(runtime).not.toContain(
      "perform pg_catalog.set_config('request.jwt.claims', '', true);",
    )
    expect(serviceRoleBeforePublish).toBeGreaterThan(initialLiveEnd)
    expect(serviceClaimsBeforePublish).toBeGreaterThan(serviceRoleBeforePublish)
    expect(websitePublish).toBeGreaterThan(serviceClaimsBeforePublish)
    expect(websiteStatusReset).toBeGreaterThan(websitePublish)
    expect(bookingLiveRestore).toBeGreaterThan(websiteStatusReset)
    expect(firstRoleReset).toBeGreaterThan(bookingLiveRestore)
    expect(firstClaimsReset).toBeGreaterThan(firstRoleReset)
  })

  it('keeps protected status resets service-scoped and the direct bypass unprivileged', () => {
    const serviceRole = "perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);"
    const serviceClaims = '\'{"role":"service_role"}\''
    const roleReset = "perform pg_catalog.set_config('request.jwt.claim.role', '', true);"
    const claimsReset = "perform pg_catalog.set_config('request.jwt.claims', '{}', true);"
    const idempotenceProof = runtime.indexOf('goal84_publish_not_idempotent')
    const protectedStatusReset = runtime.indexOf(
      "update public.tenants set status = 'provisioning' where id = v_tenant;",
      idempotenceProof,
    )
    const serviceRoleBeforeReset = runtime.lastIndexOf(serviceRole, protectedStatusReset)
    const serviceClaimsBeforeReset = runtime.lastIndexOf(serviceClaims, protectedStatusReset)
    const roleResetAfterStatus = runtime.indexOf(roleReset, idempotenceProof)
    const claimsResetAfterStatus = runtime.indexOf(claimsReset, idempotenceProof)
    expect(idempotenceProof).toBeGreaterThan(serviceClaimsBeforeReset)
    expect(serviceClaimsBeforeReset).toBeGreaterThan(serviceRoleBeforeReset)
    expect(protectedStatusReset).toBeGreaterThan(idempotenceProof)
    expect(roleResetAfterStatus).toBeGreaterThan(protectedStatusReset)
    expect(claimsResetAfterStatus).toBeGreaterThan(roleResetAfterStatus)

    const directActiveBypass = runtime.lastIndexOf(
      "update public.tenants set status = 'active' where id = v_tenant;",
    )
    const serviceRoleBeforeBypass = runtime.lastIndexOf(serviceRole, directActiveBypass)
    const serviceClaimsBeforeBypass = runtime.lastIndexOf(serviceClaims, directActiveBypass)
    const roleResetBeforeBypass = runtime.lastIndexOf(roleReset, directActiveBypass)
    const claimsResetBeforeBypass = runtime.lastIndexOf(claimsReset, directActiveBypass)
    expect(serviceClaimsBeforeBypass).toBeGreaterThan(serviceRoleBeforeBypass)
    expect(roleResetBeforeBypass).toBeGreaterThan(serviceClaimsBeforeBypass)
    expect(claimsResetBeforeBypass).toBeGreaterThan(roleResetBeforeBypass)
    expect(directActiveBypass).toBeGreaterThan(claimsResetBeforeBypass)
  })

  it('keeps one rollback-safe runtime proof for every Goal 84 database case', () => {
    for (const proof of [
      'goal84_valid_tuple_not_ready',
      'goal84_missing_booking_row_failed_open',
      'goal84_missing_booking_publish_not_blocked',
      'goal84_explicit_booking_off_not_honored',
      'goal84_explicit_booking_off_publish_failed',
      'goal84_wrong_weekday_not_blocked',
      'goal84_short_overlap_not_blocked',
      'goal84_unfitting_explicit_start_not_blocked',
      'goal84_valid_explicit_start_not_ready',
      'goal84_missing_confirmation_not_blocked',
      'goal84_publish_not_idempotent',
      'goal84_direct_active_should_have_been_blocked',
      'goal84_runtime_rollback',
    ]) {
      expect(runtime).toContain(proof)
    }
    expect(runtime).toContain("when sqlstate '55000' then null")
  })
})

describe('goal-84 preview-only FreshCut fixture', () => {
  it('allows validated direct or pooled branch URLs and names both hosted project refs', () => {
    const instructions = previewFixture
      .slice(0, previewFixture.indexOf('do $goal84_freshcut$'))
      .replace(/^--\s?/gm, '')
      .replace(/\s+/g, ' ')
    expect(previewFixturePath.replaceAll('\\', '/')).toMatch(
      /\/supabase\/seeds\/preview\/goal84-freshcut-fixture\.sql$/,
    )
    expect(existsSync(previewFixturePath)).toBe(true)
    expect(instructions).toContain('direct or pooled')
    expect(instructions).toContain('session and transaction modes are allowed')
    expect(instructions).toContain('nonempty incoming request context')
    expect(instructions).toContain('role, claims or subject')
    expect(instructions).toContain('empty role and valid claims')
    expect(instructions).toContain('cwnhpesrgolflkmyjbrm')
    expect(instructions).toContain('clylvowtowbtotrahuad')
    expect(instructions).toContain('caller')
    expect(instructions).toContain('database url')
  })

  it('is one executable DO statement with balanced named dollar quotes', () => {
    const firstDo = previewFixture.indexOf('do $goal84_freshcut$')
    const preamble = previewFixture.slice(0, firstDo)
    expect(firstDo).toBeGreaterThanOrEqual(0)
    expect(
      preamble
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .every((line) => line.trimStart().startsWith('--')),
    ).toBe(true)
    expect(previewFixture.slice(firstDo).trim()).toMatch(
      /^do \$goal84_freshcut\$[\s\S]*\$goal84_freshcut\$;$/,
    )
    expect(previewFixture.match(/\$goal84_freshcut\$/g)).toHaveLength(2)
    expect(previewFixture.match(/\bdo \$[a-z0-9_]+\$/g)).toHaveLength(1)
  })

  it('guards the fixed synthetic tenant, slug collision and required baseline rows', () => {
    const firstWrite = previewFixture.indexOf('update public.tenant_settings ts')
    expect(previewFixture).toContain('11111111-1111-1111-1111-111111111111')
    expect(previewFixture).toMatch(/v_existing_slug not in \('demo', 'freshcut'\)/)
    expect(previewFixture).toMatch(
      /t\.slug = 'freshcut'\s+and t\.id <> v_tenant/,
    )
    expect(previewFixture).toMatch(
      /from public\.verticals v\s+where v\.key = 'frisör'/,
    )
    expect(previewFixture).toMatch(
      /from public\.tenant_settings ts\s+where ts\.tenant_id = v_tenant/,
    )
    expect(previewFixture).toMatch(
      /from public\.locations l[\s\S]*l\.tenant_id = v_tenant[\s\S]*l\.is_primary = true[\s\S]*l\.active = true[\s\S]*order by l\.created_at, l\.id[\s\S]*limit 1/,
    )
    for (const guard of [
      'v_existing_slug not in',
      "t.slug = 'freshcut'",
      "v.key = 'frisör'",
      'into v_settings',
      'into v_location',
      'goal84_preview_service_tenant_collision',
    ]) {
      expect(previewFixture.indexOf(guard)).toBeLessThan(firstWrite)
    }
  })

  it('preserves unrelated settings while reconciling exact preview identity', () => {
    expect(previewFixture).toContain("update public.tenant_settings ts")
    expect(previewFixture).toContain("coalesce(ts.settings, '{}'::jsonb)")
    for (const value of [
      "'theme', 'freshcut'",
      "'external_url', 'https://www.bokadirekt.se/'",
      "'email', 'info@freshcut.se'",
      "'phone', '073 876 71 44'",
      "'instagram', 'https://instagram.com/freshcut.lkpg'",
    ]) {
      expect(previewFixture).toContain(value)
    }
    expect(previewFixture).toMatch(
      /insert into public\.tenant_modules[\s\S]*'booking', 'off'[\s\S]*on conflict \(tenant_id, module_key\) do update[\s\S]*state = excluded\.state/,
    )
    expect(previewFixture).toMatch(
      /update public\.locations l[\s\S]*name = 'freshcut'[\s\S]*address = 'bokhållaregatan 2, 582 24 linköping'[\s\S]*timezone = 'europe\/stockholm'/,
    )
  })

  it('upserts the canonical seven services without deleting or reassigning history', () => {
    const compactFixture = previewFixture.replace(/\s+/g, ' ')
    for (const id of freshCutServiceIds) {
      expect(previewFixture).toContain(id)
    }
    for (const literal of [
      "'herrklippning', 'hår och skägg', 30, 36900, true",
      "'herrklippning student', 'hår och skägg', 30, 32900, true",
      "'herrklippning + skägg + varm handduk (långt skägg)', 'hår och skägg', 45, 45900, true",
      "'herrklippning + skägg + varm handduk (kort skägg)', 'hår och skägg', 45, 41900, true",
      "'pensionärklippning', 'hår och skägg', 30, 32900, true",
      "'barnklippning', 'hår och skägg', 25, 29900, true",
      "'skäggtrim', 'hår och skägg', 15, 22900, true",
    ]) {
      expect(compactFixture).toContain(literal)
    }
    expect(previewFixture).toMatch(
      /insert into public\.services[\s\S]*on conflict \(id\) do update set[\s\S]*where services\.tenant_id = excluded\.tenant_id/,
    )
    expect(previewFixture).toMatch(
      /s\.id = any \(v_service_ids\)[\s\S]*s\.tenant_id <> v_tenant/,
    )
    expect(previewFixture).not.toMatch(/\bdelete\s+from\b|\btruncate\b/)
    expect(previewFixture).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:bookings|customers|notifications_outbox|tenant_domains)\b/,
    )
  })

  it('normalizes trusted maintenance, then scopes the protected tenant update to service role', () => {
    const incomingRoleGuard = previewFixture.indexOf(
      "nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '') is not null",
    )
    const incomingClaimsGuard = previewFixture.indexOf(
      "nullif(pg_catalog.current_setting('request.jwt.claims', true), '') is not null",
    )
    const incomingSubGuard = previewFixture.indexOf(
      "nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '') is not null",
    )
    const maintenanceRole = previewFixture.indexOf(
      "set_config('request.jwt.claim.role', '', true)",
    )
    const maintenanceClaims = previewFixture.indexOf(
      "set_config('request.jwt.claims', '{}', true)",
    )
    const settingsWrite = previewFixture.indexOf('update public.tenant_settings ts')
    const moduleWrite = previewFixture.indexOf('insert into public.tenant_modules')
    const locationWrite = previewFixture.indexOf('update public.locations l')
    const serviceWrite = previewFixture.indexOf('insert into public.services')
    const roleClaim = previewFixture.indexOf(
      "set_config('request.jwt.claim.role', 'service_role', true)",
    )
    const claims = previewFixture.indexOf(
      `set_config('request.jwt.claims', '{"role":"service_role"}', true)`,
    )
    const tenantWrite = previewFixture.indexOf('update public.tenants t')

    expect(incomingRoleGuard).toBeGreaterThan(0)
    expect(incomingClaimsGuard).toBeGreaterThan(incomingRoleGuard)
    expect(incomingSubGuard).toBeGreaterThan(incomingClaimsGuard)
    expect(maintenanceRole).toBeGreaterThan(incomingSubGuard)
    expect(maintenanceClaims).toBeGreaterThan(maintenanceRole)
    for (const write of [settingsWrite, moduleWrite, locationWrite, serviceWrite]) {
      expect(write).toBeGreaterThan(maintenanceClaims)
      expect(write).toBeLessThan(roleClaim)
    }
    expect(claims).toBeGreaterThan(roleClaim)
    expect(tenantWrite).toBeGreaterThan(claims)
    expect(previewFixture.match(/update public\.tenants t/g)).toHaveLength(1)
    expect(previewFixture.slice(tenantWrite)).toMatch(
      /update public\.tenants t[\s\S]*where t\.id = v_tenant;/,
    )
    expect(previewFixture).not.toMatch(
      /\b(?:insert\s+into|delete\s+from)\s+public\.tenants\b/,
    )
    expect(previewFixture).not.toContain(
      "set_config('request.jwt.claims', '', true)",
    )
    expect(previewFixture).not.toContain(
      "set_config('request.jwt.claim.sub'",
    )
  })

  it('ends with rollback-causing assertions for every reconciled surface', () => {
    const tenantWrite = previewFixture.indexOf('update public.tenants t')
    const terminal = previewFixture.slice(tenantWrite)
    for (const assertion of [
      'goal84_preview_assert_tenant',
      'goal84_preview_assert_booking_module',
      'goal84_preview_assert_settings',
      'goal84_preview_assert_location',
      'goal84_preview_assert_services',
    ]) {
      expect(terminal).toContain(`raise exception '${assertion}'`)
    }
    for (const id of freshCutServiceIds) {
      expect(terminal).toContain(id)
    }
    expect(terminal.match(/raise exception 'goal84_preview_assert_/g)).toHaveLength(5)
  })
})
