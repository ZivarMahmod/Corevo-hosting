import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  uploadImageAtKey: vi.fn(),
  deleteR2Keys: vi.fn(),
  deleteByPublicUrl: vi.fn(),
  keyFromPublicUrl: vi.fn((value: string | null | undefined) => {
    const prefix = 'https://cdn.example.test/'
    return value?.startsWith(prefix) ? value.slice(prefix.length) || null : null
  }),
}))

vi.mock('@/lib/r2/upload', () => ({
  uploadImageAtKey: mocks.uploadImageAtKey,
  deleteR2Keys: mocks.deleteR2Keys,
  deleteByPublicUrl: mocks.deleteByPublicUrl,
  keyFromPublicUrl: mocks.keyFromPublicUrl,
}))

import {
  retainOwnedMediaUrls,
  retireManagedImages,
  uploadManagedImage,
} from './lifecycle'

const tenantId = '92920000-0000-0000-0000-000000000001'
const assetId = '92920000-0000-0000-0000-000000000101'
const key = `media/${tenantId}/${assetId}`
const url = `https://cdn.example.test/${key}`
const file = new File(['goal-92-image'], 'image.webp', { type: 'image/webp' })

function reservation(
  outcome = 'reserved',
  status = 'pending',
  existingUrl: string | null = null,
  published = existingUrl !== null,
) {
  return {
    asset_id: assetId,
    r2_key: key,
    status,
    published,
    url: existingUrl,
    variants: existingUrl
      ? { thumb: existingUrl, card: existingUrl, hero: existingUrl }
      : {},
    outcome,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.uploadImageAtKey.mockResolvedValue({ ok: true, key, url })
  mocks.deleteR2Keys.mockResolvedValue(true)
  mocks.deleteByPublicUrl.mockResolvedValue(undefined)
})

describe('uploadManagedImage', () => {
  it('uses reserve -> R2 -> finalize for the sajtbyggare sibling flow', async () => {
    const order: string[] = []
    const rpc = vi.fn(async (name: string) => {
      order.push(name)
      if (name === 'reserve_media_upload') {
        return { data: [reservation()], error: null }
      }
      if (name === 'finalize_media_upload') {
        return {
          data: [{
            asset_id: assetId,
            status: 'ready',
            url,
            variants: { thumb: url, card: url, hero: url },
            outcome: 'finalized',
          }],
          error: null,
        }
      }
      return { data: null, error: { message: `unexpected rpc ${name}` } }
    })
    mocks.uploadImageAtKey.mockImplementation(async () => {
      order.push('r2.put')
      return { ok: true, key, url }
    })

    const result = await uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'sajtbyggare',
    )

    expect(result).toEqual({ ok: true, assetId, key, url, duplicate: false })
    expect(order).toEqual(['reserve_media_upload', 'r2.put', 'finalize_media_upload'])
    expect(rpc).toHaveBeenNthCalledWith(1, 'reserve_media_upload', expect.objectContaining({
      p_tenant: tenantId,
      p_size_bytes: file.size,
      p_source: 'sajtbyggare',
      p_content_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'finalize_media_upload', {
      p_tenant: tenantId,
      p_asset: assetId,
      p_url: url,
      p_variants: { thumb: url, card: url, hero: url },
      p_published: false,
    })
  })

  it('returns a ready same-tenant duplicate without touching R2', async () => {
    const rpc = vi.fn(async () => ({
      data: [reservation('duplicate_ready', 'ready', url)],
      error: null,
    }))

    const result = await uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'upload',
    )

    expect(result).toEqual({ ok: true, assetId, key, url, duplicate: true })
    expect(mocks.uploadImageAtKey).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('keeps an unpublished ready duplicate private until a durable reference publishes it', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [reservation('duplicate_ready', 'ready', url, false)],
      error: null,
    })

    const result = await uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'upload',
    )

    expect(result).toEqual({ ok: true, assetId, key, url, duplicate: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(mocks.uploadImageAtKey).not.toHaveBeenCalled()
  })

  it('resumes an idempotent pending reservation at its deterministic key', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [reservation('duplicate_pending')],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          asset_id: assetId,
          status: 'ready',
          url,
          variants: { thumb: url, card: url, hero: url },
          outcome: 'finalized',
        }],
        error: null,
      })

    await expect(uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'upload',
    )).resolves.toEqual({ ok: true, assetId, key, url, duplicate: true })
    expect(mocks.uploadImageAtKey).toHaveBeenCalledWith(file, key)
  })

  it('queues cleanup when an R2 put may have succeeded before failing', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [reservation()], error: null })
      .mockResolvedValueOnce({
        data: [{ asset_id: assetId, status: 'delete_failed', outcome: 'cleanup_queued' }],
        error: null,
      })
    mocks.uploadImageAtKey.mockResolvedValue({ ok: false, reason: 'failed' })

    const result = await uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'upload',
    )

    expect(result).toEqual({ ok: false, reason: 'failed' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'cancel_media_upload', {
      p_tenant: tenantId,
      p_asset: assetId,
      p_error: 'r2_upload_failed',
      p_cleanup_required: true,
    })
  })

  it('retries idempotent finalize before treating a lost response as failure', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [reservation()], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'db unavailable' } })
      .mockResolvedValueOnce({
        data: [{
          asset_id: assetId,
          status: 'ready',
          url,
          variants: { thumb: url, card: url, hero: url },
          outcome: 'already_ready',
        }],
        error: null,
      })

    const result = await uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'upload',
    )

    expect(result).toEqual({ ok: true, assetId, key, url, duplicate: false })
    expect(rpc).toHaveBeenNthCalledWith(3, 'finalize_media_upload', {
      p_tenant: tenantId,
      p_asset: assetId,
      p_url: url,
      p_variants: { thumb: url, card: url, hero: url },
      p_published: false,
    })
    expect(mocks.deleteR2Keys).not.toHaveBeenCalled()
  })

  it('queues durable cleanup when both finalize attempts fail', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [reservation()], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'db unavailable' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'db still unavailable' } })
      .mockResolvedValueOnce({
        data: [{ asset_id: assetId, status: 'delete_failed', outcome: 'cleanup_queued' }],
        error: null,
      })

    const result = await uploadManagedImage(
      { rpc } as never,
      tenantId,
      file,
      'branding',
    )

    expect(result).toEqual({ ok: false, reason: 'database' })
    expect(rpc).toHaveBeenNthCalledWith(4, 'cancel_media_upload', expect.objectContaining({
      p_cleanup_required: true,
      p_error: 'media_finalize_failed',
    }))
    expect(mocks.deleteR2Keys).not.toHaveBeenCalled()
  })
})

describe('retireManagedImages', () => {
  function lookup(result: { data: { id: string } | null; error: unknown }) {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      neq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.neq.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    return query
  }

  it('queues lifecycle cleanup for a managed image and never deletes R2 directly', async () => {
    const query = lookup({ data: { id: assetId }, error: null })
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })

    await retireManagedImages(
      { from: vi.fn().mockReturnValue(query), rpc } as never,
      tenantId,
      [url, url, 'https://cdn.example.test/kept'],
      ['https://cdn.example.test/kept'],
    )

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('request_media_delete', {
      p_tenant: tenantId,
      p_asset: assetId,
    })
    expect(mocks.deleteByPublicUrl).not.toHaveBeenCalled()
  })

  it('uses the legacy best-effort delete only when no managed row exists', async () => {
    const query = lookup({ data: null, error: null })
    const legacyUrl = `https://cdn.example.test/tenants/${tenantId}/branding/legacy.webp`

    await retireManagedImages(
      { from: vi.fn().mockReturnValue(query), rpc: vi.fn() } as never,
      tenantId,
      [legacyUrl],
    )

    expect(mocks.deleteByPublicUrl).toHaveBeenCalledWith(legacyUrl)
  })

  it('never directly deletes a managed key hidden by tenant RLS or a foreign tenant key', async () => {
    const query = lookup({ data: null, error: null })
    const foreignTenantId = '92920000-0000-0000-0000-000000000002'
    const foreignManagedUrl =
      `https://cdn.example.test/media/${foreignTenantId}/92920000-0000-0000-0000-000000000202`

    await retireManagedImages(
      { from: vi.fn().mockReturnValue(query), rpc: vi.fn() } as never,
      tenantId,
      [url, foreignManagedUrl],
    )

    expect(mocks.deleteByPublicUrl).not.toHaveBeenCalled()
  })

  it('preserves bytes when the managed lookup is inconclusive', async () => {
    const query = lookup({ data: null, error: { code: '08006' } })

    await retireManagedImages(
      { from: vi.fn().mockReturnValue(query), rpc: vi.fn() } as never,
      tenantId,
      [url],
    )

    expect(mocks.deleteByPublicUrl).not.toHaveBeenCalled()
  })
})

describe('retainOwnedMediaUrls', () => {
  it('keeps only URLs already stored for the tenant and de-duplicates them within the cap', () => {
    const ownedA = 'https://cdn.example.test/media/tenant-a/asset-a'
    const ownedB = 'https://cdn.example.test/media/tenant-a/asset-b'
    const foreign = 'https://cdn.example.test/media/tenant-b/asset-x'

    expect(retainOwnedMediaUrls(
      [foreign, ownedA, ownedA, ownedB],
      [ownedA, ownedB],
      2,
    )).toEqual([ownedA, ownedB])
  })
})
