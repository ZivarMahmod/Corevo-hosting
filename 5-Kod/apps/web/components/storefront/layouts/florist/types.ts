import type { ComponentType } from 'react'
import type { ResolvedThemeContent } from '@/lib/storefront/theme-content.types'
import type { Service, TenantLocation, TenantContact } from '@/lib/tenant-data'
import type {
  ShopData,
  ShopConfig,
  ShopProduct,
  ShopFulfilment,
  ShippingOption,
  ShopPaymentMethod,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { LojalitetConfig, LoyaltyPlan } from '@/lib/storefront/lojalitet/types'
import type { GalleryItem } from '@/lib/storefront/galleri/types'
import type { OffertConfig } from '@/lib/storefront/offert/types'
import type { PresentkortConfig } from '@/lib/storefront/presentkort/types'
import type { UpcomingEvent, KurserConfig } from '@/lib/storefront/kurser/types'
import type { TeamMember } from '@/lib/storefront/team/types'
import type { TenantBranding } from '@corevo/ui'
import type { LayoutModuleTeasers } from '../types'
export type ThemeNavProps = {
  tenant: {
    id: string
    name: string
    slug: string
  }
  branding: TenantBranding
  links: readonly {
    href: string
    label: string
  }[]
  primaryCta: {
    label: string
    href: string
  } | null
  cartEnabled: boolean
  customerAccountsEnabled: boolean
  utilityText: string
  location?: TenantLocation | null
  contact?: TenantContact
}
export type ThemeFooterProps = {
  tenant: {
    id: string
    name: string
    slug: string
  }
  tagline: string
  location: TenantLocation | null
  contact: TenantContact
  social: {
    instagram: string | null
    facebook: string | null
    tiktok: string | null
  }
  links: readonly {
    href: string
    label: string
  }[]
}
export type ThemePageProps = {
  tenant: {
    id: string
    name: string
    slug: string
  }
  content: ResolvedThemeContent
  services: Service[]
  location: TenantLocation | null
  contact: TenantContact
  modules?: Pick<LayoutModuleTeasers, 'bookingReachable' | 'offertReachable'>
}
export type ThemeChrome = {
  Nav?: ComponentType<ThemeNavProps>
  Footer?: ComponentType<ThemeFooterProps>
  ownsUtility?: boolean
}
export type ThemeShopViewProps = {
  data: ShopData
  limit?: number
  moreHref?: string
  content: ResolvedThemeContent
  tenantName: string
}
export type ThemeBloggViewProps = {
  posts: BloggPost[]
  limit?: number
  moreHref?: string
  content: ResolvedThemeContent
  tenantName: string
}
export type ThemeProductViewProps = {
  config: ShopConfig
  product: ShopProduct
}
export type ThemeCartViewProps = Record<string, never>
export type ThemeCheckoutViewProps = {
  fulfilment: ShopFulfilment
  shippingOptions: ShippingOption[]
  paymentMethods: ShopPaymentMethod[]
}
export type ThemeLojalitetViewProps = {
  config: LojalitetConfig
  plans: LoyaltyPlan[]
  content: ResolvedThemeContent
  tenantName: string
}
export type ThemeGalleriViewProps = {
  items: GalleryItem[]
  content: ResolvedThemeContent
  tenantName: string
}
export type ThemeTeamViewProps = {
  members: TeamMember[]
  content: ResolvedThemeContent
  tenantName: string
}
export type ThemeOffertViewProps = {
  config: OffertConfig
}
export type ThemePresentkortViewProps = {
  config: PresentkortConfig
  purchaseClosed: boolean
  tenantName: string
}
export type ThemeKurserViewProps = {
  events: UpcomingEvent[]
  config: KurserConfig
  checkoutLive: boolean
}
export type ThemeModuleViews = {
  shop?: ComponentType<ThemeShopViewProps>
  blogg?: ComponentType<ThemeBloggViewProps>
  offert?: ComponentType<ThemeOffertViewProps>
  presentkort?: ComponentType<ThemePresentkortViewProps>
  kurser?: ComponentType<ThemeKurserViewProps>
  lojalitet?: ComponentType<ThemeLojalitetViewProps>
  galleri?: ComponentType<ThemeGalleriViewProps>
  team?: ComponentType<ThemeTeamViewProps>
  product?: ComponentType<ThemeProductViewProps>
  cart?: ComponentType<ThemeCartViewProps>
  checkout?: ComponentType<ThemeCheckoutViewProps>
}
export type ThemePages = {
  om?: ComponentType<ThemePageProps>
  tjanster?: ComponentType<ThemePageProps>
  kontakt?: ComponentType<ThemePageProps>
}
