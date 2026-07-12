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
// ⚠ INERT — NO PAYMENT (compliance): a gift card touches money, but NO betal-rails
// are built (locked rule: no payment services without explicit OK). There is no pay
// step, no purchase, no order — nothing money-bearing happens in this surface, and
// it never reads the gift_cards table (codes/balances are private; the promo needs
// no row). The "Köp presentkort"-CTA is a STATIC, inert server element (no onClick,
// no 'use client', aria-disabled) because the purchase rails are not built yet.

import Link from 'next/link'
import { SectionHeader } from './sections'
import s from './promo-section.module.css'
import {
  presentkortFulfilmentLabel,
  formatGiftPrice,
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
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='presentkort' is 'paused' → promo shown, paused. */
  paused?: boolean
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

        {/* Amount presets shown as token-styled chips (whole kronor via formatGiftPrice). */}
        <ul aria-label="Belopp att välja mellan" className={s.chips}>
          {config.amountPresets.map((amount, i) => (
            <li key={i} className={s.chip}>
              {formatGiftPrice(amount, config.currency)}
            </li>
          ))}
        </ul>

        {/* Fulfilment row — how the gift card reaches the recipient (variant-driven). */}
        <p className={s.lead}>
          {config.fulfilment === 'physical'
            ? 'Hämtas i butik.'
            : 'Skickas direkt till mottagarens mejl.'}
        </p>

        {/* ÄRLIG CTA-rad (goal-55 P1): inga döda knappar. Online-köp finns inte
            (betal-rails pausade, compliance), så vi säger det rakt och ger EN riktig
            handling — kontakta oss. Fortsatt server-only, ingen 'use client'.
            goal-60: den är en KÖP-yta och bär därför köpknappens sex lägen via
            --sf-btn-* — samma kontrakt som AddToCart, inte en platt platta. */}
        <p className={s.lead}>
          Presentkort köper du i butiken — eller hör av dig så ordnar vi det.
        </p>
        <Link href="/kontakt" className={s.cta}>
          Kontakta oss
        </Link>
      </div>
    </section>
  )
}
