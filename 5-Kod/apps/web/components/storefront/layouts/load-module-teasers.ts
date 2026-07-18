// S10 (goal-54 körning 6) — server-side laddning av modul-teasers för teman som
// ÄGER sina moduler (salvia/leander/zigge): butik/blogg/presentkort vävs in i
// temats eget formspråk inne i layouten istället för den generiska
// StorefrontModuleSections-stapeln. Laddas i app/(public)/page.tsx och skickas
// som `modules`-prop så layouterna förblir synkrona (onboarding-studions
// klient-preview renderar samma komponenter — async-layouter kraschar den).
// Gating följer målrouten: live/paused kan renderas, off/draft aldrig. Moduler som
// kräver innehåll blir bara reachable när samma publika data faktiskt finns.

import { cache } from 'react'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { loadGalleriData } from '@/lib/storefront/galleri/load-galleri'
import { countUpcomingEvents } from '@/lib/storefront/kurser/load-kurser'
import { loadOffertData } from '@/lib/storefront/offert/load-offert'
import { loadPresentkortData } from '@/lib/storefront/presentkort/load-presentkort'
import { loadLojalitetData } from '@/lib/storefront/lojalitet/load-lojalitet'
import { commerceReleaseGate } from '@/lib/release/commerce'
import type { LayoutModuleTeasers } from './types'

export const EMPTY_LAYOUT_MODULE_TEASERS: LayoutModuleTeasers = {
  bookingReachable: false,
  shopTeasers: [],
  bloggTeasers: [],
  presentkortReachable: false,
  shopReachable: false,
  bloggReachable: false,
  offertReachable: false,
  lojalitetReachable: false,
  kurserReachable: false,
  galleriReachable: false,
}

async function safeLoad<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load()
  } catch {
    return fallback
  }
}

async function loadLayoutModuleTeasersUncached(
  tenantId: string,
  slug: string,
): Promise<LayoutModuleTeasers> {
  const moduleStates = await safeLoad(() => getTenantModuleStates(tenantId, slug), null)
  if (!moduleStates) return { ...EMPTY_LAYOUT_MODULE_TEASERS }

  const reachableState = (key: string) =>
    isModuleLive(moduleStates, key) || isModulePaused(moduleStates, key)
  const commerceRelease = commerceReleaseGate(tenantId)
  const bookingReachable = reachableState('booking')
  const shopStateReachable = commerceRelease.shop && reachableState('shop')
  const bloggStateReachable = reachableState('blogg')
  const offertStateReachable = reachableState('offert')
  const presentkortStateReachable = commerceRelease.presentkort && reachableState('presentkort')
  const lojalitetStateReachable = reachableState('lojalitet')
  const kurserStateReachable = reachableState('kurser')
  const galleriStateReachable = reachableState('galleri')
  const [shopData, bloggData, offertData, presentkortData, lojalitetData, eventCount, galleriData] = await Promise.all([
    shopStateReachable ? safeLoad(() => loadShopData(tenantId, slug), null) : null,
    bloggStateReachable ? safeLoad(() => loadBloggData(tenantId, slug), null) : null,
    offertStateReachable ? safeLoad(() => loadOffertData(tenantId, slug), null) : null,
    presentkortStateReachable ? safeLoad(() => loadPresentkortData(tenantId, slug), null) : null,
    lojalitetStateReachable ? safeLoad(() => loadLojalitetData(tenantId, slug), null) : null,
    kurserStateReachable ? safeLoad(() => countUpcomingEvents(tenantId, slug), 0) : 0,
    galleriStateReachable ? safeLoad(() => loadGalleriData(tenantId, slug), null) : null,
  ])
  const shopTeasers = (shopData?.products ?? []).slice(0, 3)
  const bloggTeasers = (bloggData?.posts ?? []).slice(0, 3)
  const presentkortReachable = presentkortStateReachable && presentkortData !== null
  return {
    bookingReachable,
    shopTeasers,
    bloggTeasers,
    presentkortReachable,
    shopReachable: shopStateReachable && shopTeasers.length > 0,
    bloggReachable: bloggStateReachable && bloggTeasers.length > 0,
    offertReachable: offertStateReachable && offertData !== null,
    lojalitetReachable: lojalitetStateReachable && lojalitetData !== null,
    kurserReachable: kurserStateReachable && eventCount > 0,
    galleriReachable: galleriStateReachable && (galleriData?.items.length ?? 0) > 0,
  }
}

/** Request-local deduplication: public layout and home page share this exact load. */
export const loadLayoutModuleTeasers = cache(loadLayoutModuleTeasersUncached)
