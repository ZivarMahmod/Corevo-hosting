import 'server-only'
import { logger } from '@/lib/observability'

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

/** Public origin of the R2 bucket (R2_PUBLIC_BASE_URL), read at CALL time — not
 *  captured at module load. The var is injected into process.env by the Workers
 *  runtime and may be absent when this module is first imported (it only became a
 *  committed var in FX-14). Trailing slash stripped so callers append "/<key>". */
function publicBase(): string | undefined {
  return process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') || undefined
}
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB — högupplösta hero/galleri-foton ska rymmas (Zivar)
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
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
 * Upload to the exact object key already reserved by Postgres. This is the
 * lifecycle-safe primitive: callers reserve quota/key first, then perform R2 I/O.
 */
export async function uploadImageAtKey(file: File, key: string): Promise<UploadResult> {
  if (!EXT[file.type]) return { ok: false, reason: 'bad_type' }
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too_large' }
  const keyParts = key.split('/')
  if (
    !key
    || key.startsWith('/')
    || key.endsWith('/')
    || key.includes('\\')
    || keyParts.some((part) => !part || part === '.' || part === '..')
  ) {
    return { ok: false, reason: 'failed' }
  }
  const base = publicBase()
  if (!base) return { ok: false, reason: 'no_public_base' }

  const bucket = await getBucket()
  if (!bucket) return { ok: false, reason: 'no_binding' }

  try {
    const buf = await file.arrayBuffer()
    await bucket.put(key, buf, { httpMetadata: { contentType: file.type } })
  } catch {
    return { ok: false, reason: 'failed' }
  }
  return { ok: true, key, url: `${base}/${key}` }
}

// ── Replace-don't-accumulate (FX-14) ──────────────────────────────────────────
// A salon keeps EXACTLY one current object per image slot (logo / hero[] /
// gallery[] / about / closing / team[].img). When a slot's image is replaced or
// removed, the previous object is deleted from R2 so no dead/orphaned files pile
// up. All deletes here are BEST-EFFORT: they run AFTER the DB save has committed
// and must never throw or block it.

/**
 * Derive an R2 object key from a stored public URL — the strict inverse of the
 * `${publicBase()}/${key}` that uploadImageAtKey produces. Returns null for a blank,
 * relative, or FOREIGN URL (one not under the current R2_PUBLIC_BASE_URL): we only
 * ever delete objects we own, and a base mismatch (e.g. a future media.corevo.se
 * migration) safely skips rather than mis-deriving a wrong key.
 */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  const base = publicBase()
  const u = url?.trim()
  if (!base || !u) return null
  const prefix = `${base}/`
  if (!u.startsWith(prefix)) return null
  return u.slice(prefix.length) || null
}

/**
 * Delete R2 objects by exact key and report whether every delete succeeded.
 * R2 delete is idempotent, so durable workers can safely retry a false result.
 */
export async function deleteR2Keys(keys: string[]): Promise<boolean> {
  const uniqueKeys = [...new Set(keys.filter(Boolean))]
  if (uniqueKeys.length === 0) return true
  const bucket = await getBucket()
  if (!bucket) return false
  let succeeded = true
  for (const key of uniqueKeys) {
    try {
      await bucket.delete(key)
    } catch (err) {
      succeeded = false
      logger.warn('r2.delete_failed', { key, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return succeeded
}

/** Best-effort delete of a single stored image by its public URL. */
export async function deleteByPublicUrl(url: string | null | undefined): Promise<void> {
  const key = keyFromPublicUrl(url)
  if (key) await deleteR2Keys([key])
}

/** Human-readable Swedish message for a non-ok upload reason. */
export function uploadErrorMessage(reason: Exclude<UploadResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'bad_type':
      return 'Bilden måste vara PNG, JPG, WEBP eller GIF.'
    case 'too_large':
      return 'Bilden är för stor (max 8 MB).'
    case 'no_public_base':
    case 'no_binding':
      return 'Bilduppladdning funkar inte i den här miljön (lokala dev-servern saknar R2) — gör bilduppladdningen på superbooking.corevo.se i stället. Övriga fält sparades.'
    default:
      return 'Uppladdningen misslyckades. Försök igen.'
  }
}
