import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'

async function loadVerifier() {
  return import('./verify-motiontest-release.mjs').catch(() => null)
}

function response(body, { status = 200, contentType = 'text/html', headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType, ...headers },
  })
}

const MOTIONTEST_ORIGIN = 'https://motiontest.corevo.se'
const LIVE_ORIGIN = 'https://freshcut.corevo.se'
const LIVE_BOOKING_URL = 'https://www.bokadirekt.se/'
const MOTIONTEST_STATIC_URL = `${MOTIONTEST_ORIGIN}/_next/static/chunks/motiontest-app.js`
const MOTIONTEST_IMAGE_URL = `${MOTIONTEST_ORIGIN}/images/freshcut/freshcut-hero.webp`
const MOTIONTEST_OPTIMIZED_IMAGE_URL = `${MOTIONTEST_ORIGIN}/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75`
const PROPAGATION_PENDING_CODE = 'MOTIONTEST_PROPAGATION_PENDING'
const CORRUPT_WEBP_PREFIX = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
])
const VALID_TINY_WEBP_BYTES = Uint8Array.from(
  Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQkUZ0pv+BiOh/AAA=', 'base64'),
)

const SAFE_NEGATIVE_URLS = [
  `${MOTIONTEST_ORIGIN}/admin`,
  `${MOTIONTEST_ORIGIN}/api/auth/session`,
  `${MOTIONTEST_ORIGIN}/manifest.webmanifest`,
  `${MOTIONTEST_ORIGIN}/_next/static/chunks/app%00.js`,
  `${MOTIONTEST_ORIGIN}/_next/static/chunks/app%2500.js`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=https%3A%2F%2Fattacker.example%2Fimage.webp&w=1200&q=75`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=%2F%2Fattacker.example%2Fimage.webp&w=1200&q=75`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=https%253A%252F%252Fattacker.example%252Fimage.webp&w=1200&q=75`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75&fit=cover`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&url=%2Fimages%2Ffreshcut%2Ffreshcut-2.webp&w=1200&q=75`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&w=600&q=75`,
  `${MOTIONTEST_ORIGIN}/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75&q=50`,
]

const VERIFIED_SERVICES = [
  ['Herrklippning', '369 kr'],
  ['Herrklippning Student', '329 kr'],
  ['Herrklippning, långt skägg, varm handduk', '459 kr'],
]

function verifiedServiceMarkup() {
  return VERIFIED_SERVICES.map(
    ([name, price], index) => `
      <article data-service-id="service-${index + 1}" data-provenance="verified">
        <a href="${LIVE_BOOKING_URL}" aria-label="Boka ${name}, 30 min">
          <span>${name}</span><span>30 min</span><strong>${price}</strong>
        </a>
      </article>`,
  ).join('')
}

function motiontestHtml(overrides = {}) {
  const { bookingUrl = LIVE_BOOKING_URL, services = verifiedServiceMarkup() } = overrides
  return `<!doctype html>
    <html>
      <head>
        <meta name="robots" content="noindex, nofollow">
        <script src="/_next/static/chunks/motiontest-app.js"></script>
      </head>
      <body>
        <main data-storefront-experience="freshcut-motiontest" data-motion-scene="hero">
          <a href="${bookingUrl}">Boka tid</a>
          ${services}
        </main>
      </body>
    </html>`
}

function liveHtml({
  bookingUrl = LIVE_BOOKING_URL,
  serviceLabel = 'Boka Herrklippning, 30 min',
  staticReferences = [
    '/_next/static/css/live.css?v=one',
    'https://freshcut.corevo.se/_next/static/chunks/live-app.js?build=one',
  ],
  extraAttributes = '',
} = {}) {
  const staticMarkup = staticReferences
    .map((reference, index) =>
      index % 2 === 0
        ? `<link rel="stylesheet" href="${reference}">`
        : `<script src="${reference}"></script>`,
    )
    .join('')
  return `<!doctype html>
    <html>
      <head>
        <link rel="canonical" href="https://freshcut.corevo.se/">
        ${staticMarkup}
      </head>
      <body>
        <main data-world="storefront" data-theme="freshcut" ${extraAttributes}>
          <a href="${bookingUrl}" aria-label="${serviceLabel}">Boka tid</a>
        </main>
      </body>
    </html>`
}

const LIVE_ROBOTS = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nDisallow: /konto\n'

function successfulFetch({
  motionHtml = motiontestHtml(),
  liveMarkup = liveHtml(),
  liveRobots = LIVE_ROBOTS,
  motionStatus = 200,
  staticBody = 'self.__next_f = self.__next_f || [];\n',
  staticContentType = 'application/javascript',
  staticStatus = 200,
  imageBody = VALID_TINY_WEBP_BYTES,
  imageContentType = 'image/webp',
  imageStatus = 200,
  optimizedImageBody = VALID_TINY_WEBP_BYTES,
  optimizedImageContentType = 'image/webp',
  optimizedImageStatus = 200,
} = {}) {
  return vi.fn(async (input, init = {}) => {
    const url = String(input)
    const method = init.method ?? 'GET'
    if (url === `${MOTIONTEST_ORIGIN}/` && method === 'OPTIONS') {
      return response('', { status: 405, headers: { allow: 'GET, HEAD' } })
    }
    if (url === `${MOTIONTEST_ORIGIN}/` && method === 'HEAD') return response('')
    if (url === `${MOTIONTEST_ORIGIN}/`) return response(motionHtml, { status: motionStatus })
    if (url === `${MOTIONTEST_ORIGIN}/robots.txt`) {
      return response('User-agent: *\nDisallow: /\n', { contentType: 'text/plain' })
    }
    if (url === MOTIONTEST_STATIC_URL) {
      return response(method === 'HEAD' ? '' : staticBody, {
        status: staticStatus,
        contentType: staticContentType,
      })
    }
    if (url === MOTIONTEST_IMAGE_URL) {
      return response(method === 'HEAD' ? '' : imageBody, {
        status: imageStatus,
        contentType: imageContentType,
      })
    }
    if (url === MOTIONTEST_OPTIMIZED_IMAGE_URL) {
      return response(method === 'HEAD' ? '' : optimizedImageBody, {
        status: optimizedImageStatus,
        contentType: optimizedImageContentType,
      })
    }
    if (SAFE_NEGATIVE_URLS.includes(url)) return response('not found', { status: 404 })
    if (url === `${LIVE_ORIGIN}/`) return response(liveMarkup)
    if (url === `${LIVE_ORIGIN}/robots.txt`) {
      return response(liveRobots, { contentType: 'text/plain' })
    }
    return response('not found', { status: 404 })
  })
}

async function captureBaseline(verifier, options = {}) {
  return verifier.verifyLiveFreshCutBaseline({
    fetchImpl: successfulFetch(options),
    log() {},
  })
}

describe('post-deploy motiontest verification', () => {
  it('exposes fixed-origin baseline and full read-only verifiers', async () => {
    const verifier = await loadVerifier()
    expect(typeof verifier?.verifyLiveFreshCutBaseline).toBe('function')
    expect(typeof verifier?.verifyMotiontestRelease).toBe('function')
  })

  it('captures a stable live fingerprint while named bots may disallow root', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyLiveFreshCutBaseline) {
      expect(verifier?.verifyLiveFreshCutBaseline).toBeTypeOf('function')
      return
    }
    const fetchImpl = successfulFetch()

    await expect(verifier.verifyLiveFreshCutBaseline({ fetchImpl, log() {} })).resolves.toEqual({
      liveFreshCutIsolated: true,
      fingerprint: {
        canonicalUrl: 'https://freshcut.corevo.se/',
        ordinaryMarkers: { dataTheme: 'freshcut', dataWorld: 'storefront' },
        staticAssetPaths: ['/_next/static/chunks/live-app.js', '/_next/static/css/live.css'],
        bookingDestinations: [LIVE_BOOKING_URL],
        serviceBookingLabels: ['Boka Herrklippning, 30 min'],
        robots: { allow: ['/'], disallow: ['/konto'], sitemaps: [] },
      },
      fingerprintSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      `${LIVE_ORIGIN}/`,
      `${LIVE_ORIGIN}/robots.txt`,
    ])
  })

  it('accepts the real canonical Bokadirekt root and rejects non-canonical origins or credentials', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyLiveFreshCutBaseline) {
      expect(verifier?.verifyLiveFreshCutBaseline).toBeTypeOf('function')
      return
    }

    for (const bookingUrl of [
      'http://www.bokadirekt.se/',
      'https://user:password@www.bokadirekt.se/',
      'https://bokadirekt.se/',
      'https://www.bokadirekt.se.evil.example/',
      'https://www.bokadirekt.se:444/',
    ]) {
      await expect(
        captureBaseline(verifier, { liveMarkup: liveHtml({ bookingUrl }) }),
      ).rejects.toThrow(/real Bokadirekt booking href/i)
    }
  })

  it('requires motiontest to match the exact Bokadirekt root or path captured from live', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const pathBookingUrl = 'https://www.bokadirekt.se/places/freshcut-123'
    const liveMarkup = liveHtml({ bookingUrl: pathBookingUrl })
    const liveBaseline = await captureBaseline(verifier, { liveMarkup })

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ liveMarkup }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/booking destination must match/i)

    const matchingMotionMarkup = motiontestHtml({
      bookingUrl: pathBookingUrl,
      services: verifiedServiceMarkup().replaceAll(LIVE_BOOKING_URL, pathBookingUrl),
    })
    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ liveMarkup, motionHtml: matchingMotionMarkup }),
        liveBaseline,
        log() {},
      }),
    ).resolves.toMatchObject({ motiontestVerified: true })
  })

  it('rejects a wildcard root disallow even when a named group allows it', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyLiveFreshCutBaseline) {
      expect(verifier?.verifyLiveFreshCutBaseline).toBeTypeOf('function')
      return
    }
    const fetchImpl = successfulFetch({
      liveRobots: 'User-agent: FriendlyBot\nAllow: /\n\nUser-agent: *\nAllow: /\nDisallow: /\n',
    })

    await expect(verifier.verifyLiveFreshCutBaseline({ fetchImpl, log() {} })).rejects.toThrow(
      /live FreshCut robots.*disallow/i,
    )
  })

  it.each([
    ['root is not deployed yet', { motionStatus: 404 }],
    [
      'an old public document has no motiontest marker',
      {
        motionHtml: motiontestHtml().replace(
          'data-storefront-experience="freshcut-motiontest"',
          'data-storefront-experience="freshcut-old"',
        ),
      },
    ],
    ['the selected static asset has not propagated', { staticStatus: 404 }],
  ])('marks only transient propagation when $0', async (_label, fetchOptions) => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const error = await verifier
      .verifyMotiontestRelease({
        fetchImpl: successfulFetch(fetchOptions),
        liveBaseline,
        log() {},
      })
      .catch((caught) => caught)

    expect(error).toMatchObject({ code: PROPAGATION_PENDING_CODE })
  })

  it('marks a motiontest root network failure as transient propagation', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const delegate = successfulFetch()
    const fetchImpl = vi.fn(async (input, init) => {
      if (String(input) === `${MOTIONTEST_ORIGIN}/`) throw new TypeError('network unavailable')
      return delegate(input, init)
    })
    const error = await verifier
      .verifyMotiontestRelease({ fetchImpl, liveBaseline, log() {} })
      .catch((caught) => caught)

    expect(error).toMatchObject({ code: PROPAGATION_PENDING_CODE })
  })

  it('verifies exact boundary statuses, approved assets, services, and an unchanged live baseline', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const fetchImpl = successfulFetch()

    await expect(
      verifier.verifyMotiontestRelease({ fetchImpl, liveBaseline, log() {} }),
    ).resolves.toMatchObject({
      motiontestVerified: true,
      liveFreshCutIsolated: true,
      safeBoundaryVerified: true,
      liveFingerprintSha256: liveBaseline.fingerprintSha256,
    })

    expect(fetchImpl.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual(
      [
        [`${MOTIONTEST_ORIGIN}/`, 'GET'],
        [`${MOTIONTEST_ORIGIN}/robots.txt`, 'GET'],
        [MOTIONTEST_STATIC_URL, 'GET'],
        [MOTIONTEST_STATIC_URL, 'HEAD'],
        [MOTIONTEST_IMAGE_URL, 'GET'],
        [MOTIONTEST_IMAGE_URL, 'HEAD'],
        [MOTIONTEST_OPTIMIZED_IMAGE_URL, 'GET'],
        [MOTIONTEST_OPTIMIZED_IMAGE_URL, 'HEAD'],
        ...SAFE_NEGATIVE_URLS.map((url) => [url, 'GET']),
        [`${MOTIONTEST_ORIGIN}/`, 'OPTIONS'],
        [`${MOTIONTEST_ORIGIN}/`, 'HEAD'],
        [`${LIVE_ORIGIN}/`, 'GET'],
        [`${LIVE_ORIGIN}/robots.txt`, 'GET'],
      ],
    )
    const signals = fetchImpl.mock.calls.map(([, init]) => init?.signal)
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
    expect(new Set(signals).size).toBe(signals.length)
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init).toMatchObject({ redirect: 'error' })
      expect(init?.headers ?? {}).not.toHaveProperty('authorization')
    }
  })

  it('requires a parsed robots meta element, not matching text inside a script', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const invalidHtml =
      '<script type="application/json"><meta name="robots" content="noindex,nofollow"></script>' +
      '<script src="/_next/static/chunks/motiontest-app.js"></script>' +
      '<main data-storefront-experience="freshcut-motiontest" data-motion-scene="hero"></main>'

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ motionHtml: invalidHtml }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/noindex.*nofollow|robots meta/i)
  })

  it('fails if a negative probe becomes public or an approved asset is unavailable', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)

    const leakedRoute = successfulFetch()
    const delegateLeaked = successfulFetch()
    leakedRoute.mockImplementation(async (input, init) => {
      if (String(input) === `${MOTIONTEST_ORIGIN}/admin`) return response('admin')
      return delegateLeaked(input, init)
    })
    const leakedError = await verifier
      .verifyMotiontestRelease({ fetchImpl: leakedRoute, liveBaseline, log() {} })
      .catch((caught) => caught)
    expect(leakedError.message).toMatch(/negative probe|forbidden.*public|admin/i)
    expect(leakedError.code).toBeUndefined()

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ staticStatus: 404 }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/static asset.*404/i)

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ imageStatus: 404 }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/FreshCut image.*404/i)
  })

  it.each([
    {
      expected: /static asset.*non-empty/i,
      label: 'empty static body',
      options: { staticBody: '' },
    },
    {
      expected: /static asset.*content-type.*javascript/i,
      label: 'wrong static content type',
      options: { staticContentType: 'text/html' },
    },
    {
      expected: /static asset.*valid JavaScript|JavaScript.*structure/i,
      label: 'non-JavaScript bytes with the JavaScript content type',
      options: { staticBody: 'not-javascript' },
    },
    {
      expected: /FreshCut image.*non-empty/i,
      label: 'empty image body',
      options: { imageBody: '' },
    },
    {
      expected: /FreshCut image.*content-type.*image\/webp/i,
      label: 'wrong image content type',
      options: { imageContentType: 'text/html' },
    },
    {
      expected: /FreshCut image.*WebP.*signature/i,
      label: 'non-WebP bytes with the WebP content type',
      options: { imageBody: new TextEncoder().encode('not-a-webp') },
    },
    {
      expected: /FreshCut image.*valid WebP|WebP.*decode|WebP.*metadata/i,
      label: 'a corrupt RIFF/WEBP prefix for the raw image',
      options: { imageBody: CORRUPT_WEBP_PREFIX },
    },
    {
      expected: /FreshCut image.*valid WebP|WebP.*decode|WebP.*metadata/i,
      label: 'a corrupt RIFF/WEBP prefix for the optimizer image',
      options: { optimizedImageBody: CORRUPT_WEBP_PREFIX },
    },
  ])('rejects a successful approved-asset response with $label', async ({ expected, options }) => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)

    const error = await verifier
      .verifyMotiontestRelease({
        fetchImpl: successfulFetch(options),
        liveBaseline,
        log() {},
      })
      .catch((caught) => caught)
    expect(error.message).toMatch(expected)
    expect(error.code).toBeUndefined()
  })

  it('requires a real baseline booking destination and the verified key service prices', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const foreignBookingUrl = 'https://attacker.example/book'

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({
          motionHtml: motiontestHtml({
            bookingUrl: foreignBookingUrl,
            services: verifiedServiceMarkup().replaceAll(LIVE_BOOKING_URL, foreignBookingUrl),
          }),
        }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/booking.*destination|destination.*booking/i)

    const wrongPriceServices = verifiedServiceMarkup().replace('369 kr', '0 kr')
    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({
          motionHtml: motiontestHtml({ services: wrongPriceServices }),
        }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/Herrklippning.*369 kr|verified service.*price/i)
  })

  it('fails if the live deployment/content fingerprint changes after Wrangler', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)

    for (const changedLiveMarkup of [
      liveHtml({ staticReferences: ['/_next/static/chunks/other.js'] }),
      liveHtml({ bookingUrl: 'https://www.bokadirekt.se/places/changed-456' }),
      liveHtml({ serviceLabel: 'Boka Herrklippning, 45 min' }),
    ]) {
      await expect(
        verifier.verifyMotiontestRelease({
          fetchImpl: successfulFetch({ liveMarkup: changedLiveMarkup }),
          liveBaseline,
          log() {},
        }),
      ).rejects.toMatchObject({
        code: 'MOTIONTEST_LIVE_FRESHCUT_BASELINE_MISMATCH',
        message: expect.stringMatching(
          /live FreshCut.*(?:baseline|fingerprint).*(?:changed|mismatch)/i,
        ),
      })
    }
  })

  it('normalizes equivalent live static references before comparing fingerprints', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const equivalentLiveMarkup = liveHtml({
      staticReferences: [
        'https://freshcut.corevo.se/_next/static/css/live.css?later=two',
        '/_next/static/chunks/live-app.js#ignored',
      ],
    })

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ liveMarkup: equivalentLiveMarkup }),
        liveBaseline,
        log() {},
      }),
    ).resolves.toMatchObject({ liveFingerprintSha256: liveBaseline.fingerprintSha256 })
  })

  it('aborts every stalled fetch at the explicit timeout', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyLiveFreshCutBaseline) {
      expect(verifier?.verifyLiveFreshCutBaseline).toBeTypeOf('function')
      return
    }
    let observedSignal
    const fetchImpl = vi.fn(
      (_input, init = {}) =>
        new Promise((_resolve, reject) => {
          observedSignal = init.signal
          const fallback = setTimeout(() => reject(new Error('stalled fetch was not aborted')), 150)
          init.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(fallback)
              reject(new DOMException('aborted', 'AbortError'))
            },
            { once: true },
          )
        }),
    )

    await expect(
      verifier.verifyLiveFreshCutBaseline({ fetchImpl, fetchTimeoutMs: 10, log() {} }),
    ).rejects.toThrow(/live FreshCut HTML.*timed out.*10 ms/i)
    expect(observedSignal).toBeInstanceOf(AbortSignal)
    expect(observedSignal.aborted).toBe(true)
  })

  it('fails instead of claiming completion when live contains a prototype marker', async () => {
    const verifier = await loadVerifier()
    if (!verifier?.verifyMotiontestRelease) {
      expect(verifier?.verifyMotiontestRelease).toBeTypeOf('function')
      return
    }
    const liveBaseline = await captureBaseline(verifier)
    const leakedPrototype = liveHtml({ extraAttributes: 'data-provenance="prototype"' })

    await expect(
      verifier.verifyMotiontestRelease({
        fetchImpl: successfulFetch({ liveMarkup: leakedPrototype }),
        liveBaseline,
        log() {},
      }),
    ).rejects.toThrow(/live FreshCut.*prototype|prototype.*live FreshCut/i)
  })
})
