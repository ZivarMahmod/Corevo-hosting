import type { TenantBranding } from '@corevo/ui'

/**
 * Shared branding-merge helper (B1).
 *
 * tenant_settings.branding (jsonb) is ONE object that several actions co-own:
 *   - M6 saveBranding         → colours, font, logo, accent
 *   - M6 saveStorefrontMedia  → hero/gallery/about/closing/team/stats
 *   - M7 savePlatformBranding → colours, font, logo (platform-side edit)
 *
 * Each action only ever sets ITS slice. The previous data-loss bug was M7 building
 * a fresh object and upserting the whole `branding` column — that wiped the owner's
 * storefront media (hero/gallery/about/closing/team/stats) and `color_accent`,
 * because they were absent from M7's object. This helper makes the safe merge the
 * ONLY way to compute a new branding object: spread `prev`, then apply only the
 * fields the patch actually sets.
 *
 * Contract (mirrors the task wording "behåll alla prev-fält, skriv bara de fält
 * patchen sätter"):
 *   - patch key `undefined`  → field NOT set → keep prev's value
 *   - patch key `null`       → explicit clear (e.g. logo removed) → write null
 *   - patch key with a value → write the value
 *
 * Never replaces the whole object. Pure (no I/O) → trivially unit-testable.
 */
export function mergeBranding(
  prev: TenantBranding | null | undefined,
  patch: Partial<TenantBranding>,
): TenantBranding {
  const out: TenantBranding = { ...(prev ?? {}) }
  for (const [key, value] of Object.entries(patch)) {
    // Skip keys the patch did not set (undefined) so they fall through to prev.
    // `null` is a deliberate value (clear the slot) and is written through.
    if (value !== undefined) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}
