import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/platform/service'
import { CUSTOMER_PORTAL_KEY_VERSION, portalLinkDigest } from '@/lib/customer-portal/crypto'
import { PORTAL_SECRET_PATTERN, PORTAL_UUID_PATTERN } from '@/lib/customer-portal/link'
import { isAllowedPortalPostOrigin } from '@/lib/customer-portal/origin'
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionCredential,
  portalSessionCookieOptions,
} from '@/lib/customer-portal/session'

const MAX_BODY_BYTES = 4096
const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

type ExchangeArguments = {
  p_link_public_id: string
  p_token_digest: string
  p_new_session_public_id: string
  p_new_session_digest: string
  p_key_version: number
}

type ExchangeRpcClient = {
  rpc: (
    name: 'customer_portal_exchange_link',
    args: ExchangeArguments,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

type ExchangeBody = {
  tenantSlug: string
  linkPublicId: string
  secret: string
  keyVersion: 1
}

function response(ok: boolean, status: number): NextResponse<{ ok: boolean }> {
  return NextResponse.json(
    { ok },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
  )
}

async function readLimitedBody(request: Request): Promise<string | null> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const declared = Number(contentLength)
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_BODY_BYTES) return null
  }

  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    return null
  }
}

function parseBody(raw: string): ExchangeBody | null {
  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch {
    return null
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const object = input as Record<string, unknown>
  const keys = Object.keys(object).sort()
  if (keys.join(',') !== 'keyVersion,linkPublicId,secret,tenantSlug') return null
  if (
    typeof object.tenantSlug !== 'string' ||
    !TENANT_SLUG_PATTERN.test(object.tenantSlug) ||
    typeof object.linkPublicId !== 'string' ||
    !PORTAL_UUID_PATTERN.test(object.linkPublicId) ||
    typeof object.secret !== 'string' ||
    !PORTAL_SECRET_PATTERN.test(object.secret) ||
    object.keyVersion !== CUSTOMER_PORTAL_KEY_VERSION
  ) {
    return null
  }

  return {
    tenantSlug: object.tenantSlug,
    linkPublicId: object.linkPublicId.toLowerCase(),
    secret: object.secret,
    keyVersion: 1,
  }
}

export async function POST(request: Request): Promise<NextResponse<{ ok: boolean }>> {
  if (!isAllowedPortalPostOrigin(request)) return response(false, 403)

  const url = new URL(request.url)
  if (url.search !== '') return response(false, 400)

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') return response(false, 415)

  const rawBody = await readLimitedBody(request)
  if (rawBody === null) return response(false, 413)
  const body = parseBody(rawBody)
  if (!body) return response(false, 400)

  try {
    const tokenDigest = await portalLinkDigest(body.secret)
    const session = await createPortalSessionCredential()
    const service = createServiceClient() as ExchangeRpcClient | null
    if (!service) return response(false, 503)

    const { data, error } = await service.rpc('customer_portal_exchange_link', {
      p_link_public_id: body.linkPublicId,
      p_token_digest: tokenDigest,
      p_new_session_public_id: session.sessionPublicId,
      p_new_session_digest: session.secretDigest,
      p_key_version: session.keyVersion,
    })

    if (error) return response(false, 503)
    if (!Array.isArray(data) || data.length !== 1) return response(false, 400)

    const row = data[0] as Record<string, unknown>
    if (
      row.outcome !== 'ok' ||
      row.session_public_id !== session.sessionPublicId ||
      row.tenant_slug !== body.tenantSlug
    ) {
      return response(false, 400)
    }

    const result = response(true, 200)
    result.cookies.set(PORTAL_SESSION_COOKIE, session.cookieValue, portalSessionCookieOptions)
    return result
  } catch {
    return response(false, 503)
  }
}
