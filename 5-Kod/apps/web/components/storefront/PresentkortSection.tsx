// Presentkort storefront SECTION (multi-bransch spår 5, §15 skelett vs skin).
//
// SERVER component. The SECTION reads module data (resolved config via
// loadPresentkortData); the TEMPLATE/skin gives the look. Per §15: "funktioner bor i
// MODULEN, inte i mallen" — this section IS the presentkort module's storefront
// surface, injected at the module's default_section_position ('main', per 0036). It
// styles itself with the storefront design tokens (var(--color-*) / var(--font-*)),
// the SAME token-driven approach as ShopSection / BloggSection / LojalitetSection —
// no new palette, so it blends into whichever skin the tenant runs.
//
// GATING (caller contract): render this ONLY when the tenant's presentkort module is
// LIVE. The call site (storefront page) resolves tenant_modules.state via
// getTenantModuleStates() + isModuleLive(states,'presentkort') and renders
// <PresentkortSection> only then — EXACTLY the booking + shop + offert + blogg +
// lojalitet gate shape. draft/off never reach here; a PAUSED presentkort renders the
// section with a paused notice — same contract as the booking paused banner / paused
// blogg / paused lojalitet.
//
// FULFILMENT VARIANTS (config-first, beslut 14.5): the section behaves per the
// resolved variant via the pure helpers in lib/storefront/presentkort/types.ts:
//   digital  → "Skickas direkt till mottagarens mejl".
//   physical → "Hämtas i butik".
// No `if (bransch)` anywhere — only the variant drives the difference.
//
// Gift-card purchase is shown only when the shared shop/checkout rail is live.

import Link from 'next/link'
import { SectionHeader } from './sections'
import { GiftCardBuy } from './shop/GiftCardBuy'
import s from './promo-section.module.css'
import {
  presentkortFulfilmentLabel,
  type PresentkortData,
} from '@/lib/storefront/presentkort/types'
import { loadPresentkortData } from '@/lib/storefront/presentkort/load-presentkort'

/** Resolve + render the presentkort section for one tenant. Returns null when there
 *  is nothing to show (no presentkort module row) so the caller can compose
 *  unconditionally. `paused` renders a paused notice over the promo. */
export async function PresentkortSection({
  tenantId,
  slug,
  paused = false,
  checkoutLive = false,
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='presentkort' is 'paused' → promo shown, paused. */
  paused?: boolean
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

        {paused ? (
          <p role="status" className={s.notice}>
            Presentkort är pausade just nu.
          </p>
        ) : null}

        {/* Pausad presentkortmodul eller stängd checkout → ingen köpyta. */}
        {!paused && checkoutLive && config.amountPresets.length > 0 ? (
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
