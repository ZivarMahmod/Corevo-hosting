const DEFAULT_PORTAL_HOST = 'mina.corevo.se'

function isLocalPreview(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')
}

export function isAllowedPortalPostOrigin(request: Request): boolean {
  const originHeader = request.headers.get('origin')
  if (!originHeader) return false

  let requestUrl: URL
  let originUrl: URL
  try {
    requestUrl = new URL(request.url)
    originUrl = new URL(originHeader)
  } catch {
    return false
  }

  if (
    originUrl.origin !== originHeader ||
    originUrl.origin !== requestUrl.origin ||
    originUrl.pathname !== '/' ||
    originUrl.search !== '' ||
    originUrl.hash !== '' ||
    originUrl.username !== '' ||
    originUrl.password !== ''
  ) {
    return false
  }

  const hostHeader = request.headers.get('host')
  if (hostHeader && hostHeader.toLowerCase() !== requestUrl.host.toLowerCase()) return false

  const configuredHost = (process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_HOST ?? DEFAULT_PORTAL_HOST).toLowerCase()
  if (
    requestUrl.protocol === 'https:' &&
    requestUrl.hostname.toLowerCase() === configuredHost &&
    requestUrl.port === ''
  ) {
    return true
  }

  const hostname = requestUrl.hostname.toLowerCase()
  if (isLocalPreview(hostname)) return requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:'
  return requestUrl.protocol === 'https:' && hostname.endsWith('.workers.dev')
}
