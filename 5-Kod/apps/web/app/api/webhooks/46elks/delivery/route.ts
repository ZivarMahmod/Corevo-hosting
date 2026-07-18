import { NextResponse } from 'next/server'
import { logger } from '@/lib/observability'
import { createServiceClient } from '@/lib/platform/service'

const ALLOWED_SOURCE_IPS = new Set([
  '176.10.154.199',
  '85.24.146.132',
  '185.39.146.243',
  '2001:9b0:2:902::199',
])
const PROVIDER_ID = /^s[a-f0-9]{32}$/
const DELIVERED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/
const CALLBACK_USERNAME = 'corevo'

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ])
  const a = new Uint8Array(leftHash)
  const b = new Uint8Array(rightHash)
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!
  return difference === 0
}

function strictDeliveryTimestamp(raw: string): string | null {
  if (!DELIVERED_AT.test(raw)) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function POST(request: Request): Promise<Response> {
  const sourceIp = request.headers.get('cf-connecting-ip') ?? ''
  if (!ALLOWED_SOURCE_IPS.has(sourceIp)) {
    logger.warn('sms.delivery.source_denied')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const secret = process.env.SMS_46ELKS_CALLBACK_SECRET
  if (!secret) {
    logger.warn('sms.delivery.unconfigured')
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  const authorization = request.headers.get('authorization') ?? ''
  let expectedAuthorization: string
  try {
    expectedAuthorization = `Basic ${btoa(`${CALLBACK_USERNAME}:${secret}`)}`
  } catch {
    logger.warn('sms.delivery.unconfigured')
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  if (!(await constantTimeEqual(authorization, expectedAuthorization))) {
    logger.warn('sms.delivery.auth_denied')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (new URL(request.url).search) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/x-www-form-urlencoded') {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }
  const entries = [...form.entries()]
  const allowedFields = new Set(['id', 'status', 'delivered'])
  if (
    entries.some(([key, value]) => !allowedFields.has(key) || typeof value !== 'string')
    || entries.filter(([key]) => key === 'id').length !== 1
    || entries.filter(([key]) => key === 'status').length !== 1
    || entries.filter(([key]) => key === 'delivered').length > 1
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const providerRef = form.get('id')
  const status = form.get('status')
  const delivered = form.get('delivered')
  if (
    typeof providerRef !== 'string'
    || !PROVIDER_ID.test(providerRef)
    || typeof status !== 'string'
    || !['sent', 'delivered', 'failed'].includes(status)
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  let deliveredAt: string | null = null
  if (status === 'delivered') {
    if (typeof delivered !== 'string') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }
    deliveredAt = strictDeliveryTimestamp(delivered)
    if (!deliveredAt) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  } else if (delivered !== null) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const admin = createServiceClient()
  if (!admin) {
    logger.warn('sms.delivery.db_unavailable')
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  const { data, error } = await admin.rpc('record_sms_delivery', {
    p_provider_ref: providerRef,
    p_status: status,
    p_delivered_at: deliveredAt,
  })
  if (error) {
    logger.warn('sms.delivery.db_failed')
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }
  if (data === 'unknown_provider') {
    logger.warn('sms.delivery.provider_unknown')
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (!['updated', 'idempotent', 'terminal'].includes(String(data))) {
    logger.warn('sms.delivery.result_invalid')
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
