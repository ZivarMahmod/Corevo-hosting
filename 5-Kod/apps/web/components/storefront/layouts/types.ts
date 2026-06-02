import type { Service, TenantLocation, StorefrontTheme } from '@/lib/tenant-data'
import type { ResolvedThemeContent } from '../theme-content'

/** Shared props every storefront layout receives from app/(public)/page.tsx. */
export type StorefrontLayoutProps = {
  tenant: { id: string; name: string; slug: string }
  theme: StorefrontTheme
  /** Resolved per-theme copy + media (owner uploads already merged in). */
  content: ResolvedThemeContent
  /** Real, active services (cheapest first). May be empty. */
  services: Service[]
  /** Real location + derived opening hours; null when the tenant has none. */
  location: TenantLocation | null
}
