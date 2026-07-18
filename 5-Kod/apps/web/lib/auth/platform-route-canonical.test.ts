import { describe, expect, it } from 'vitest'
import {
  canonicalPlatformLegacyPath,
  canonicalPreviewPlatformLegacyUrl,
} from './platform-route-canonical'

describe('platform legacy-route canonicalization', () => {
  it.each([
    ['/salonger', '/kunder'],
    ['/salonger/ny', '/kunder/ny'],
    ['/salonger/tenant-id', '/kunder/tenant-id'],
  ])('maps %s to %s', (legacy, canonical) => {
    expect(canonicalPlatformLegacyPath(legacy)).toBe(canonical)
  })

  it.each(['/kunder', '/kunder/ny', '/slutkunder', '/salonger-arkiv', '/admin/salonger'])(
    'does not redirect canonical or segment-adjacent path %s',
    (path) => {
      expect(canonicalPlatformLegacyPath(path)).toBeNull()
    },
  )
})

describe('preview platform legacy-route canonicalization', () => {
  it('preserves nested path and query on the unified preview platform host', () => {
    const destination = canonicalPreviewPlatformLegacyUrl(
      new URL('http://booking.localhost:3000/salonger/tenant-id?tab=drift'),
      { preview: true, platform: true },
    )
    expect(destination?.toString()).toBe(
      'http://booking.localhost:3000/kunder/tenant-id?tab=drift',
    )
  })

  it.each([
    { preview: false, platform: true },
    { preview: true, platform: false },
  ])('does not canonicalize on the wrong host policy: %o', (host) => {
    expect(
      canonicalPreviewPlatformLegacyUrl(
        new URL('http://tenant.localhost:3000/salonger'),
        host,
      ),
    ).toBeNull()
  })
})
