import { createPublicClient } from '@/lib/supabase/public'
import { GoogleReviewNudgePopup } from './GoogleReviewNudgePopup'

// ── Google-recensions-nudge POPUP (M4 §2.3 — Zivars beslut) ──────────────────
// A dismissible popup shown on the booking CONFIRMATION step, DECOUPLED from
// payment (it shows regardless of whether the booking was paid). It opens the
// salon's linked Google review page. This is a SEPARATE surface from the existing
// email nudge (lib/notifications/google-review.ts, fires on status=completed) —
// both are kept; this one nudges at booking time per Zivar's decision.
//
// Mounted on app/boka/bekraftelse/[id] (the one allowed touch outside this revir).
// To keep that touch to a single import + tag, this server component does its own
// anon read of the review URL (tenant_settings is anon-readable for active tenants,
// migration 0004:45) and renders NOTHING when the owner has not set a URL — exactly
// the graceful no-op the email channel uses.
//
// Resolves the tenant by the SLUG returned by get_public_booking (the confirmation
// page already has it), so no extra header/tenant plumbing is needed.

/** Anon read of settings.google_review_url for an active tenant by slug. Returns
 *  null (→ render nothing) when unset/blank/non-http. */
async function getReviewUrlBySlug(slug: string): Promise<string | null> {
  const supabase = createPublicClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug.trim().toLowerCase())
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null

  const { data } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  const settings = (data?.settings ?? {}) as Record<string, unknown>
  const raw = settings.google_review_url
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (!url || !/^https?:\/\//i.test(url)) return null
  return url
}

export async function GoogleReviewNudge({
  tenantSlug,
  tenantName,
  bookingId,
}: {
  tenantSlug: string | null | undefined
  tenantName: string | null | undefined
  /** Per-booking dismissal key so it doesn't re-nag on the same confirmation. */
  bookingId: string
}) {
  if (!tenantSlug) return null
  const reviewUrl = await getReviewUrlBySlug(tenantSlug)
  if (!reviewUrl) return null

  return (
    <GoogleReviewNudgePopup
      reviewUrl={reviewUrl}
      tenantName={tenantName ?? 'salongen'}
      bookingId={bookingId}
    />
  )
}
