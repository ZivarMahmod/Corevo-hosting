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
  const base = publicBase()
  if (!base) return { ok: false, reason: 'no_public_base' }

  const bucket = await getBucket()
  if (!bucket) return { ok: false, reason: 'no_binding' }

  const key = `${keyPrefix.replace(/^\/+|\/+$/g, '')}/${crypto.randomUUID()}.${ext}`
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
 * `${publicBase()}/${key}` that uploadImage produces. Returns null for a blank,
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
 * PURE: the R2 keys referenced in `oldUrls` that are no longer referenced in
 * `newUrls`. Kept URLs and foreign/non-bucket URLs are excluded; the result is
 * de-duplicated. No I/O — trivially unit-testable.
 */
export function removedImageKeys(
  oldUrls: Array<string | null | undefined>,
  newUrls: Array<string | null | undefined>,
): string[] {
  const keep = new Set(newUrls.filter((u): u is string => !!u))
  const keys: string[] = []
  const seen = new Set<string>()
  for (const u of oldUrls) {
    if (!u || keep.has(u)) continue
    const key = keyFromPublicUrl(u)
    if (key && !seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

/** Best-effort delete of R2 objects by key. Never throws — a delete failure (or a
 *  missing binding in dev) logs and is swallowed. */
async function deleteKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const bucket = await getBucket()
  if (!bucket) return
  for (const key of keys) {
    try {
      await bucket.delete(key)
    } catch (err) {
      logger.warn('r2.delete_failed', { key, error: err instanceof Error ? err.message : String(err) })
    }
  }
}

/** Best-effort delete of a single stored image by its public URL. */
export async function deleteByPublicUrl(url: string | null | undefined): Promise<void> {
  const key = keyFromPublicUrl(url)
  if (key) await deleteKeys([key])
}

/**
 * Delete every bucket object referenced in `oldUrls` but no longer in `newUrls`
 * (FX-14 replace-don't-accumulate). Best-effort: never throws, so cleanup can
 * never block a save that already succeeded. Call AFTER the DB upsert, scoped to
 * the slots the action actually owns (e.g. logo-only for branding saves).
 */
export async function pruneRemovedImages(
  oldUrls: Array<string | null | undefined>,
  newUrls: Array<string | null | undefined>,
): Promise<void> {
  await deleteKeys(removedImageKeys(oldUrls, newUrls))
}

/** Human-readable Swedish message for a non-ok upload reason. */
export function uploadErrorMessage(reason: Exclude<UploadResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'bad_type':
      return 'Bilden måste vara PNG, JPG, WEBP, SVG eller GIF.'
    case 'too_large':
      return 'Bilden är för stor (max 8 MB).'
    case 'no_public_base':
    case 'no_binding':
      return 'Bilduppladdning funkar inte i den här miljön (lokala dev-servern saknar R2) — gör bilduppladdningen på superbooking.corevo.se i stället. Övriga fält sparades.'
    default:
      return 'Uppladdningen misslyckades. Försök igen.'
  }
}
