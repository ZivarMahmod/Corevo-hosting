// Lojalitet storefront SECTION (multi-bransch spår 5, §15 skelett vs skin).
//
// SERVER component. The SECTION reads module data (resolved config via
// loadLojalitetData); the TEMPLATE/skin gives the look. Per §15: "funktioner bor i
// MODULEN, inte i mallen" — this section IS the lojalitet module's storefront
// surface, injected at the module's default_section_position ('main', per 0035). It
// styles itself with the storefront design tokens (var(--color-*) / var(--font-*)),
// the SAME token-driven approach as ShopSection / BloggSection — no new palette, so
// it blends into whichever skin the tenant runs.
//
// GATING (caller contract): render this ONLY when the tenant's lojalitet module is
// LIVE. The call site (storefront page) resolves tenant_modules.state via
// getTenantModuleStates() + isModuleLive(states,'lojalitet') and renders
// <LojalitetSection> only then — EXACTLY the booking + shop + offert + blogg gate
// shape. draft/off never reach here; a PAUSED lojalitet renders the section with a
// paused notice — same contract as the booking paused banner / paused blogg.
//
// PRESENTATION VARIANTS (config-first, beslut 14.5): the section behaves per the
// resolved variant via the pure helpers in lib/storefront/lojalitet/types.ts:
//   points     → visa poäng-program (tjäna X poäng per besök).
//   stamp_card → stämpelkort (rita stampGoal tomma stämpel-cirklar).
// No `if (bransch)` anywhere — only the variant drives the difference.
//
// NO PAYMENT (unlike shop/offert): loyalty points never touch direct money, so
// there is no pay step, no order — nothing money-bearing in this surface. The
// "Bli medlem"-CTA is a STATIC, inert server element (no onClick, no 'use client',
// aria-disabled) because the membership/signup rails are not built yet.

import { SectionHeader } from './sections'
import s from './promo-section.module.css'
import { lojalitetVariantLabel, type LojalitetData } from '@/lib/storefront/lojalitet/types'
import { loadLojalitetData } from '@/lib/storefront/lojalitet/load-lojalitet'

/** Resolve + render the lojalitet section for one tenant. Returns null when there
 *  is nothing to show (no lojalitet module row) so the caller can compose
 *  unconditionally. `paused` renders a paused notice over the promo. */
export async function LojalitetSection({
  tenantId,
  slug,
  paused = false,
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='lojalitet' is 'paused' → promo shown, paused. */
  paused?: boolean
}) {
  const data: LojalitetData | null = await loadLojalitetData(tenantId, slug)
  if (!data) return null

  const { config } = data

  return (
    <section className="section" data-module="lojalitet" data-variant={config.variant}>
      <div className="section-inner">
        <SectionHeader
          eyebrow={`— Lojalitet · ${lojalitetVariantLabel(config.variant)}`}
          title={config.headline}
          lead={config.perkText}
        />

        {paused ? (
          <p role="status" className={s.notice}>
            Lojalitetsprogrammet är pausat just nu.
          </p>
        ) : null}

        {config.variant === 'stamp_card' ? (
          <ul
            aria-label={`Stämpelkort — samla ${config.stampGoal} stämplar`}
            className={s.stamps}
          >
            {Array.from({ length: config.stampGoal }).map((_, i) => (
              <li key={i} aria-hidden="true" className={s.stamp} />
            ))}
          </ul>
        ) : (
          <p className={s.points}>
            Tjäna <strong className={s.pointsFigure}>{config.pointsPerVisit} poäng</strong> per
            besök.
          </p>
        )}

        {/* STATIC, inert CTA — membership/signup rails are not built yet, so this is
            a non-interactive server element that merely looks disabled (no onClick,
            no 'use client'). goal-60: den bär köpknappens form (--sf-btn-*) i sitt
            OTILLGÄNGLIGA läge — mätt ink, aldrig opacity — så den ser ut att höra
            hemma i mallen utan att ljuga om att den går att klicka. */}
        <p aria-disabled="true" className={`${s.cta} ${s.ctaInert}`}>
          Bli medlem
        </p>
      </div>
    </section>
  )
}
