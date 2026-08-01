import 'server-only'
import type { BookingVerificationMode } from '@/lib/platform/booking-variant'

export type BookingContactMode = 'sms' | 'email'
export type BookingContactAvailability = BookingContactMode | 'unavailable'

type HealthBody = {
  status?: unknown
  modem_online?: unknown
  time?: unknown
}

type SendInput = {
  to: string
  message: string
  idempotencyKey: string
  expiresAt?: string
  senderId?: string
}

export type GiadaSendResult =
  | { ok: true; id: number; created: boolean }
  | { ok: false; reason: 'disabled' | 'offline' | 'unauthorized' | 'rejected' | 'transport_error' }

const baseUrl = (): string => (process.env.GIADA_SMS_BASE_URL ?? '').trim().replace(/\/$/, '')
const apiKey = (): string => (process.env.GIADA_SMS_API_KEY ?? '').trim()

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function getBookingContactMode(
  mode: BookingVerificationMode = 'sms_with_email_fallback',
): Promise<BookingContactAvailability> {
  if (mode === 'email_only') return 'email'
  const unavailable: BookingContactAvailability =
    mode === 'sms_only' ? 'unavailable' : 'email'
  const base = baseUrl()
  if (!base || !apiKey()) return unavailable

  try {
    const response = await fetch(`${base}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(positiveInt(process.env.GIADA_HEALTH_TIMEOUT_MS, 1500)),
    })
    if (!response.ok) return unavailable
    const body = await response.json() as HealthBody
    if (body.status !== 'ok' || body.modem_online !== true || typeof body.time !== 'string') {
      return unavailable
    }
    const healthTime = Date.parse(body.time)
    if (!Number.isFinite(healthTime)) return unavailable
    const ageMs = Date.now() - healthTime
    const maxAgeMs = positiveInt(process.env.GIADA_HEALTH_MAX_AGE_SECONDS, 90) * 1000
    return ageMs >= -10_000 && ageMs <= maxAgeMs ? 'sms' : unavailable
  } catch {
    return unavailable
  }
}

export async function sendGiadaMessage(input: SendInput): Promise<GiadaSendResult> {
  const base = baseUrl()
  const key = apiKey()
  if (!base || !key) return { ok: false, reason: 'disabled' }

  try {
    const response = await fetch(`${base}/api/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({
        to: input.to,
        message: input.message,
        idempotency_key: input.idempotencyKey,
        require_online: true,
        ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
        ...(input.senderId ? { sender_id: input.senderId } : {}),
      }),
      signal: AbortSignal.timeout(positiveInt(process.env.GIADA_SEND_TIMEOUT_MS, 4000)),
    })

    if (response.status === 401) return { ok: false, reason: 'unauthorized' }
    if (response.status === 503) return { ok: false, reason: 'offline' }
    if (!response.ok) return { ok: false, reason: 'rejected' }

    const body = await response.json() as { ok?: unknown; id?: unknown; created?: unknown }
    if (body.ok !== true || typeof body.id !== 'number' || typeof body.created !== 'boolean') {
      return { ok: false, reason: 'rejected' }
    }
    return { ok: true, id: body.id, created: body.created }
  } catch {
    return { ok: false, reason: 'transport_error' }
  }
}
