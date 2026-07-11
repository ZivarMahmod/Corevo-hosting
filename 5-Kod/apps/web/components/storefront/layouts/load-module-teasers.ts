// S10 (goal-54 körning 6) — server-side laddning av modul-teasers för teman som
// ÄGER sina moduler (salvia/leander/zigge): butik/blogg/presentkort vävs in i
// temats eget formspråk inne i layouten istället för den generiska
// StorefrontModuleSections-stapeln. Laddas i app/(public)/page.tsx och skickas
// som `modules`-prop så layouterna förblir synkrona (onboarding-studions
// klient-preview renderar samma komponenter — async-layouter kraschar den).
// Gating följer modulens livscykel: bara LIVE moduler laddas/renderas; tomma
// moduler → tomma listor → sektionen renderas inte.

import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import type { LayoutModuleTeasers } from './types'

export async function loadLayoutModuleTeasers(
  tenantId: string,
  slug: string,
): Promise<LayoutModuleTeasers> {
  const moduleStates = await getTenantModuleStates(tenantId, slug)
  const shopLive = isModuleLive(moduleStates, 'shop')
  const bloggLive = isModuleLive(moduleStates, 'blogg')
  const presentkortLive = isModuleLive(moduleStates, 'presentkort')
  const [shopData, bloggData] = await Promise.all([
    shopLive ? loadShopData(tenantId, slug) : Promise.resolve(null),
    bloggLive ? loadBloggData(tenantId, slug) : Promise.resolve(null),
  ])
  // Reachability (floras pelare, S9): en länk får bara visas dit en sida faktiskt
  // finns — live/paused renderar; av/draft → notFound (404-fälla).
  const reachable = (key: 'shop' | 'offert') =>
    isModuleLive(moduleStates, key) || isModulePaused(moduleStates, key)
  return {
    shopTeasers: (shopData?.products ?? []).slice(0, 3),
    bloggTeasers: (bloggData?.posts ?? []).slice(0, 3),
    presentkortLive,
    shopReachable: reachable('shop'),
    offertReachable: reachable('offert'),
  }
}
