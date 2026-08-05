// Subdomain-slug validation for platform tenant creation (G08 / M7).
// Pure + dependency-light so it can be unit-tested and reused server-side.
//
// A valid tenant slug becomes <slug>.corevo.se, so it must be a DNS label AND
// must NOT collide with a reserved subdomain (booking/admin/app/www/api/…) that
// getTenantFromHost would never resolve to a tenant. Reserved list is imported
// from lib/tenant (single source) so the two can never drift apart.
import { RESERVED_SUBDOMAINS } from '@/lib/tenant'

export type SlugCheck = { ok: true; slug: string } | { ok: false; reason: string }

// DNS label: 1–63 chars, lowercase alnum + hyphen, no leading/trailing hyphen.
const DNS_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/** Normalize raw input to a candidate slug (lowercase, trimmed). */
export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase()
}

/** True if the slug is reserved (never resolves to a tenant — POS/platform names). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SUBDOMAINS.includes(normalizeSlug(slug))
}

/**
 * Validate a candidate tenant slug. Returns the normalized slug on success, or a
 * human-readable Swedish reason on failure. Uniqueness is enforced separately by
 * the DB unique constraint (handled in the create action).
 */
export function validateSlug(raw: string): SlugCheck {
  const slug = normalizeSlug(raw)
  if (!slug) return { ok: false, reason: 'Ange en subdomän.' }
  if (slug.length < 2) return { ok: false, reason: 'Subdomänen måste vara minst 2 tecken.' }
  if (slug.length > 63) return { ok: false, reason: 'Subdomänen får vara högst 63 tecken.' }
  if (!DNS_LABEL_RE.test(slug))
    return {
      ok: false,
      reason: 'Endast a–z, 0–9 och bindestreck (ej först/sist). T.ex. "frisor3".',
    }
  if (isReservedSlug(slug))
    return { ok: false, reason: `"${slug}" är reserverad och kan inte användas.` }
  return { ok: true, slug }
}
