import 'server-only'

const encoder = new TextEncoder()

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(value))
  return new Uint8Array(digest)
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([sha256(left), sha256(right)])
    let mismatch = a.length ^ b.length
    for (let index = 0; index < a.length; index += 1) {
      mismatch |= a[index]! ^ b[index % b.length]!
    }
    return mismatch === 0
  } catch {
    // Web Crypto is guaranteed on Workers. An unexpected runtime without it must
    // never make the cron endpoint public.
    return false
  }
}

/** Authenticate the shared cron bearer without an early-exit string comparison. */
export async function authorizedCronRequest(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const presented = req.headers.get('authorization') ?? ''
  return constantTimeEqual(presented, `Bearer ${secret}`)
}
