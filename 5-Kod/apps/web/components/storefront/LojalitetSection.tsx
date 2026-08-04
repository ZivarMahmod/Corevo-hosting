// Callers render this section only for a live lojalitet module.

import { SectionHeader } from './sections'
import Link from 'next/link'
import s from './promo-section.module.css'
import { lojalitetVariantLabel, type LojalitetData } from '@/lib/storefront/lojalitet/types'
import { loadLojalitetData } from '@/lib/storefront/lojalitet/load-lojalitet'

/** Resolve + render the lojalitet section for one live tenant module. */
export async function LojalitetSection({ tenantId, slug }: {
  tenantId: string
  slug: string
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

        <Link href="/klubb" className={s.cta}>
          Bli medlem
        </Link>
      </div>
    </section>
  )
}
