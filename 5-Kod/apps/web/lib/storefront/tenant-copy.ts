import 'server-only'
import { materializeThemeCopy } from '@/lib/storefront/theme-content'
import { layerCopy, type CopyOverride } from '@/lib/storefront/theme-copy'
import { getVerticalCopy } from '@/lib/storefront/vertical-copy'
import { themeOwnsCopy } from '@/lib/platform/theme-capabilities'
import type { StorefrontTheme, TenantBundle } from '@/lib/tenant-data'

/**
 * Resolve the already loaded tenant bundle's owner, branch and theme copy layers.
 * `getTenantBySlug` owns the tenant_settings read; this function owns only copy policy.
 */
export async function getTenantCopy(
  bundle: {
    tenant: Pick<TenantBundle['tenant'], 'vertical_id'>
    settings: Pick<TenantBundle['settings'], 'theme' | 'copy'>
  },
  themeOverride: StorefrontTheme | null = null,
  copyMode: 'keep' | 'template' | null = null,
): Promise<CopyOverride | null> {
  const { tenant, settings } = bundle
  const storedCopy = settings.copy && typeof settings.copy === 'object'
    ? settings.copy as CopyOverride
    : null
  if (themeOverride && copyMode === 'template') return null
  if (themeOverride && copyMode === 'keep') {
    const effective = themeOwnsCopy(settings.theme)
      ? storedCopy
      : layerCopy(await getVerticalCopy(tenant.vertical_id ?? null), storedCopy)
    return materializeThemeCopy(settings.theme, effective)
  }
  const theme = themeOverride ?? settings.theme
  if (themeOwnsCopy(theme)) return storedCopy
  return layerCopy(await getVerticalCopy(tenant.vertical_id ?? null), storedCopy)
}
