// Callers render this section only for a live offert module.

import { SectionHeader, SubpageHero } from './sections'
import shop from './shop-section.module.css'
import {
  offertPromise,
  OFFERT_MODE_LABELS,
  type OffertData,
} from '@/lib/storefront/offert/types'
import { loadOffertData } from '@/lib/storefront/offert/load-offert'
import { OffertForm } from './OffertForm'

/** Resolve + render the offert section for one live tenant module. */
export async function OffertSection({
  tenantId,
  slug,
  teaser = false,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  /** Startsidans kompakta läge: rubrik + länk till /offert istället för hela formuläret. */
  teaser?: boolean
  /** Modulens EGEN sida: hero-bandet i stället för SectionHeader (goal-57). */
  pageHero?: boolean
}) {
  const data: OffertData | null = await loadOffertData(tenantId, slug)
  if (!data) return null

  const { config } = data

  if (teaser) {
    return (
      <section className="section" data-module="offert" data-mode={config.mode}>
        <div className="section-inner">
          <SectionHeader
            eyebrow="— Offert"
            title="Större jobb? Få en offert"
            lead={offertPromise(config)}
          />
          <p className={shop.moreWrap}>
            <a href="/offert" className={shop.more}>
              Begär offert <span aria-hidden="true">→</span>
            </a>
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      {pageHero ? (
        <SubpageHero
          eyebrow={`— Offert · ${OFFERT_MODE_LABELS[config.mode]}`}
          title="Få en offert"
          lede={offertPromise(config)}
        />
      ) : null}
    <section className="section" data-module="offert" data-mode={config.mode}>
      <div className="section-inner">
        {!pageHero ? (
          <SectionHeader
            eyebrow={`— Offert · ${OFFERT_MODE_LABELS[config.mode]}`}
            title="Få en offert"
            lead={offertPromise(config)}
          />
        ) : null}

        <OffertForm mode={config.mode} responseDays={config.responseDays} subjects={config.subjects} />
      </div>
    </section>
    </>
  )
}
