const encoder = new TextEncoder()

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function normalizeGiftCardCode(rawCode: string): string {
  return rawCode.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export async function hashGiftCardCode(rawCode: string): Promise<string> {
  const normalized = normalizeGiftCardCode(rawCode)
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized))
  return bytesToHex(new Uint8Array(digest))
}

export async function createGiftCardCode(
  tenantId: string,
  idempotencyKey: string,
  secret: string,
): Promise<{
  rawCode: string
  codeHash: string
  lastFour: string
  maskedCode: string
}> {
  if (encoder.encode(secret).byteLength < 32) {
    throw new Error('GIFT_CARD_HMAC_KEY must contain at least 32 bytes')
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`corevo:gift-card:v1:${tenantId}:${idempotencyKey}`),
  )
  const normalized = bytesToHex(new Uint8Array(signature).slice(0, 16)).toUpperCase()
  const rawCode = normalized.match(/.{4}/g)!.join('-')
  const lastFour = normalized.slice(-4)

  return {
    rawCode,
    codeHash: await hashGiftCardCode(normalized),
    lastFour,
    maskedCode: `••••-${lastFour}`,
  }
}
