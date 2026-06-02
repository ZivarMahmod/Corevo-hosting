import { HeroCarousel } from '../HeroCarousel'
import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice } from '../service-format'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * LEANDER — centered, symmetric, romantic (handoff Leander.jsx). Distinct shape:
 *  a centered hero carousel, a centered 2-column dotted price list, an italic
 *  quote band + centered stats, then a MiniFooter (chrome). NO team / gallery —
 *  the restraint is what makes it read as a different site.
 *
 * The hero sits in normal flow BELOW a solid centered nav (no `.hero` sentinel,
 * so the nav stays solid), inside the reserved --nav-h.
 */
export function LeanderLayout({ content, services }: StorefrontLayoutProps) {
  return (
    <>
      {/* centered hero carousel */}
      <section className={styles.sfHeroCentered} aria-label="Välkommen">
        <HeroCarousel
          images={content.heroImages.map((src) => ({ src, alt: '' }))}
          align="center"
        >
          <p className={styles.heroEyebrow} style={{ letterSpacing: '0.28em' }}>
            {content.heroEyebrow}
          </p>
          <h1 className={styles.heroTitle} style={{ whiteSpace: 'pre-line', maxWidth: '52rem' }}>
            {content.heroTitle}
          </h1>
          <p className={styles.heroLead} style={{ maxWidth: '34rem' }}>
            {content.heroLede}
          </p>
          <div className={styles.heroActions}>
            <BookCta className={styles.heroCta} />
          </div>
        </HeroCarousel>
      </section>

      {/* centered 2-col dotted price list */}
      <section className={styles.sfPriceBand}>
        <Reveal style={{ textAlign: 'center' }}>
          <p className="sf-eyebrow">— Behandlingar</p>
          <h2 className="sf-h1" style={{ margin: '12px 0 44px' }}>
            Prislista
          </h2>
        </Reveal>
        {services.length > 0 ? (
          <div className={styles.sfPriceGrid}>
            {services.map((s) => (
              <Bookable key={s.id} className={styles.sfPriceRow} label={`Boka — ${s.name}`}>
                <span className={styles.sfPriceName}>{s.name}</span>
                <span className={styles.sfPriceDots} aria-hidden="true" />
                <span className={styles.sfPriceVal}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
        ) : (
          <p className="sf-body" style={{ textAlign: 'center' }}>
            Prislistan publiceras inom kort.
          </p>
        )}
      </section>

      {/* italic quote + centered stats */}
      <section className={styles.sfQuoteBand}>
        <Reveal>
          <p className={`sf-italic ${styles.sfQuote}`}>&ldquo;{content.italic}&rdquo;</p>
          <ul className={styles.sfStatRowCenter}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.sfStatValueLg}>{n}</span>
                <span className={styles.sfStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    </>
  )
}
