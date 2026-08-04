// Callers render this section only for a live presentkort module. Online purchase
// additionally requires the shared checkout rail.

import Link from 'next/link'
import { SectionHeader } from './sections'
import { GiftCardBuy } from './shop/GiftCardBuy'
import s from './promo-section.module.css'
import {
  presentkortFulfilmentLabel,
  type PresentkortData,
} from '@/lib/storefront/presentkort/types'
import { loadPresentkortData } from '@/lib/storefront/presentkort/load-presentkort'

/** Resolve + render the presentkort section for one live tenant module. */
export async function PresentkortSection({
  tenantId,
  slug,
  checkoutLive = false,
}: {
  tenantId: string
  slug: string
  /** Shopmodulen och dess releasegrind måste båda vara öppna för onlineköp. */
  checkoutLive?: boolean
}) {
  const data: PresentkortData | null = await loadPresentkortData(tenantId, slug)
  if (!data) return null

  const { config } = data

  // Short fulfilment promise shown under the header (mirrors shop's fulfilmentPromise).
  const fulfilmentLead =
    config.fulfilment === 'physical'
      ? 'Hämtas i butik.'
      : 'Skickas direkt till mottagarens mejl.'

  return (
    <section className="section" data-module="presentkort" data-fulfilment={config.fulfilment}>
      <div className="section-inner">
        <SectionHeader
          eyebrow={`— Presentkort · ${presentkortFulfilmentLabel(config.fulfilment)}`}
          title={config.headline}
          lead={fulfilmentLead}
        />

        {checkoutLive && config.amountPresets.length > 0 ? (
          <GiftCardBuy config={config} />
        ) : (
          <>
            <p className={s.lead}>
              Presentkort köper du i butiken — eller hör av dig så ordnar vi det.
            </p>
            <Link href="/kontakt" className={s.cta}>
              Kontakta oss
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
