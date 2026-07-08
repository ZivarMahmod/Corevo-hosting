// PURE module — no 'server-only', no 'use server'. Safe to import from both the
// server data/action layers AND the client MediaLibrary component. Holds the
// shared row/usage shapes, upload constraints, and pure formatting helpers for
// the customer-facing bildbibliotek (media_library module).
//
// Mirrors the lib/admin/<module>/types.ts convention (presentkort): typed rows
// the UI consumes + small pure helpers. Only TYPE imports are permitted here so
// the file never pulls a server-only dependency into a client bundle.

/** One image in a tenant's library — camelCase view of a media_assets row. */
export type MediaAssetRow = {
  id: string
  url: string
  r2Key: string
  type: string
  alt: string | null
  sizeBytes: number
  width: number | null
  height: number | null
  source: string
  createdAt: string
}

/** Storage consumption for a tenant: bytes used vs. the module's byte quota. */
export type StorageUsage = {
  usedBytes: number
  quotaBytes: number
}

/** Accept filter for the upload <input> — matches the image types R2 allows. */
export const MEDIA_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'

/** Per-file ceiling (8 MB) — mirrors uploadImage's MAX_BYTES in lib/r2/upload.ts. */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024

/**
 * Human-readable byte size, sv-SE. 1024-step units (B / kB / MB / GB). Whole
 * numbers print without decimals; fractional MB+ keep one decimal with a comma
 * decimal mark (sv-SE), e.g. 0 → "0 B", 819200 → "800 kB", 1468006 → "1,4 MB".
 * Pure + dependency-free so it is safe in any bundle.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  // Bytes are always whole; kB+ show one decimal only when it isn't a round number.
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-9
  const text = isWhole ? String(Math.round(rounded)) : rounded.toFixed(1).replace('.', ',')
  return `${text} ${units[unit]}`
}

/** Fraction of quota used, clamped to 0..100. 0 when quota is non-positive. */
export function usagePercent(u: StorageUsage): number {
  if (!u || !Number.isFinite(u.quotaBytes) || u.quotaBytes <= 0) return 0
  const pct = (u.usedBytes / u.quotaBytes) * 100
  if (!Number.isFinite(pct) || pct < 0) return 0
  return pct > 100 ? 100 : pct
}
