// Spar-VÄGEN (Sajtbyggare S2) — den 'use server'-wrappern exekverad: auth → RBAC →
// flagga → läs prev → applySiteContentEdits → upsert tenant_settings → revalidate.
// (System-Wide-Test-Check: applySiteContentEdits är redan testad PURE — DETTA testar
// att wrappern faktiskt kedjar ihop fence + upsert + fail-closed korrekt.)

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePortal: vi.fn() }))
vi.mock('@/lib/admin/tenant', () => ({ getAdminTenant: vi.fn(), revalidateTenant: vi.fn() }))
vi.mock('@/lib/platform/roles-permissions', () => ({ resolveRoleMatrix: vi.fn() }))
vi.mock('@/lib/platform/catalog-shared', () => ({ canWrite: vi.fn() }))
vi.mock('./flag', () => ({ sajtbyggareEnabled: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { saveSiteContent } from './save-site-content'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant } from '@/lib/admin/tenant'
import { resolveRoleMatrix } from '@/lib/platform/roles-permissions'
import { canWrite } from '@/lib/platform/catalog-shared'
import { sajtbyggareEnabled } from './flag'

const mFlag = vi.mocked(sajtbyggareEnabled)
const mClient = vi.mocked(createClient)
const mRequire = vi.mocked(requirePortal)
const mTenant = vi.mocked(getAdminTenant)
const mMatrix = vi.mocked(resolveRoleMatrix)
const mCanWrite = vi.mocked(canWrite)
const mRevalTenant = vi.mocked(revalidateTenant)

function makeSupabase(existing: unknown, upsertResult: { error: unknown } = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(upsertResult)
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select, upsert }))
  return { client: { from } as unknown as Awaited<ReturnType<typeof createClient>>, from, upsert }
}

beforeEach(() => {
  vi.clearAllMocks()
  mFlag.mockReturnValue(true)
  mRequire.mockResolvedValue({ id: 'u1', roleName: 'salon_admin', tenantId: 't1' } as never)
  mTenant.mockResolvedValue({ id: 't1', slug: 'demo', name: 'Demo' } as never)
  mMatrix.mockResolvedValue({} as never)
  mCanWrite.mockReturnValue(true)
  // Per-tenant gate (Task 3): the editor is platform-enabled per salon — seed the
  // flag ON for the default client so the save chain reaches the apply/upsert logic.
  mClient.mockResolvedValue(makeSupabase({ settings: { sajtbyggare_enabled: true }, branding: {} }).client)
})

describe('saveSiteContent — fences (refuse before any write)', () => {
  it('flag OFF → ok:false, never touches the DB', async () => {
    mFlag.mockReturnValue(false)
    const res = await saveSiteContent('salvia', [{ regionKey: 'hero.title', value: 'x' }])
    expect(res.ok).toBe(false)
    expect(mClient).not.toHaveBeenCalled()
  })
  it('unknown template → ok:false', async () => {
    const res = await saveSiteContent('nope', [{ regionKey: 'hero.title', value: 'x' }])
    expect(res.ok).toBe(false)
  })
  it('empty edits → ok:false', async () => {
    const res = await saveSiteContent('salvia', [])
    expect(res.ok).toBe(false)
  })
  it('no tenant on the account → ok:false', async () => {
    mTenant.mockResolvedValue(null)
    const res = await saveSiteContent('salvia', [{ regionKey: 'hero.title', value: 'x' }])
    expect(res.ok).toBe(false)
  })
  it('RBAC denies Branding write → ok:false, no upsert', async () => {
    const sb = makeSupabase({ settings: {}, branding: {} })
    mClient.mockResolvedValue(sb.client)
    mCanWrite.mockReturnValue(false)
    const res = await saveSiteContent('salvia', [{ regionKey: 'hero.title', value: 'x' }])
    expect(res.ok).toBe(false)
    expect(sb.upsert).not.toHaveBeenCalled()
  })

  it('per-tenant flag OFF (default) → ok:false, no upsert (env flag on, but salon not enabled)', async () => {
    const sb = makeSupabase({ settings: {}, branding: {} }) // no sajtbyggare_enabled → off
    mClient.mockResolvedValue(sb.client)
    const res = await saveSiteContent('salvia', [{ regionKey: 'hero.title', value: 'x' }])
    expect(res.ok).toBe(false)
    expect(sb.upsert).not.toHaveBeenCalled()
  })
})

describe('saveSiteContent — fail-closed sanitize', () => {
  it('an unsafe value (bad colour) rejects the save, writes NOTHING', async () => {
    const sb = makeSupabase({ settings: { sajtbyggare_enabled: true }, branding: {} })
    mClient.mockResolvedValue(sb.client)
    const res = await saveSiteContent('salvia', [{ regionKey: 'color.primary', value: 'red;}body{}' }])
    expect(res.ok).toBe(false)
    expect(sb.upsert).not.toHaveBeenCalled()
  })
})

describe('saveSiteContent — happy path (the real save chain)', () => {
  it('upserts the apply-core output (sanitized + merged) and revalidates → live without deploy', async () => {
    const sb = makeSupabase({
      settings: { sajtbyggare_enabled: true, copy: { heroLede: 'behåll' }, layout: 'wide' },
      branding: { color_bg: '#F6F4EE' },
    })
    mClient.mockResolvedValue(sb.client)

    const res = await saveSiteContent('salvia', [
      { regionKey: 'hero.title', value: 'Ny rubrik' },
      { regionKey: 'color.primary', value: '#000000' },
    ])

    expect(res.ok).toBe(true)
    expect(sb.upsert).toHaveBeenCalledTimes(1)
    const payload = sb.upsert.mock.calls[0]![0] as {
      tenant_id: string
      settings: { copy: Record<string, unknown>; layout: unknown }
      branding: Record<string, unknown>
    }
    expect(payload.tenant_id).toBe('t1')
    // written
    expect(payload.settings.copy.heroTitle).toBe('Ny rubrik')
    expect(payload.branding.color_primary).toBe('#000000')
    // preserved (region-granular merge — nothing else clobbered)
    expect(payload.settings.copy.heroLede).toBe('behåll')
    expect(payload.settings.layout).toBe('wide')
    expect(payload.branding.color_bg).toBe('#F6F4EE')
    // onConflict tenant_id
    expect(sb.upsert.mock.calls[0]![1]).toEqual({ onConflict: 'tenant_id' })
    // live without deploy = cache invalidated
    expect(mRevalTenant).toHaveBeenCalledWith('demo')
  })

  it('strips XSS from a TEXT value before persisting', async () => {
    const sb = makeSupabase({ settings: { sajtbyggare_enabled: true }, branding: {} })
    mClient.mockResolvedValue(sb.client)
    await saveSiteContent('salvia', [{ regionKey: 'about.copy', value: 'Hej<script>alert(1)</script>' }])
    const payload = sb.upsert.mock.calls[0]![0] as { settings: { copy: Record<string, string> } }
    expect(payload.settings.copy.aboutCopy).toContain('Hej')
    expect(payload.settings.copy.aboutCopy.toLowerCase()).not.toContain('<script')
  })

  it('a DB upsert error surfaces as ok:false (no false success)', async () => {
    const sb = makeSupabase({ settings: { sajtbyggare_enabled: true }, branding: {} }, { error: { message: 'boom' } })
    mClient.mockResolvedValue(sb.client)
    const res = await saveSiteContent('salvia', [{ regionKey: 'hero.title', value: 'x' }])
    expect(res.ok).toBe(false)
  })
})
