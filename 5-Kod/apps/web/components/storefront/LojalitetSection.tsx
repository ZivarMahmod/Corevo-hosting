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
          <p
            role="status"
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-fg, #232520)',
              background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 30%, transparent)',
              borderRadius: 'var(--radius, 4px)',
              padding: '10px 14px',
            }}
          >
            Lojalitetsprogrammet är pausat just nu.
          </p>
        ) : null}

        {config.variant === 'stamp_card' ? (
          <ul
            aria-label={`Stämpelkort — samla ${config.stampGoal} stämplar`}
            style={{
              listStyle: 'none',
              margin: '28px 0 0',
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {Array.from({ length: config.stampGoal }).map((_, i) => (
              <li
                key={i}
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '2px dashed color-mix(in srgb, var(--color-fg, #232520) 28%, transparent)',
                  background: 'color-mix(in srgb, var(--color-fg, #232520) 3%, transparent)',
                }}
              />
            ))}
          </ul>
        ) : (
          <p
            style={{
              marginTop: 28,
              fontFamily: 'var(--font-display, var(--font-body))',
              fontSize: 22,
              lineHeight: 1.3,
              color: 'var(--color-fg, #232520)',
            }}
          >
            Tjäna{' '}
            <strong style={{ color: 'var(--color-accent, #C8A24A)' }}>
              {config.pointsPerVisit} poäng
            </strong>{' '}
            per besök.
          </p>
        )}

        {/* STATIC, inert CTA — membership/signup rails are not built yet, so this is
            a non-interactive server element that merely looks disabled (no onClick,
            no 'use client'). */}
        <p
          aria-disabled="true"
          style={{
            display: 'inline-block',
            marginTop: 24,
            fontFamily: 'var(--font-ui)',
            fontSize: 14,
            fontWeight: 600,
            color: 'color-mix(in srgb, var(--color-fg, #232520) 55%, transparent)',
            background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 14%, transparent)',
            borderRadius: 'var(--radius, 4px)',
            padding: '10px 18px',
            cursor: 'not-allowed',
          }}
        >
          Bli medlem
        </p>
      </div>
    </section>
  )
}
