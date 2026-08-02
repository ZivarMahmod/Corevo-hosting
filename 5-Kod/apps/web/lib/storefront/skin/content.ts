import { applySkinOverlay } from './overlay'
import { loadTenantSkin } from './load-skin'
import { SALVIA_REGION_MANIFEST } from './salvia-manifest'

export async function resolveStorefrontSkinContent(
  tenantId: string,
  theme: string,
  copy: Record<string, unknown> | null | undefined,
  branding: Record<string, unknown> | null | undefined,
): Promise<{ copy: Record<string, unknown>; branding: Record<string, unknown> }> {
  if (theme !== 'salvia') return { copy: { ...(copy ?? {}) }, branding: { ...(branding ?? {}) } }

  const skin = await loadTenantSkin(tenantId, theme)
  return skin?.hasTenantContent
    ? applySkinOverlay(skin, SALVIA_REGION_MANIFEST, copy, branding)
    : { copy: { ...(copy ?? {}) }, branding: { ...(branding ?? {}) } }
}
