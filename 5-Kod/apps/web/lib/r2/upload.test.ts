import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { keyFromPublicUrl, removedImageKeys, pruneRemovedImages, deleteByPublicUrl } from './upload'
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
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: { BUCKET: { put: async () => {}, delete: deleteSpy } } }),
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

describe('removedImageKeys (pure)', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = BASE
  })
  afterEach(() => {
    delete process.env.R2_PUBLIC_BASE_URL
  })

  it('returns the old key when a slot is replaced', () => {
    expect(removedImageKeys([u('a/old.png')], [u('a/new.png')])).toEqual(['a/old.png'])
  })
  it('returns the key when a slot is cleared (new is null)', () => {
    expect(removedImageKeys([u('a/x.png')], [null])).toEqual(['a/x.png'])
  })
  it('returns nothing when the URL is kept', () => {
    expect(removedImageKeys([u('a/x.png')], [u('a/x.png')])).toEqual([])
  })
  it('drops only the gallery image that was removed', () => {
    expect(
      removedImageKeys([u('g/1.png'), u('g/2.png'), u('g/3.png')], [u('g/1.png'), u('g/3.png')]),
    ).toEqual(['g/2.png'])
  })
  it('never deletes a foreign URL', () => {
    expect(removedImageKeys(['https://evil.example/x.png'], [])).toEqual([])
  })
  it('de-duplicates repeated old URLs', () => {
    expect(removedImageKeys([u('a/x.png'), u('a/x.png')], [])).toEqual(['a/x.png'])
  })
})

describe('pruneRemovedImages / deleteByPublicUrl are best-effort (delete rejects)', () => {
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
    await expect(pruneRemovedImages([u('a/old.png')], [null])).resolves.toBeUndefined()
    expect(deleteSpy).toHaveBeenCalledWith('a/old.png')
    expect(warn).toHaveBeenCalledWith('r2.delete_failed', expect.objectContaining({ key: 'a/old.png' }))
  })
  it('makes no delete call when nothing was removed', async () => {
    await expect(pruneRemovedImages([u('a/x.png')], [u('a/x.png')])).resolves.toBeUndefined()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
  it('skips foreign URLs entirely (no delete attempted)', async () => {
    await expect(deleteByPublicUrl('https://evil.example/x.png')).resolves.toBeUndefined()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
