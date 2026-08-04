import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  siteRevisionCtx: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenantById: vi.fn(),
  audit: vi.fn(async () => {}),
  uploadManagedImage: vi.fn(),
  geocodeAddress: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../guard', () => ({ siteRevisionCtx: mocks.siteRevisionCtx }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenantById: mocks.revalidateTenantById }))
vi.mock('../audit', () => ({ logPlatformAction: mocks.audit }))
vi.mock('./observe', () => ({ reportActionError: vi.fn(async () => {}) }))
vi.mock('@/lib/media/lifecycle', () => ({
  uploadManagedImage: mocks.uploadManagedImage,
  managedUploadErrorMessage: () => 'Uppladdningen misslyckades.',
}))
vi.mock('./geocode', () => ({ geocodeAddress: mocks.geocodeAddress }))

import { publishSiteDraft, saveSiteDraft, uploadSiteDraftImage } from './site-revisions'

const snapshot = {
  tenant: { name: 'Studio Norr' },
  settings: {
    copy: {},
    theme: 'onyx',
    contact: { email: null, phone: null },
    social: { instagram: null, facebook: null, tiktok: null },
    map: null,
    opening_hours: null,
    seo: { title: null, description: null },
    booking: { variant: 'wizard', pickerMode: 'calendar', staffAvatars: 'initialer' },
  },
  branding: {},
  location: { address: null },
} as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({
    data: [{ revision_id: 'revision-1', lock_version: 2, snapshot }],
    error: null,
  })
  mocks.uploadManagedImage.mockResolvedValue({
    ok: true,
    assetId: 'asset-1',
    url: 'https://cdn.test/crop.webp',
    key: 'media/tenant-session/asset-1',
    duplicate: false,
  })
  mocks.geocodeAddress.mockResolvedValue({ lat: 58.4108, lon: 15.6214 })
  mocks.from.mockImplementation((table: string) => {
    const result = table === 'site_revisions'
      ? { data: null, error: null }
      : { data: { address: 'Gamla gatan 1' }, error: null }
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(async () => result),
    }
    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    return builder
  })
  mocks.siteRevisionCtx.mockResolvedValue({
    user: { id: 'actor-1' },
    tenantId: 'tenant-session',
    supabase: { rpc: mocks.rpc, from: mocks.from },
  })
})

describe('site revision server actions', () => {
  it('saves through the forced tenant without busting the public cache', async () => {
    const result = await saveSiteDraft({
      tenantId: 'tenant-attacker',
      snapshot: {
        ...snapshot,
        poison: 'root',
        settings: {
          ...snapshot.settings,
          poison: 'settings',
          copy: { heroTitle: 'Hej', poison: 'copy' },
          booking: { ...snapshot.settings.booking, poison: 'booking' },
        },
        branding: { team: [{ name: 'Injected' }], poison: 'branding' },
      } as never,
      expectedLockVersion: 1,
    })

    expect(result).toMatchObject({ revisionId: 'revision-1', lockVersion: 2 })
    expect(mocks.rpc).toHaveBeenCalledWith('save_site_draft', expect.objectContaining({
      p_tenant: 'tenant-session', p_expected_lock_version: 1,
    }))
    const rpcSnapshot = mocks.rpc.mock.calls[0]?.[1]?.p_snapshot
    expect(JSON.stringify(rpcSnapshot)).not.toMatch(/poison|Injected/)
    expect(mocks.revalidateTenantById).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/sida')
  })

  it('maps a stale-theme draft rejection to the shared revision conflict state', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '40001', message: 'site_revision_theme_conflict' },
    })

    const result = await saveSiteDraft({
      tenantId: 'tenant-1',
      snapshot,
    })

    expect(result).toEqual({
      error: 'Utkastet har ändrats i en annan session. Ladda om och försök igen.',
      conflict: true,
    })
  })

  it('rejects a malformed client snapshot before the RPC', async () => {
    const result = await saveSiteDraft({
      tenantId: 'tenant-1', snapshot: { tenant: {}, settings: [] } as never,
    })
    expect(result.error).toBeTruthy()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects dangerous branding types before the RPC', async () => {
    const result = await saveSiteDraft({
      tenantId: 'tenant-1',
      snapshot: { ...snapshot, branding: { color_accent: { poison: true } } } as never,
    })
    expect(result.error).toBeTruthy()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns the resolved geocoded snapshot without mutating live rows before publish', async () => {
    const result = await saveSiteDraft({
      tenantId: 'tenant-1',
      snapshot: {
        ...snapshot,
        settings: { ...snapshot.settings, map: { lat: 59.33, lon: 18.06 } },
        location: { address: 'Nya gatan 2' },
      },
    })

    expect(mocks.geocodeAddress).toHaveBeenCalledWith('Nya gatan 2')
    expect(mocks.rpc).toHaveBeenCalledWith('save_site_draft', expect.objectContaining({
      p_snapshot: expect.objectContaining({
        settings: expect.objectContaining({ map: { lat: 58.4108, lon: 15.6214, q: 'Nya gatan 2' } }),
        location: { address: 'Nya gatan 2' },
      }),
    }))
    expect(mocks.from).toHaveBeenCalledWith('site_revisions')
    expect(mocks.from).toHaveBeenCalledWith('locations')
    expect(result.snapshot?.settings.map).toEqual({ lat: 58.4108, lon: 15.6214, q: 'Nya gatan 2' })
  })

  it('restores the published map when a draft address changes back to the live address', async () => {
    mocks.from.mockImplementation((table: string) => {
      const result = table === 'site_revisions'
        ? {
            data: {
              snapshot: {
                ...snapshot,
                settings: { ...snapshot.settings, map: { lat: 58.4108, lon: 15.6214, q: 'Utkastgatan 2' } },
                location: { address: 'Utkastgatan 2' },
              },
            },
            error: null,
          }
        : table === 'locations'
          ? { data: { address: 'Livegatan 1' }, error: null }
          : { data: { settings: { map: { lat: 59.3293, lon: 18.0686, q: 'Livegatan 1' } } }, error: null }
      const builder = {
        select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => result),
      }
      builder.select.mockReturnValue(builder)
      builder.eq.mockReturnValue(builder)
      builder.limit.mockReturnValue(builder)
      return builder
    })

    await saveSiteDraft({
      tenantId: 'tenant-1',
      snapshot: {
        ...snapshot,
        settings: { ...snapshot.settings, map: { lat: 58.4108, lon: 15.6214, q: 'Utkastgatan 2' } },
        location: { address: 'Livegatan 1' },
      },
    })

    expect(mocks.rpc).toHaveBeenCalledWith('save_site_draft', expect.objectContaining({
      p_snapshot: expect.objectContaining({
        settings: expect.objectContaining({ map: { lat: 59.3293, lon: 18.0686, q: 'Livegatan 1' } }),
        location: { address: 'Livegatan 1' },
      }),
    }))
    expect(mocks.geocodeAddress).not.toHaveBeenCalled()
  })

  it('publishes and only then busts the public tenant cache', async () => {
    const result = await publishSiteDraft({ tenantId: 'tenant-1', expectedLockVersion: 1 })

    expect(result).toMatchObject({ revisionId: 'revision-1', lockVersion: 2, snapshot })
    expect(mocks.rpc).toHaveBeenCalledWith('publish_site_draft', {
      p_tenant: 'tenant-session', p_expected_lock_version: 1,
    })
    expect(mocks.revalidateTenantById).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }), 'tenant-session',
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/sida')
  })

  it('refuses to publish a restored draft from another storefront theme', async () => {
    mocks.from.mockImplementation((table: string) => {
      const result = table === 'site_revisions'
        ? {
            data: {
              snapshot: {
                ...snapshot,
                settings: { ...snapshot.settings, theme: 'leander' },
              },
            },
            error: null,
          }
        : table === 'tenant_settings'
          ? { data: { settings: { theme: 'snitt' } }, error: null }
          : { data: null, error: null }
      const builder = {
        select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => result),
      }
      builder.select.mockReturnValue(builder)
      builder.eq.mockReturnValue(builder)
      builder.limit.mockReturnValue(builder)
      return builder
    })

    const result = await publishSiteDraft({ tenantId: 'tenant-1', expectedLockVersion: 1 })

    expect(result.error).toMatch(/annan mall/i)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidateTenantById).not.toHaveBeenCalled()
  })

  it('routes a cropped draft image through the shared reserved media lifecycle', async () => {
    const image = new File(['cropped'], 'crop.webp', { type: 'image/webp' })
    const form = new FormData()
    form.set('tenantId', 'tenant-attacker')
    form.set('image', image)

    const result = await uploadSiteDraftImage(form)

    expect(result).toMatchObject({ url: 'https://cdn.test/crop.webp' })
    expect(mocks.uploadManagedImage).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }),
      'tenant-session',
      image,
      'sajtbyggare',
    )
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.revalidateTenantById).not.toHaveBeenCalled()
  })
})
