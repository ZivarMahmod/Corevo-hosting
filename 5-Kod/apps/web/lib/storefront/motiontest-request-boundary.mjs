const MOTIONTEST_PRODUCTION_AUTHORITY = 'motiontest.corevo.se'
const MOTIONTEST_LOCAL_AUTHORITY = /^motiontest\.localhost(?::(\d+))?$/i
const VERSIONED_MEDIA_PATH =
  /^\/media\/freshcut-motion\/([a-z0-9][a-z0-9-]*-v[1-9]\d*-[a-f0-9]{12})\/\1-(?:(?:desktop|mobile)\.(?:webm|mp4)|(?:desktop|mobile)-poster\.webp)$/

function fullyDecode(value) {
  let decoded = value
  for (let index = 0; index < 4 && decoded.includes('%'); index += 1) {
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      return null
    }
  }
  if (decoded.includes('%') || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(decoded)) return null
  return decoded
}

function isSafeLocalPath(pathname, prefix) {
  const decoded = fullyDecode(pathname)
  if (!decoded?.startsWith(prefix) || decoded.includes('\\')) return false
  const suffix = decoded.slice(prefix.length)
  if (!suffix || suffix.startsWith('/')) return false
  return suffix.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

function isFreshCutImageSource(source) {
  return typeof source === 'string' && isSafeLocalPath(source, '/images/freshcut/')
}

function isMotiontestImageRequest(search) {
  if (!search) return false
  const entries = [...search.keys()]
  if (entries.some((key) => !['q', 'url', 'w'].includes(key))) return false
  if (
    search.getAll('url').length !== 1 ||
    search.getAll('w').length !== 1 ||
    search.getAll('q').length !== 1 ||
    !isFreshCutImageSource(search.get('url'))
  ) {
    return false
  }
  const width = search.get('w')
  const quality = search.get('q')
  return /^\d+$/.test(width ?? '') && /^\d+$/.test(quality ?? '')
}

/** @param {string | null | undefined} authority */
export function motiontestAuthorityKind(authority) {
  if (typeof authority !== 'string' || authority !== authority.trim()) return null
  if (authority.toLowerCase() === MOTIONTEST_PRODUCTION_AUTHORITY) return 'production'
  const local = MOTIONTEST_LOCAL_AUTHORITY.exec(authority)
  if (!local) return null
  if (!local[1]) return 'local'
  const port = Number(local[1])
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535 ? 'local' : null
}

/**
 * @param {string} pathname
 * @param {URLSearchParams | null} [search]
 */
export function isMotiontestPublicPath(pathname, search = null) {
  if (
    pathname === '/' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg'
  ) {
    return true
  }
  if (isSafeLocalPath(pathname, '/_next/static/')) return true
  if (pathname === '/_next/image') return isMotiontestImageRequest(search)
  if (isSafeLocalPath(pathname, '/images/freshcut/')) return true
  return VERSIONED_MEDIA_PATH.test(pathname)
}

/**
 * @param {{
 *   authority: string | null | undefined
 *   method: string
 *   pathname: string
 *   protocol: string
 *   search?: URLSearchParams | null
 * }} request
 */
export function decideMotiontestRequest({ authority, method, pathname, protocol, search = null }) {
  const authorityKind = motiontestAuthorityKind(authority)
  if (!authorityKind) return { action: 'outside' }
  if (
    (authorityKind === 'production' && protocol !== 'https:') ||
    (authorityKind === 'local' && protocol !== 'http:' && protocol !== 'https:')
  ) {
    return { action: 'deny', status: 404 }
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return { action: 'deny', status: 405, allow: 'GET, HEAD' }
  }
  if (!isMotiontestPublicPath(pathname, search)) return { action: 'deny', status: 404 }
  return { action: 'allow', authorityKind }
}
