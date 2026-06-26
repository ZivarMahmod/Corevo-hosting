// Shared storefront module sections (shop/offert/blogg/lojalitet/presentkort), gated
// by the tenant's per-module lifecycle. Extracted so BOTH the theme storefront and a
// goal-50 render-bron LOOK render the SAME live modules below the page — "lägg modul →
// vävs in i den valda mallen, live" holds for every module, not just booking.
//
// Each <Section> self-resolves to null when the tenant has no module config, so this is
// safe to mount whenever. A LIVE module renders its section; 'paused' renders it
// read-only (closed-state) via `paused`; draft/off stay invisible.
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { ShopSection } from '@/components/storefront/ShopSection'
import { OffertSection } from '@/components/storefront/OffertSection'
import { BloggSection } from '@/components/storefront/BloggSection'
import { LojalitetSection } from '@/components/storefront/LojalitetSection'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'

export async function StorefrontModuleSections({ tenantId, slug }: { tenantId: string; slug: string }) {
  const moduleStates = await getTenantModuleStates(tenantId, slug)
  const shopLive = isModuleLive(moduleStates, 'shop')
  const shopPaused = isModulePaused(moduleStates, 'shop')
  const offertLive = isModuleLive(moduleStates, 'offert')
  const offertPaused = isModulePaused(moduleStates, 'offert')
  const bloggLive = isModuleLive(moduleStates, 'blogg')
  const bloggPaused = isModulePaused(moduleStates, 'blogg')
  const lojalitetLive = isModuleLive(moduleStates, 'lojalitet')
  const lojalitetPaused = isModulePaused(moduleStates, 'lojalitet')
  const presentkortLive = isModuleLive(moduleStates, 'presentkort')
  const presentkortPaused = isModulePaused(moduleStates, 'presentkort')

  return (
    <>
      {shopLive || shopPaused ? <ShopSection tenantId={tenantId} slug={slug} paused={shopPaused} /> : null}
      {offertLive || offertPaused ? <OffertSection tenantId={tenantId} slug={slug} paused={offertPaused} /> : null}
      {bloggLive || bloggPaused ? <BloggSection tenantId={tenantId} slug={slug} paused={bloggPaused} /> : null}
      {lojalitetLive || lojalitetPaused ? (
        <LojalitetSection tenantId={tenantId} slug={slug} paused={lojalitetPaused} />
      ) : null}
      {presentkortLive || presentkortPaused ? (
        <PresentkortSection tenantId={tenantId} slug={slug} paused={presentkortPaused} />
      ) : null}
    </>
  )
}
