import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../service-format'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * ZIGGE — dark barber + frisör (handoff Zigge.jsx). Distinct shape:
 *  a split-screen hero (a surface color-panel with UPPERCASE display + a photo
 *  half), full-width horizontal service bands, a horizontal stat strip, square
 *  (radius-2) buttons. Solid split nav + MiniFooter (chrome).
 *
 * No `.hero` sentinel: the nav stays solid; the split hero sits below --nav-h.
 * The dark surface comes entirely from the zigge theme tokens (near-black warm).
 */
export function ZiggeLayout({ content, services }: StorefrontLayoutProps) {
  return (
    <>
      {/* split hero: color panel + photo */}
      <section className={styles.sfSplitHero}>
        <div className={styles.sfSplitPanel}>
          <p className="sf-eyebrow" style={{ color: 'var(--color-primary)' }}>
            {content.heroEyebrow}
          </p>
          <h1 className={styles.sfSplitTitle} style={{ whiteSpace: 'pre-line' }}>
            {content.heroTitle}
          </h1>
          <p className="sf-lede" style={{ maxWidth: '26rem', marginTop: 22 }}>
            {content.heroLede}
          </p>
          <div className={styles.sfSplitActions}>
            <BookCta className={styles.sfSquareCta} />
            <span className={styles.sfSplitNote}>eller drop in</span>
          </div>
        </div>
        <div
          className={styles.sfSplitPhoto}
          style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
        />
      </section>

      {/* horizontal service bands */}
      <section>
        <div className={styles.sfBandLabel}>Tjänster</div>
        {services.length > 0 ? (
          services.map((s, i) => (
            <Bookable key={s.id} className={styles.sfBand} label={`Boka — ${s.name}`}>
              <span className={styles.sfBandNum} aria-hidden="true">
                {serviceNum(i)}
              </span>
              <span className={styles.sfBandMain}>
                <span className={styles.sfBandName}>{s.name}</span>
                <span className={styles.sfBandDesc}>{serviceDesc(s)}</span>
              </span>
              <span className={styles.sfBandMeta}>
                <span className={styles.sfBandPrice}>{formatPrice(s)}</span>
                <span className={styles.sfBandTime}>{formatDuration(s)}</span>
              </span>
            </Bookable>
          ))
        ) : (
          <div className={styles.sfBand}>
            <span className="sf-body">Tjänster läggs upp inom kort.</span>
          </div>
        )}
      </section>

      {/* stat strip */}
      <section className={styles.sfStatStrip}>
        {content.stats.map(([n, l]) => (
          <div key={l} className={styles.sfStatStripCell}>
            <span className={styles.sfStatValueLg}>{n}</span>
            <span className={styles.sfStatStripLabel}>{l}</span>
          </div>
        ))}
      </section>
    </>
  )
}
