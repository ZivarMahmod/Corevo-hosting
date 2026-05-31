import type { TenantBranding } from '@corevo/ui'

export type BrandTenant = { id: string; name: string; slug: string }

/** Props shared by every theme-variant component (nav, hero, …). */
export type BrandProps = { tenant: BrandTenant; branding: TenantBranding }
