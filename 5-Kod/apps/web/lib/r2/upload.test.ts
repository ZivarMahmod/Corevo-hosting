import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  deleteByPublicUrl,
  deleteR2Keys,
  keyFromPublicUrl,
  uploadErrorMessage,
  uploadImageAtKey,
} from './upload'
import { logger } from '@/lib/observability'

// FX-14 "replace, don't accumulate". publicBase() reads R2_PUBLIC_BASE_URL at CALL
// time, so each test sets/restores it explicitly and never relies on ambient env.
const BASE = 'https://pub-test.r2.dev'
const u = (p: string) => `${BASE}/${p}`

// getBucket() dynamically imports @opennextjs/cloudflare. Mock it to a bucket whose
// delete() REJECTS, so we can prove the prune path is best-effort: it logs and never
// throws (the "a failed cleanup must never block a save" contract).
const deleteSpy = vi.fn(async () => {
  throw new Error('r2 boom')
})
const putSpy = vi.fn(async () => {})
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: { BUCKET: { put: putSpy, delete: deleteSpy } } }),
}))

describe('keyFromPublicUrl', () => {
  let saved: string | undefined
  beforeEach(() => {
    saved = process.env.R2_PUBLIC_BASE_URL
    process.env.R2_PUBLIC_BASE_URL = BASE
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.R2_PUBLIC_BASE_URL
    else process.env.R2_PUBLIC_BASE_URL = saved
  })

  it('is the strict inverse of an uploaded URL', () => {
    expect(keyFromPublicUrl(u('tenants/abc/branding/u.png'))).toBe('tenants/abc/branding/u.png')
  })
  it('normalizes a trailing slash on the base (same key)', () => {
    process.env.R2_PUBLIC_BASE_URL = `${BASE}/`
    expect(keyFromPublicUrl(u('tenants/x/logo.png'))).toBe('tenants/x/logo.png')
  })
  it('returns null for a foreign / non-bucket URL (never deletes what we do not own)', () => {
    expect(keyFromPublicUrl('https://evil.example/x.png')).toBeNull()
  })
  it('returns null for relative / blank / null', () => {
    expect(keyFromPublicUrl('/uploads/x.png')).toBeNull()
    expect(keyFromPublicUrl('')).toBeNull()
    expect(keyFromPublicUrl(null)).toBeNull()
  })
  it('returns null for the bare base with no key', () => {
    expect(keyFromPublicUrl(`${BASE}/`)).toBeNull()
  })
  it('returns null when R2_PUBLIC_BASE_URL is unset', () => {
    delete process.env.R2_PUBLIC_BASE_URL
    expect(keyFromPublicUrl(u('x.png'))).toBeNull()
  })
})

describe('deleteByPublicUrl is best-effort', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = BASE
    deleteSpy.mockClear()
  })
  afterEach(() => {
    delete process.env.R2_PUBLIC_BASE_URL
    vi.restoreAllMocks()
  })

  it('attempts the delete, logs, and does NOT throw when bucket.delete rejects', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    await expect(deleteByPublicUrl(u('a/old.png'))).resolves.toBeUndefined()
    expect(deleteSpy).toHaveBeenCalledWith('a/old.png')
    expect(warn).toHaveBeenCalledWith('r2.delete_failed', expect.objectContaining({ key: 'a/old.png' }))
  })
  it('skips foreign URLs entirely (no delete attempted)', async () => {
    await expect(deleteByPublicUrl('https://evil.example/x.png')).resolves.toBeUndefined()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})

describe('lifecycle-aware R2 primitives', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = BASE
    putSpy.mockClear()
    deleteSpy.mockClear()
  })
  afterEach(() => {
    delete process.env.R2_PUBLIC_BASE_URL
    vi.restoreAllMocks()
  })

  it('uploads to the exact key reserved by Postgres', async () => {
    const file = new File(['image'], 'image.webp', { type: 'image/webp' })

    await expect(uploadImageAtKey(file, 'media/tenant-1/asset-1')).resolves.toEqual({
      ok: true,
      key: 'media/tenant-1/asset-1',
      url: `${BASE}/media/tenant-1/asset-1`,
    })
    expect(putSpy).toHaveBeenCalledWith(
      'media/tenant-1/asset-1',
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: 'image/webp' } },
    )
  })

  it('rejects SVG before any bucket write', async () => {
    const file = new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })

    await expect(uploadImageAtKey(file, 'media/tenant-1/asset-1')).resolves.toEqual({
      ok: false,
      reason: 'bad_type',
    })
    expect(putSpy).not.toHaveBeenCalled()
    expect(uploadErrorMessage('bad_type')).toBe('Bilden måste vara PNG, JPG, WEBP eller GIF.')
  })

  it('reports a failed delete so the DB job can be retried', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})

    await expect(deleteR2Keys(['media/tenant-1/asset-1'])).resolves.toBe(false)
  })
})
