import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logPlatformAction: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
  reportActionError: vi.fn(),
  sidaCtx: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('../guard', () => ({ sidaCtx: mocks.sidaCtx }))
vi.mock('../audit', () => ({ logPlatformAction: mocks.logPlatformAction }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenant: mocks.revalidateTenant }))
vi.mock('./observe', () => ({ reportActionError: mocks.reportActionError }))
vi.mock('@/components/storefront/vertical-copy', () => ({ getVerticalCopy: vi.fn(async () => ({})) }))

import { setTenantTheme } from './theme'

function formData() {
  const data = new FormData()
  data.set('tenantId', 'tenant-1')
  data.set('theme', 'kalla')
  data.set('copyMode', 'keep')
  return data
}

function supabaseClient(rpcResult: { data: unknown; error: unknown }) {
  const from = vi.fn((table: string) => {
    const result = table === 'tenants'
      ? { data: { slug: 'studio-norr', vertical_id: null }, error: null }
      : { data: { settings: { theme: 'siluett', copy: { heroTitle: 'Hej' }, keep: true } }, error: null }
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => result),
    }
    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    return builder
  })
  const rpc = vi.fn(async () => rpcResult)
  return { from, rpc }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.logPlatformAction.mockResolvedValue({ ok: true })
})

describe('setTenantTheme atomic boundary', () => {
  it('uses one atomic RPC instead of a separate draft check and settings upsert', async () => {
    const supabase = supabaseClient({ data: null, error: null })
    mocks.sidaCtx.mockResolvedValue({
      user: { id: 'root-1', platformAdmin: true },
      supabase,
      tenantId: 'tenant-1',
    })

    const result = await setTenantTheme({}, formData())

    expect(result.success).toBeTruthy()
    expect(supabase.rpc).toHaveBeenCalledWith('switch_tenant_theme', expect.objectContaining({
      p_copy: expect.objectContaining({ heroTitle: 'Hej' }),
      p_expected_settings: { theme: 'siluett', copy: { heroTitle: 'Hej' }, keep: true },
      p_expected_vertical: null,
      p_tenant: 'tenant-1',
      p_theme: 'kalla',
    }))
    expect(supabase.from).not.toHaveBeenCalledWith('site_revisions')
  })

  it('keeps the truthful draft error returned by the atomic RPC', async () => {
    const supabase = supabaseClient({
      data: null,
      error: { code: '55000', message: 'site_theme_draft_exists' },
    })
    mocks.sidaCtx.mockResolvedValue({
      user: { id: 'root-1', platformAdmin: true },
      supabase,
      tenantId: 'tenant-1',
    })

    const result = await setTenantTheme({}, formData())

    expect(result.error).toContain('opublicerat sidutkast')
    expect(mocks.revalidateTenant).not.toHaveBeenCalled()
    expect(mocks.logPlatformAction).not.toHaveBeenCalled()
    expect(mocks.reportActionError).not.toHaveBeenCalled()
  })

  it('returns a reloadable conflict without audit or revalidation on stale CAS input', async () => {
    const supabase = supabaseClient({
      data: null,
      error: { code: '40001', message: 'site_theme_settings_conflict' },
    })
    mocks.sidaCtx.mockResolvedValue({
      user: { id: 'root-1', platformAdmin: true },
      supabase,
      tenantId: 'tenant-1',
    })

    const result = await setTenantTheme({}, formData())

    expect(result.error).toContain('ändrades samtidigt')
    expect(mocks.revalidateTenant).not.toHaveBeenCalled()
    expect(mocks.logPlatformAction).not.toHaveBeenCalled()
    expect(mocks.reportActionError).not.toHaveBeenCalled()
  })

  it('reports only an unexpected atomic RPC failure', async () => {
    const supabase = supabaseClient({
      data: null,
      error: { code: '40001', message: 'could not serialize access due to concurrent update' },
    })
    mocks.sidaCtx.mockResolvedValue({
      user: { id: 'root-1', platformAdmin: true },
      supabase,
      tenantId: 'tenant-1',
    })

    const result = await setTenantTheme({}, formData())

    expect(result.error).toBeTruthy()
    expect(mocks.reportActionError).toHaveBeenCalledWith(
      'setTenantTheme.atomic',
      expect.objectContaining({ code: '40001' }),
      { tenantId: 'tenant-1' },
    )
    expect(mocks.revalidateTenant).not.toHaveBeenCalled()
    expect(mocks.logPlatformAction).not.toHaveBeenCalled()
  })
})
