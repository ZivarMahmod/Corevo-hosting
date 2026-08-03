// Shared storefront module sections (shop/kurser/blogg/offert/presentkort/lojalitet/galleri), gated
// by the tenant's per-module lifecycle. Extracted so BOTH the theme storefront and a
// goal-50 render-bron LOOK render the SAME live modules below the page — "lägg modul →
// vävs in i den valda mallen, live" holds for every module, not just booking.
//
// Each <Section> self-resolves to null when the tenant has no module config, so this is
// safe to mount whenever. A LIVE module renders its section; 'paused' renders it
// read-only (closed-state) via `paused`; draft/off stay invisible.
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { ShopSection } from '@/components/storefront/ShopSection'
import { OffertSection } from '@/components/storefront/OffertSection'
import { BloggSection } from '@/components/storefront/BloggSection'
import { LojalitetSection } from '@/components/storefront/LojalitetSection'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'
import { KurserSection } from '@/components/storefront/kurser/KurserSection'
import { GalleriSection } from '@/components/storefront/galleri/GalleriSection'
import { commerceReleaseGate } from '@/lib/release/commerce'

/**
 * `variant`:
 *  - 'full' (default, bakåtkompatibelt): hela sektionerna — används av modulernas
 *    EGNA sidor och render-bron-looks.
 *  - 'teaser' (startsidan): modulerna har egna hem (/shop, /kurser, /blogg,
 *    /offert, /presentkort, /galleri) — hemmet visar bara ett smakprov + länk dit.
 */
export async function StorefrontModuleSections({
  tenantId,
  slug,
  variant = 'full',
}: {
  tenantId: string
  slug: string
  variant?: 'full' | 'teaser'
}) {
  const teaser = variant === 'teaser'
  const moduleStates = await getTenantModuleStates(tenantId, slug)
  const shopLive = isModuleLive(moduleStates, 'shop')
  const checkoutLive = shopLive && commerceReleaseGate(tenantId).shop
  const kurserLive = isModuleLive(moduleStates, 'kurser')
  const bloggLive = isModuleLive(moduleStates, 'blogg')
  const offertLive = isModuleLive(moduleStates, 'offert')
  const presentkortLive = isModuleLive(moduleStates, 'presentkort')
  const lojalitetLive = isModuleLive(moduleStates, 'lojalitet')
  const galleriLive = isModuleLive(moduleStates, 'galleri')

  return (
    <>
      {shopLive ? (
        <ShopSection
          tenantId={tenantId}
          slug={slug}
          paused={false}
          {...(teaser ? { limit: 3, moreHref: '/shop' } : {})}
        />
      ) : null}

      {kurserLive ? (
        <KurserSection
          tenantId={tenantId}
          slug={slug}
          paused={false}
          checkoutLive={checkoutLive}
          {...(teaser ? { limit: 3, moreHref: '/kurser' } : {})}
        />
      ) : null}

      {bloggLive ? (
        <BloggSection
          tenantId={tenantId}
          slug={slug}
          paused={false}
          {...(teaser ? { limit: 3, moreHref: '/blogg' } : {})}
        />
      ) : null}

      {offertLive ? (
        <OffertSection tenantId={tenantId} slug={slug} paused={false} teaser={teaser} />
      ) : null}

      {presentkortLive ? (
        <PresentkortSection
          tenantId={tenantId}
          slug={slug}
          paused={false}
          checkoutLive={checkoutLive}
        />
      ) : null}

      {lojalitetLive ? (
        <LojalitetSection tenantId={tenantId} slug={slug} paused={false} />
      ) : null}

      {galleriLive ? (
        <GalleriSection tenantId={tenantId} slug={slug} paused={false} />
      ) : null}
    </>
  )
}
