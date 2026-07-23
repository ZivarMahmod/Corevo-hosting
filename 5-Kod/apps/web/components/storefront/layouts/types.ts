import type { Service, TenantContact, TenantLocation, StorefrontTheme } from '@/lib/tenant-data'
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
  /** true när /boka får nås (live eller paused; off/draft döljs). */
  bookingReachable: boolean
  /** Max 3 produkter när shop-modulen är live; annars tom. */
  shopTeasers: ShopProduct[]
  /** Max 3 publicerade inlägg när blogg-modulen är live; annars tom. */
  bloggTeasers: BloggPost[]
  /** true när /presentkort renderar (live/paused + läsbar config). */
  presentkortReachable: boolean
  /** true när /shop går att nå och har minst en aktiv produkt. */
  shopReachable: boolean
  /** true när /blogg går att nå och har minst ett publicerat inlägg. */
  bloggReachable: boolean
  /** true när /offert renderar (live/paused + läsbar config). */
  offertReachable: boolean
  /**
   * goal-64: true när /klubb går att nå (lojalitet live ELLER paused).
   *
   * Klubben fick ingen route förrän nu, så mallar som HAR den (Onyx "Kretsen", Auroras
   * klubbband, Siluetts "Första raden") tvingades rendera den som olänkad text — en länk
   * hade blivit en 404. Nu finns sidan, men gaten är fortfarande helig: lojalitet av →
   * NOLL länkar dit. Flaggan är hela skillnaden mellan en länk och en 404-fälla.
   */
  lojalitetReachable: boolean
  /** true när /kurser renderar och har minst ett kommande öppet tillfälle. */
  kurserReachable: boolean
  /** true när /galleri renderar och har minst en aktiv bild. */
  galleriReachable: boolean
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
  /** Real tenant contact. Optional for older/onboarding preview callers. */
  contact?: TenantContact
  /** Real tenant social links. Optional for older/onboarding preview callers. */
  social?: { instagram: string | null; facebook: string | null; tiktok: string | null }
  /** Invävda modul-teasers (S10) — se LayoutModuleTeasers. */
  modules?: LayoutModuleTeasers
}
