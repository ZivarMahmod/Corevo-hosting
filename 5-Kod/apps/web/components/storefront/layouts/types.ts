import type { Service, TenantLocation, StorefrontTheme } from '@/lib/tenant-data'
import type { ShopProduct } from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ResolvedThemeContent } from '../theme-content'

/**
 * Förladdade modul-teasers för teman som väver in butik/blogg/presentkort i sitt
 * eget formspråk (S10). Laddas server-side i app/(public)/page.tsx
 * (loadLayoutModuleTeasers) och skickas som prop så layouterna förblir SYNKRONA
 * — onboarding-studions klient-preview (StorefrontPreview) renderar samma
 * komponenter och kan inte rendera async-komponenter. Utelämnad (preview) →
 * inga modulsektioner, vilket är rätt: previewn har egna modul-mockar.
 */
export type LayoutModuleTeasers = {
  /** Max 3 produkter när shop-modulen är live; annars tom. */
  shopTeasers: ShopProduct[]
  /** Max 3 publicerade inlägg när blogg-modulen är live; annars tom. */
  bloggTeasers: BloggPost[]
  /** true när presentkort-modulen är live (→ smal band-rad). */
  presentkortLive: boolean
  /** true när /shop går att nå (live ELLER paused) — floras pelar-gating (S9). */
  shopReachable: boolean
  /** true när /offert går att nå (live ELLER paused) — floras pelar-gating (S9). */
  offertReachable: boolean
}

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
  /** Invävda modul-teasers (S10) — se LayoutModuleTeasers. */
  modules?: LayoutModuleTeasers
}
