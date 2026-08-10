import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import { htmlToDOM } from 'html-react-parser'
import sharp from 'sharp'

const MOTIONTEST_ORIGIN = 'https://motiontest.corevo.se'
const LIVE_FRESHCUT_ORIGIN = 'https://freshcut.corevo.se'
const ALLOWED_FRESHCUT_IMAGE = '/images/freshcut/freshcut-hero.webp'
const ALLOWED_FRESHCUT_OPTIMIZED_IMAGE =
  '/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75'
const DEFAULT_FETCH_TIMEOUT_MS = 10_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024
export const MOTIONTEST_PROPAGATION_PENDING_CODE = 'MOTIONTEST_PROPAGATION_PENDING'
export const LIVE_FRESHCUT_BASELINE_MISMATCH_CODE = 'MOTIONTEST_LIVE_FRESHCUT_BASELINE_MISMATCH'

const SAFE_NEGATIVE_PATHS = [
  '/admin',
  '/api/auth/session',
  '/manifest.webmanifest',
  '/_next/static/chunks/app%00.js',
  '/_next/static/chunks/app%2500.js',
  '/_next/image?url=https%3A%2F%2Fattacker.example%2Fimage.webp&w=1200&q=75',
  '/_next/image?url=%2F%2Fattacker.example%2Fimage.webp&w=1200&q=75',
  '/_next/image?url=https%253A%252F%252Fattacker.example%252Fimage.webp&w=1200&q=75',
  '/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75&fit=cover',
  '/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&url=%2Fimages%2Ffreshcut%2Ffreshcut-2.webp&w=1200&q=75',
  '/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&w=600&q=75',
  '/_next/image?url=%2Fimages%2Ffreshcut%2Ffreshcut-hero.webp&w=1200&q=75&q=50',
]

const REQUIRED_VERIFIED_SERVICES = [
  ['Herrklippning', '369 kr'],
  ['Herrklippning Student', '329 kr'],
  ['Herrklippning, långt skägg, varm handduk', '459 kr'],
]

function fail(message, code) {
  const error = new Error(`verify-motiontest-release: ${message}`)
  if (code) error.code = code
  throw error
}

function baselineMismatch(error) {
  if (error?.code === LIVE_FRESHCUT_BASELINE_MISMATCH_CODE) return error
  const mismatch = new Error(String(error?.message ?? error), { cause: error })
  mismatch.code = LIVE_FRESHCUT_BASELINE_MISMATCH_CODE
  return mismatch
}

async function readBounded(response, label, expectedStatus, propagationPendingStatuses) {
  if (response.status !== expectedStatus) {
    fail(
      `${label} returned HTTP ${response.status}; expected ${expectedStatus}`,
      propagationPendingStatuses.includes(response.status)
        ? MOTIONTEST_PROPAGATION_PENDING_CODE
        : undefined,
    )
  }

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    fail(`${label} response is too large`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    fail(`${label} response is too large`)
  }
  return { body: new TextDecoder().decode(bytes), bytes }
}

async function fetchChecked(
  fetchImpl,
  url,
  label,
  {
    method = 'GET',
    accept = 'text/html',
    expectedStatus = 200,
    fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    deadlineAt,
    nowImpl = Date.now,
    propagationNetworkFailure = false,
    propagationPendingStatuses = [],
  } = {},
) {
  if (!Number.isFinite(fetchTimeoutMs) || fetchTimeoutMs <= 0) {
    fail('fetch timeout must be a positive finite number')
  }
  if ((deadlineAt !== undefined && !Number.isFinite(deadlineAt)) || typeof nowImpl !== 'function') {
    fail('verification deadline inputs are invalid')
  }

  const deadlineRemainingMs = deadlineAt === undefined ? Infinity : deadlineAt - nowImpl()
  if (deadlineRemainingMs <= 0) fail(`${label} exceeded the total verification deadline`)
  const requestTimeoutMs = Math.min(fetchTimeoutMs, deadlineRemainingMs)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetchImpl(url, {
      method,
      redirect: 'error',
      headers: { accept },
      signal: controller.signal,
    })
    const { body, bytes } = await readBounded(
      response,
      label,
      expectedStatus,
      propagationPendingStatuses,
    )
    return { body, bytes, response }
  } catch (error) {
    if (controller.signal.aborted) {
      fail(
        `${label} timed out after ${requestTimeoutMs} ms`,
        propagationNetworkFailure ? MOTIONTEST_PROPAGATION_PENDING_CODE : undefined,
      )
    }
    if (String(error?.message ?? error).startsWith('verify-motiontest-release:')) throw error
    fail(
      `${label} request failed: ${String(error?.message ?? error)}`,
      propagationNetworkFailure ? MOTIONTEST_PROPAGATION_PENDING_CODE : undefined,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchText(fetchImpl, url, label, options) {
  const { body } = await fetchChecked(fetchImpl, url, label, options)
  return body
}

function walkDom(nodes, visit) {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    visit(node)
    if (Array.isArray(node.children)) walkDom(node.children, visit)
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nodeText(node) {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return String(node.data ?? '')
  return Array.isArray(node.children) ? node.children.map(nodeText).join(' ') : ''
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'sv'))
}

function normalizeBookingDestination(value) {
  try {
    const url = new URL(String(value ?? ''))
    if (
      url.protocol !== 'https:' ||
      url.host !== 'www.bokadirekt.se' ||
      url.username ||
      url.password
    ) {
      return null
    }
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function normalizeLiveStaticPath(value) {
  try {
    const url = new URL(String(value ?? ''), `${LIVE_FRESHCUT_ORIGIN}/`)
    if (url.origin !== LIVE_FRESHCUT_ORIGIN || !url.pathname.startsWith('/_next/static/')) {
      return null
    }
    return url.pathname
  } catch {
    return null
  }
}

function responseContentType(response) {
  return String(response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
}

function verifyNonEmptyAssetBody(bytes, label) {
  if (bytes.byteLength === 0) fail(`${label} must have a non-empty body`)
}

function verifyStaticAssetContentType(assetUrl, response) {
  const extension = new URL(assetUrl).pathname
    .toLowerCase()
    .match(/\.(js|mjs|css|woff2?|ttf|otf)$/)?.[1]
  const expectedByExtension = {
    css: ['text/css'],
    js: ['application/javascript', 'text/javascript'],
    mjs: ['application/javascript', 'text/javascript'],
    otf: ['font/otf'],
    ttf: ['font/ttf'],
    woff: ['font/woff', 'application/font-woff'],
    woff2: ['font/woff2'],
  }
  const expected = expectedByExtension[extension]
  if (!expected) fail('motiontest static asset must use a JS, CSS, or font suffix')
  const actual = responseContentType(response)
  if (!expected.includes(actual)) {
    fail(
      `motiontest static asset content-type must be ${expected.join(' or ')} for .${extension}; received ${actual || 'missing'}`,
    )
  }
  return extension
}

function startsWithAscii(bytes, offset, value) {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0))
}

function verifyStaticAssetResponse(assetUrl, result) {
  verifyNonEmptyAssetBody(result.bytes, 'motiontest static asset')
  const extension = verifyStaticAssetContentType(assetUrl, result.response)
  if (extension === 'js' || extension === 'mjs') {
    try {
      new Script(result.body, { filename: new URL(assetUrl).pathname })
    } catch {
      fail('motiontest static asset must contain valid JavaScript')
    }
    if (!/[=;{}()[\]]/.test(result.body)) {
      fail('motiontest static asset must contain valid JavaScript structure')
    }
    return
  }
  if (extension === 'css') {
    if (!result.body.includes('{') || !result.body.includes('}')) {
      fail('motiontest static asset must contain a CSS rule')
    }
    return
  }

  const fontMagic = result.bytes.subarray(0, 4)
  const validFont =
    (extension === 'woff' && startsWithAscii(fontMagic, 0, 'wOFF')) ||
    (extension === 'woff2' && startsWithAscii(fontMagic, 0, 'wOF2')) ||
    (extension === 'otf' && startsWithAscii(fontMagic, 0, 'OTTO')) ||
    (extension === 'ttf' &&
      ((fontMagic[0] === 0 && fontMagic[1] === 1 && fontMagic[2] === 0 && fontMagic[3] === 0) ||
        startsWithAscii(fontMagic, 0, 'true')))
  if (!validFont) fail(`motiontest static asset has an invalid .${extension} font signature`)
}

function verifyFreshCutImageContentType(response) {
  const actual = responseContentType(response)
  if (actual !== 'image/webp') {
    fail(
      `motiontest allowed FreshCut image content-type must be image/webp; received ${actual || 'missing'}`,
    )
  }
}

async function verifyFreshCutImageResponse(result) {
  verifyNonEmptyAssetBody(result.bytes, 'motiontest allowed FreshCut image')
  verifyFreshCutImageContentType(result.response)
  if (
    result.bytes.byteLength < 12 ||
    !startsWithAscii(result.bytes, 0, 'RIFF') ||
    !startsWithAscii(result.bytes, 8, 'WEBP')
  ) {
    fail('motiontest allowed FreshCut image must have a RIFF WebP signature')
  }

  const input = Buffer.from(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength)
  const decodeOptions = {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  }
  let metadata
  let decoded
  try {
    metadata = await sharp(input, decodeOptions).metadata()
    decoded = await sharp(input, decodeOptions).raw().toBuffer({ resolveWithObject: true })
  } catch (error) {
    fail(
      `motiontest allowed FreshCut image must decode as a valid WebP: ${String(error?.message ?? error)}`,
    )
  }

  if (
    metadata.format !== 'webp' ||
    !Number.isSafeInteger(metadata.width) ||
    metadata.width <= 0 ||
    !Number.isSafeInteger(metadata.height) ||
    metadata.height <= 0 ||
    (metadata.pages !== undefined && metadata.pages !== 1) ||
    decoded.info.format !== 'raw' ||
    decoded.info.width !== metadata.width ||
    decoded.info.height !== metadata.height ||
    decoded.data.byteLength === 0
  ) {
    fail('motiontest allowed FreshCut image must have valid single-page WebP metadata and pixels')
  }
}

function verifyMotiontestHtml(html, liveFingerprint) {
  if (!/data-storefront-experience=["']freshcut-motiontest["']/.test(html)) {
    fail('motiontest marker is missing', MOTIONTEST_PROPAGATION_PENDING_CODE)
  }
  if (!/data-motion-scene=/.test(html)) {
    fail('motiontest scene marker is missing', MOTIONTEST_PROPAGATION_PENDING_CODE)
  }

  let hasNoIndexNoFollow = false
  let staticAssetPath = null
  const bookingDestinations = []
  const verifiedServiceText = []
  walkDom(htmlToDOM(html), (node) => {
    const name = String(node.name ?? '').toLowerCase()
    const attributes = node.attribs ?? {}
    if (
      name === 'meta' &&
      String(attributes.name ?? '')
        .trim()
        .toLowerCase() === 'robots'
    ) {
      const directives = new Set(
        String(attributes.content ?? '')
          .toLowerCase()
          .split(/[\s,]+/)
          .filter(Boolean),
      )
      if (directives.has('noindex') && directives.has('nofollow')) hasNoIndexNoFollow = true
    }

    const candidate =
      name === 'script' ? attributes.src : name === 'link' ? attributes.href : undefined
    if (!staticAssetPath && String(candidate ?? '').startsWith('/_next/static/')) {
      staticAssetPath = String(candidate)
    }

    if (name === 'a') {
      const destination = normalizeBookingDestination(attributes.href)
      if (destination) bookingDestinations.push(destination)
    }
    if (name === 'article' && attributes['data-provenance'] === 'verified') {
      verifiedServiceText.push(normalizeText(nodeText(node)))
    }
  })

  if (!hasNoIndexNoFollow) fail('motiontest robots meta must contain noindex and nofollow')
  if (!staticAssetPath) fail('motiontest HTML has no local static asset marker')

  const allowedBookingDestinations = new Set(liveFingerprint.bookingDestinations)
  if (!bookingDestinations.some((destination) => allowedBookingDestinations.has(destination))) {
    fail('motiontest booking destination must match a real live FreshCut booking destination')
  }
  for (const [serviceName, price] of REQUIRED_VERIFIED_SERVICES) {
    if (!verifiedServiceText.some((text) => text.includes(serviceName) && text.includes(price))) {
      fail(`verified service ${serviceName} must expose price ${price}`)
    }
  }

  return new URL(staticAssetPath, `${MOTIONTEST_ORIGIN}/`).toString()
}

function parseRobots(robots) {
  const groups = []
  const sitemaps = []
  let current = null

  for (const sourceLine of robots.split(/\r?\n/)) {
    const line = sourceLine.split('#', 1)[0].trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator < 1) continue
    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      if (!current || current.hasDirectives) {
        current = { agents: [], allow: [], disallow: [], hasDirectives: false }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      continue
    }
    if (field === 'sitemap') {
      if (value) sitemaps.push(value)
      continue
    }
    if (!current || (field !== 'allow' && field !== 'disallow')) continue
    current[field].push(value)
    current.hasDirectives = true
  }

  return { groups, sitemaps }
}

function wildcardRobotsGroup(parsed, label) {
  const group = parsed.groups.find((candidate) => candidate.agents.includes('*'))
  if (!group) fail(`${label} robots has no wildcard user-agent group`)
  return group
}

function verifyMotiontestRobots(robots) {
  const parsed = parseRobots(robots)
  const wildcard = wildcardRobotsGroup(parsed, 'motiontest')
  if (!wildcard.disallow.includes('/')) fail('motiontest robots must disallow all crawlers')
  if (parsed.sitemaps.length) fail('motiontest robots must not advertise a sitemap')
}

const FORBIDDEN_LIVE_MARKERS = [
  /freshcut-motiontest/i,
  /data-storefront-shell-experience/i,
  /data-storefront-experience/i,
  /data-provenance=["']prototype["']/i,
  /data-motion-scene/i,
  /sankt-larsgatan/i,
]

function liveFingerprintFromHtml(html) {
  if (!/data-world=["']storefront["']/.test(html) || !/data-theme=["']freshcut["']/.test(html)) {
    fail('live FreshCut ordinary storefront markers are missing')
  }
  if (FORBIDDEN_LIVE_MARKERS.some((marker) => marker.test(html))) {
    fail('live FreshCut contains a motion or prototype marker')
  }

  const canonicalUrls = []
  const staticAssetPaths = []
  const bookingDestinations = []
  const serviceBookingLabels = []
  walkDom(htmlToDOM(html), (node) => {
    const name = String(node.name ?? '').toLowerCase()
    const attributes = node.attribs ?? {}
    if (name === 'link' && String(attributes.rel ?? '').toLowerCase() === 'canonical') {
      try {
        canonicalUrls.push(
          new URL(String(attributes.href ?? ''), `${LIVE_FRESHCUT_ORIGIN}/`).toString(),
        )
      } catch {
        fail('live FreshCut canonical URL is malformed')
      }
    }

    const staticReference =
      name === 'script' ? attributes.src : name === 'link' ? attributes.href : undefined
    const staticPath = normalizeLiveStaticPath(staticReference)
    if (staticPath) staticAssetPaths.push(staticPath)

    if (name === 'a') {
      const destination = normalizeBookingDestination(attributes.href)
      if (destination) bookingDestinations.push(destination)
      const label = normalizeText(attributes['aria-label'])
      if (/^Boka .+,\s*\d+\s*min$/i.test(label)) serviceBookingLabels.push(label)
    }
  })

  const canonicalUrl = sortedUnique(canonicalUrls)
  if (canonicalUrl.length !== 1 || canonicalUrl[0] !== `${LIVE_FRESHCUT_ORIGIN}/`) {
    fail('live FreshCut canonical URL must use the exact live origin')
  }
  if (!staticAssetPaths.length) fail('live FreshCut must expose a local Next static asset')
  if (!bookingDestinations.length) fail('live FreshCut must expose a real Bokadirekt booking href')
  if (!serviceBookingLabels.length) fail('live FreshCut must expose verified service booking data')

  return {
    canonicalUrl: canonicalUrl[0],
    ordinaryMarkers: { dataTheme: 'freshcut', dataWorld: 'storefront' },
    staticAssetPaths: sortedUnique(staticAssetPaths),
    bookingDestinations: sortedUnique(bookingDestinations),
    serviceBookingLabels: sortedUnique(serviceBookingLabels),
  }
}

function verifyLiveFreshCutRobots(robots) {
  const parsed = parseRobots(robots)
  const wildcard = wildcardRobotsGroup(parsed, 'live FreshCut')
  if (!wildcard.allow.includes('/')) fail('live FreshCut robots wildcard group must allow root')
  if (wildcard.disallow.includes('/')) {
    fail('live FreshCut robots wildcard group must not disallow root')
  }
  if (
    parsed.sitemaps.length > 0 &&
    (parsed.sitemaps.length !== 1 ||
      parsed.sitemaps[0] !== 'https://freshcut.corevo.se/sitemap.xml')
  ) {
    fail('live FreshCut robots sitemap, when present, must use the exact live origin')
  }

  return {
    allow: sortedUnique(wildcard.allow.filter(Boolean)),
    disallow: sortedUnique(wildcard.disallow.filter(Boolean)),
    sitemaps: sortedUnique(parsed.sitemaps),
  }
}

function fingerprintSha256(fingerprint) {
  return createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex')
}

function assertLiveBaseline(liveBaseline) {
  if (
    !liveBaseline ||
    liveBaseline.liveFreshCutIsolated !== true ||
    !liveBaseline.fingerprint ||
    !/^[a-f0-9]{64}$/.test(String(liveBaseline.fingerprintSha256 ?? '')) ||
    fingerprintSha256(liveBaseline.fingerprint) !== liveBaseline.fingerprintSha256
  ) {
    fail(
      'a valid live FreshCut pre-deploy baseline is required',
      LIVE_FRESHCUT_BASELINE_MISMATCH_CODE,
    )
  }
  return liveBaseline
}

export async function verifyLiveFreshCutBaseline({
  deadlineAt,
  fetchImpl = fetch,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  log = console.log,
  nowImpl = Date.now,
} = {}) {
  const requestOptions = { deadlineAt, fetchTimeoutMs, nowImpl }
  const liveFreshCutHtml = await fetchText(
    fetchImpl,
    `${LIVE_FRESHCUT_ORIGIN}/`,
    'live FreshCut HTML',
    requestOptions,
  )
  const liveFreshCutRobots = await fetchText(
    fetchImpl,
    `${LIVE_FRESHCUT_ORIGIN}/robots.txt`,
    'live FreshCut robots',
    { ...requestOptions, accept: 'text/plain' },
  )

  const fingerprint = {
    ...liveFingerprintFromHtml(liveFreshCutHtml),
    robots: verifyLiveFreshCutRobots(liveFreshCutRobots),
  }
  const result = {
    liveFreshCutIsolated: true,
    fingerprint,
    fingerprintSha256: fingerprintSha256(fingerprint),
  }
  log('Live FreshCut baseline isolation and content fingerprint verified.')
  return result
}

async function verifySafeMotiontestBoundary(fetchImpl, requestOptions) {
  for (const pathname of SAFE_NEGATIVE_PATHS) {
    await fetchChecked(
      fetchImpl,
      `${MOTIONTEST_ORIGIN}${pathname}`,
      `motiontest negative probe ${pathname}`,
      { ...requestOptions, expectedStatus: 404 },
    )
  }

  const { response: methodResponse } = await fetchChecked(
    fetchImpl,
    `${MOTIONTEST_ORIGIN}/`,
    'motiontest method boundary',
    { ...requestOptions, method: 'OPTIONS', expectedStatus: 405 },
  )
  const allowedMethods = new Set(
    String(methodResponse.headers.get('allow') ?? '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  )
  if (allowedMethods.size !== 2 || !allowedMethods.has('GET') || !allowedMethods.has('HEAD')) {
    fail('motiontest method boundary must allow exactly GET and HEAD')
  }

  await fetchChecked(fetchImpl, `${MOTIONTEST_ORIGIN}/`, 'motiontest HEAD root', {
    method: 'HEAD',
    expectedStatus: 200,
    ...requestOptions,
  })
}

export async function verifyMotiontestRelease({
  deadlineAt,
  fetchImpl = fetch,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  liveBaseline,
  log = console.log,
  nowImpl = Date.now,
} = {}) {
  const requestOptions = { deadlineAt, fetchTimeoutMs, nowImpl }
  const trustedBaseline = assertLiveBaseline(liveBaseline)
  const motionHtml = await fetchText(fetchImpl, `${MOTIONTEST_ORIGIN}/`, 'motiontest HTML', {
    ...requestOptions,
    propagationNetworkFailure: true,
    propagationPendingStatuses: [404],
  })
  const motionRobots = await fetchText(
    fetchImpl,
    `${MOTIONTEST_ORIGIN}/robots.txt`,
    'motiontest robots',
    { ...requestOptions, accept: 'text/plain' },
  )

  const staticAssetUrl = verifyMotiontestHtml(motionHtml, trustedBaseline.fingerprint)
  verifyMotiontestRobots(motionRobots)
  const staticAsset = await fetchChecked(fetchImpl, staticAssetUrl, 'motiontest static asset', {
    ...requestOptions,
    accept: 'application/octet-stream',
    propagationNetworkFailure: true,
    propagationPendingStatuses: [404],
  })
  verifyStaticAssetResponse(staticAssetUrl, staticAsset)
  const staticAssetHead = await fetchChecked(
    fetchImpl,
    staticAssetUrl,
    'motiontest static asset HEAD',
    { ...requestOptions, accept: 'application/octet-stream', method: 'HEAD' },
  )
  verifyStaticAssetContentType(staticAssetUrl, staticAssetHead.response)

  const freshCutImage = await fetchChecked(
    fetchImpl,
    `${MOTIONTEST_ORIGIN}${ALLOWED_FRESHCUT_IMAGE}`,
    'motiontest allowed FreshCut image',
    { ...requestOptions, accept: 'image/*' },
  )
  await verifyFreshCutImageResponse(freshCutImage)
  const freshCutImageHead = await fetchChecked(
    fetchImpl,
    `${MOTIONTEST_ORIGIN}${ALLOWED_FRESHCUT_IMAGE}`,
    'motiontest allowed FreshCut image HEAD',
    { ...requestOptions, accept: 'image/*', method: 'HEAD' },
  )
  verifyFreshCutImageContentType(freshCutImageHead.response)

  const optimizedFreshCutImage = await fetchChecked(
    fetchImpl,
    `${MOTIONTEST_ORIGIN}${ALLOWED_FRESHCUT_OPTIMIZED_IMAGE}`,
    'motiontest optimized FreshCut image',
    { ...requestOptions, accept: 'image/*' },
  )
  await verifyFreshCutImageResponse(optimizedFreshCutImage)
  const optimizedFreshCutImageHead = await fetchChecked(
    fetchImpl,
    `${MOTIONTEST_ORIGIN}${ALLOWED_FRESHCUT_OPTIMIZED_IMAGE}`,
    'motiontest optimized FreshCut image HEAD',
    { ...requestOptions, accept: 'image/*', method: 'HEAD' },
  )
  verifyFreshCutImageContentType(optimizedFreshCutImageHead.response)
  await verifySafeMotiontestBoundary(fetchImpl, requestOptions)

  let liveAfterDeploy
  try {
    liveAfterDeploy = await verifyLiveFreshCutBaseline({
      deadlineAt,
      fetchImpl,
      fetchTimeoutMs,
      log() {},
      nowImpl,
    })
  } catch (error) {
    throw baselineMismatch(error)
  }
  if (liveAfterDeploy.fingerprintSha256 !== trustedBaseline.fingerprintSha256) {
    fail(
      'live FreshCut baseline fingerprint changed after Wrangler',
      LIVE_FRESHCUT_BASELINE_MISMATCH_CODE,
    )
  }

  log(
    'Motiontest public markers, robots, boundary probes, booking evidence, and unchanged live FreshCut fingerprint verified.',
  )
  return {
    motiontestVerified: true,
    liveFreshCutIsolated: true,
    safeBoundaryVerified: true,
    liveFingerprintSha256: liveAfterDeploy.fingerprintSha256,
  }
}

const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase()

if (invokedDirectly) {
  verifyLiveFreshCutBaseline()
    .then((liveBaseline) => verifyMotiontestRelease({ liveBaseline }))
    .catch((error) => {
      console.error(String(error?.message ?? error))
      process.exitCode = 1
    })
}
