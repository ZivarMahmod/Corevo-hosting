import { describe, expect, it, vi } from 'vitest'

async function loadRuntime() {
  return import('./motiontest-worker-runtime.mjs').catch(() => null)
}

describe('motiontest Worker outer boundary', () => {
  it('exposes a fetch-only Worker factory without a scheduler', async () => {
    const runtime = await loadRuntime()
    if (!runtime?.createMotiontestWorker) {
      expect(typeof runtime?.createMotiontestWorker).toBe('function')
      return
    }

    const worker = runtime.createMotiontestWorker({ fetch: vi.fn() })
    expect(Object.keys(worker)).toEqual(['fetch'])
  })

  it('delegates exact read-only public requests to OpenNext', async () => {
    const runtime = await loadRuntime()
    if (!runtime?.createMotiontestWorker) {
      expect(typeof runtime?.createMotiontestWorker).toBe('function')
      return
    }

    const fetch = vi.fn(async () => new Response('delegated', { status: 200 }))
    const worker = runtime.createMotiontestWorker({ fetch })
    const family = 'entrance-v1-a1b2c3d4e5f6'

    for (const request of [
      new Request('https://motiontest.corevo.se/'),
      new Request('http://motiontest.localhost:3000/'),
      new Request('https://motiontest.localhost:3000/robots.txt', { method: 'HEAD' }),
      new Request('https://motiontest.corevo.se/_next/static/chunks/app.js'),
      new Request('https://motiontest.corevo.se/images/freshcut/freshcut-hero.webp'),
      new Request(
        `https://motiontest.corevo.se/media/freshcut-motion/${family}/${family}-desktop.webm`,
      ),
      new Request(
        `https://motiontest.corevo.se/media/freshcut-motion/${family}/${family}-desktop-poster.webp`,
      ),
      new Request(
        `https://motiontest.corevo.se/media/freshcut-motion/${family}/${family}-mobile-poster.webp`,
      ),
      new Request(
        'https://motiontest.corevo.se/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75',
      ),
    ]) {
      const response = await worker.fetch(request, { binding: 'test' }, {})
      expect(response.status).toBe(200)
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
      await expect(response.text()).resolves.toBe('delegated')
    }
    expect(fetch).toHaveBeenCalledTimes(9)
  })

  it('makes every motiontest write impossible before OpenNext or ASSETS', async () => {
    const runtime = await loadRuntime()
    if (!runtime?.createMotiontestWorker) {
      expect(typeof runtime?.createMotiontestWorker).toBe('function')
      return
    }

    const fetch = vi.fn()
    const worker = runtime.createMotiontestWorker({ fetch })
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await worker.fetch(
        new Request('https://motiontest.corevo.se/', { method }),
        {},
        {},
      )
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow'), method).toBe('GET, HEAD')
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('denies foreign authorities and forbidden assets before delegation', async () => {
    const runtime = await loadRuntime()
    if (!runtime?.createMotiontestWorker) {
      expect(typeof runtime?.createMotiontestWorker).toBe('function')
      return
    }

    const fetch = vi.fn()
    const worker = runtime.createMotiontestWorker({ fetch })
    const requests = [
      new Request('http://motiontest.corevo.se/'),
      new Request('https://freshcut.corevo.se/'),
      new Request('https://motiontest.corevo.se:444/'),
      new Request('https://motiontest.corevo.se/', {
        headers: { host: 'motiontest.corevo.se:443' },
      }),
      new Request('https://motiontest.corevo.se/admin'),
      new Request('https://motiontest.corevo.se/api/auth/session'),
      new Request('https://motiontest.corevo.se/manifest.webmanifest'),
      new Request('https://motiontest.corevo.se/images/other-tenant/image.webp'),
      new Request(
        'https://motiontest.corevo.se/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6/entrance-v1-a1b2c3d4e5f6-manifest.json',
      ),
      new Request(
        'https://motiontest.corevo.se/_next/image?url=https%3A%2F%2Fattacker.test%2Fimage.webp&w=1200&q=75',
      ),
    ]
    for (const request of requests) {
      const response = await worker.fetch(request, {}, {})
      expect(response.status, request.url).toBe(404)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('denies decoded path controls in static paths and image sources', async () => {
    const boundary = await import('./motiontest-request-boundary.mjs').catch(() => null)
    if (!boundary?.isMotiontestPublicPath) {
      expect(boundary?.isMotiontestPublicPath).toBeTypeOf('function')
      return
    }

    for (const pathname of [
      '/_next/static/chunks/app%00.js',
      '/_next/static/chunks/app%1F.js',
      '/_next/static/chunks/app%7F.js',
      '/images/freshcut/hero%C2%85.webp',
      '/images/freshcut/hero%E2%80%AE.webp',
      '/images/freshcut/hero%E2%80%A8.webp',
    ]) {
      expect(boundary.isMotiontestPublicPath(pathname), pathname).toBe(false)
    }

    for (const source of [
      '/images/freshcut/hero\u0000.webp',
      '/images/freshcut/hero\u007f.webp',
      '/images/freshcut/hero\u0085.webp',
      '/images/freshcut/hero\u202e.webp',
    ]) {
      const search = new URLSearchParams({ q: '75', url: source, w: '1200' })
      expect(boundary.isMotiontestPublicPath('/_next/image', search), source).toBe(false)
    }
  })
})
