import { motiontestAuthorityKind } from './motiontest-request-boundary.mjs'

export { isMotiontestPublicPath } from './motiontest-request-boundary.mjs'

export type StorefrontExperience = 'freshcut-motiontest' | null

export function storefrontExperienceFromHeader(
  value: string | null | undefined,
): StorefrontExperience {
  return value === 'freshcut-motiontest' ? value : null
}

type StorefrontExperienceResolution = {
  experience: Exclude<StorefrontExperience, null>
  tenantSlug: 'freshcut-motiontest'
}

export function storefrontExperienceForHost(
  host: string | null | undefined,
): StorefrontExperienceResolution | null {
  if (!motiontestAuthorityKind(host)) return null
  return { experience: 'freshcut-motiontest', tenantSlug: 'freshcut-motiontest' }
}
