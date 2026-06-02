import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '../StorefrontIcon'
import { formatPrice, formatDuration, serviceDesc } from '../service-format'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * LINNEA — warm Scandinavian natural (handoff Linnea.jsx). Distinct shape:
 *  a side-by-side hero (text beside a rounded image with a soft blob accent),
 *  a 3-column service-card grid each led by a scissors icon, and stat "chips".
 *  Solid left nav + MiniFooter (chrome). Everything rounded + warm clay/sand.
 */
export function LinneaLayout({ content, services }: StorefrontLayoutProps) {
  return (
    <>
      {/* side-by-side hero */}
      <section className={styles.sfSideHero}>
        <div className={styles.sfSideText}>
          <span className={styles.sfPillEyebrow}>{content.heroEyebrow}</span>
          <h1 className={styles.heroTitle} style={{ whiteSpace: 'pre-line', color: 'var(--color-fg)' }}>
            {content.heroTitle}
          </h1>
          <p className="sf-lede" style={{ maxWidth: '28rem', marginTop: 20 }}>
            {content.heroLede}
          </p>
          <div className={styles.sfSideActions}>
            <BookCta className={styles.heroCta} />
            <span className={styles.sfSideNote}>eller drop in →</span>
          </div>
        </div>
        <div className={styles.sfSideMedia}>
          <span className={styles.sfBlob} aria-hidden="true" />
          <div
            className={styles.sfSidePhoto}
            style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
          />
        </div>
      </section>

      {/* 3-col service cards + stat chips */}
      <section className={styles.sfCardBand}>
        <Reveal style={{ textAlign: 'center' }}>
          <p className="sf-eyebrow">— Behandlingar</p>
          <h2 className="sf-h1" style={{ marginTop: 10 }}>
            Våra behandlingar
          </h2>
        </Reveal>
        {services.length > 0 ? (
          <div className={styles.sfCardGrid}>
            {services.map((s, i) => (
              <Reveal as="div" key={s.id} delay={i * 60}>
                <Bookable className={styles.sfCard} label={`Boka — ${s.name}`}>
                  <span className={styles.sfCardIcon}>
                    <StorefrontIcon name="scissors" size={20} />
                  </span>
                  <h3 className={styles.sfCardName}>{s.name}</h3>
                  <p className="sf-body" style={{ fontSize: 14, marginTop: 6 }}>
                    {serviceDesc(s)}
                  </p>
                  <div className={styles.sfCardMeta}>
                    <span className={styles.sfCardPrice}>{formatPrice(s)}</span>
                    <span className={styles.sfCardTime}>{formatDuration(s)}</span>
                  </div>
                </Bookable>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="sf-body" style={{ textAlign: 'center' }}>
            Behandlingar läggs upp inom kort.
          </p>
        )}

        <ul className={styles.sfChips}>
          {content.stats.map(([n, l]) => (
            <li key={l} className={styles.sfChip}>
              <span className={styles.sfChipValue}>{n}</span>
              <span className={styles.sfStatLabel}>{l}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
