/**
 * Storefront copy persisted under `tenant_settings.settings.copy`.
 *
 * This is the single pure owner for the persisted shape, its whitelist and the
 * merge/sanitizing rules. Theme rendering consumes the result; it does not own
 * the data contract.
 */
/** Whitelist shared by tenant copy and vertical default copy. */
export const COPY_OVERRIDE_KEYS = [
  'heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'aboutCopyHome', 'tagline', 'utility',
  'italic', 'aboutTitle', 'homeSecondTitle', 'whyTitle', 'whySub', 'whyBody',
  'servicesEyebrow', 'servicesTitle', 'servicesIntro', 'teamEyebrow', 'teamTitle',
  'teamLead', 'closingEyebrow', 'closingTitle', 'closingLede', 'contactEyebrow',
  'contactTitle',
  'pillar1Title', 'pillar1Body', 'pillar1Link',
  'pillar2Title', 'pillar2Body', 'pillar2Link',
  'pillar3Title', 'pillar3Body', 'pillar3Link',
  'shopEyebrow', 'shopTitle', 'shopCta',
  'blogEyebrow', 'blogTitle', 'blogCta',
  'giftEyebrow', 'giftLede', 'giftCta',
  'homeGalleryEyebrow', 'galleryEyebrow', 'findEyebrow',
  'clubEyebrow', 'clubTitle', 'clubLede', 'clubCta', 'clubNote',
  'galleryTitle', 'galleryLede',
  'resultsEyebrow', 'resultsLede',
  'resultImage1Caption', 'resultImage2Caption', 'resultImage3Caption',
  'studioImageCaption', 'studioEyebrow', 'studioPoint1', 'studioPoint2', 'studioPoint3',
  'contactLede',
  'aboutFact1Value', 'aboutFact1Label', 'aboutFact2Value', 'aboutFact2Label',
  'aboutFact3Value', 'aboutFact3Label',
] as const

export type CopyOverride = Partial<Record<(typeof COPY_OVERRIDE_KEYS)[number], string>>

/** Keep only known, non-empty string values within the persisted size limit. */
export function cleanCopyOverride(raw: unknown): CopyOverride {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  const record = raw as Record<string, unknown>
  for (const key of COPY_OVERRIDE_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0 && value.length <= 4000) {
      out[key] = value
    }
  }
  return out as CopyOverride
}

/** Merge vertical defaults underneath the tenant's non-empty values. */
export function layerCopy(
  verticalCopy: CopyOverride,
  tenantCopy: CopyOverride | null | undefined,
): CopyOverride | null {
  const tenant = (tenantCopy ?? {}) as Record<string, unknown>
  const merged: Record<string, string> = { ...(verticalCopy as Record<string, string>) }
  for (const key of COPY_OVERRIDE_KEYS) {
    const value = tenant[key]
    if (typeof value === 'string' && value.trim().length > 0) merged[key] = value
  }
  return Object.keys(merged).length > 0 ? (merged as CopyOverride) : null
}
