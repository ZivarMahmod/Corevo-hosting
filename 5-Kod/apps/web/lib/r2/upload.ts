import 'server-only'

// Server-side image upload to the Cloudflare R2 bucket bound as `BUCKET`
// (wrangler.jsonc). The file is received by a Server Action and written here on
// the server — the browser never sees an R2 key, token or account id, so there
// are NO secrets on the client. The public URL stored in the DB is built from
// R2_PUBLIC_BASE_URL (the bucket's public / custom-domain origin), configured by
// ops (G08) together with enabling R2 on the account + the wrangler binding.

// Minimal structural type for the R2 binding so we don't depend on
// @cloudflare/workers-types (not installed). Only the methods we call.
type R2PutBody = ArrayBuffer | ArrayBufferView | string
interface R2BucketLike {
  put(
    key: string,
    value: R2PutBody,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  delete(key: string): Promise<void>
}

export type UploadResult =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: 'no_binding' | 'no_public_base' | 'bad_type' | 'too_large' | 'failed' }

const PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB — logos are small
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
}

/** Resolve the ambient R2 binding, or null in `next dev` / when R2 is not wired. */
async function getBucket(): Promise<R2BucketLike | null> {
  try {
    const mod = await import('@opennextjs/cloudflare')
    const { env } = mod.getCloudflareContext()
    const bucket = (env as Record<string, unknown>).BUCKET
    return bucket ? (bucket as R2BucketLike) : null
  } catch {
    // getCloudflareContext throws outside the Worker runtime (plain `next dev`).
    return null
  }
}

/**
 * Upload `file` under `keyPrefix` and return its public URL. Never throws —
 * callers (branding save) inspect `ok`/`reason` and degrade gracefully so a
 * colors-only save still works when R2 isn't available locally.
 */
export async function uploadImage(file: File, keyPrefix: string): Promise<UploadResult> {
  const ext = EXT[file.type]
  if (!ext) return { ok: false, reason: 'bad_type' }
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too_large' }
  if (!PUBLIC_BASE) return { ok: false, reason: 'no_public_base' }

  const bucket = await getBucket()
  if (!bucket) return { ok: false, reason: 'no_binding' }

  const key = `${keyPrefix.replace(/^\/+|\/+$/g, '')}/${crypto.randomUUID()}.${ext}`
  try {
    const buf = await file.arrayBuffer()
    await bucket.put(key, buf, { httpMetadata: { contentType: file.type } })
  } catch {
    return { ok: false, reason: 'failed' }
  }
  return { ok: true, key, url: `${PUBLIC_BASE.replace(/\/$/, '')}/${key}` }
}

/** Human-readable Swedish message for a non-ok upload reason. */
export function uploadErrorMessage(reason: Exclude<UploadResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'bad_type':
      return 'Logotypen måste vara PNG, JPG, WEBP, SVG eller GIF.'
    case 'too_large':
      return 'Logotypen är för stor (max 2 MB).'
    case 'no_public_base':
    case 'no_binding':
      return 'Bilduppladdning är inte aktiverad i denna miljö (kräver R2 + R2_PUBLIC_BASE_URL). Färg/typsnitt sparades.'
    default:
      return 'Uppladdningen misslyckades. Försök igen.'
  }
}
