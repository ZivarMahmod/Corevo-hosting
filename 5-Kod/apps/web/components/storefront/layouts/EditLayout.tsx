import { Reveal } from '../Reveal'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../service-format'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * EDIT — editorial minimal (handoff Edit.jsx). Distinct shape:
 *  an asymmetric hero (a big image with an overlapping text card pulled up over
 *  it), a numbered 2-column service grid, an about split with inline stats, and
 *  square (radius-2) buttons. Solid left nav + MiniFooter (chrome). Charcoal on
 *  ivory, lots of hairlines — magazine, not salon-soft.
 */
export function EditLayout({ tenant, content, services }: StorefrontLayoutProps) {
  return (
    <>
      {/* asymmetric hero: big image + overlapping card */}
      <section className={styles.sfEditHero}>
        <div
          className={styles.sfEditHeroImg}
          style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
        />
        <div className={styles.sfEditCard}>
          <p className="sf-eyebrow">{content.heroEyebrow}</p>
          <h1
            className={styles.heroTitle}
            style={{ whiteSpace: 'pre-line', color: 'var(--color-fg)', fontSize: 'clamp(34px,4vw,56px)' }}
          >
            {content.heroTitle}
          </h1>
          <p className="sf-lede" style={{ marginTop: 16 }}>
            {content.heroLede}
          </p>
          <div style={{ marginTop: 26 }}>
            <BookCta className={styles.sfSquareCta} />
          </div>
        </div>
      </section>

      {/* numbered 2-col service grid */}
      <section className={styles.sfEditServices}>
        <div className={styles.sfWide}>
          <div className={styles.sfBandLabelInline}>Tjänster</div>
          {services.length > 0 ? (
            <div className={styles.sfEditGrid}>
              {services.map((s, i) => (
                <Bookable key={s.id} className={styles.sfEditRow} label={`Boka — ${s.name}`}>
                  <span className={styles.sfEditNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.sfEditRowMain}>
                    <span className={styles.sfEditRowHead}>
                      <span className={styles.sfEditRowName}>{s.name}</span>
                      <span className={styles.sfEditRowPrice}>{formatPrice(s)}</span>
                    </span>
                    <span className={styles.sfEditRowDesc}>
                      {serviceDesc(s)} · {formatDuration(s)}
                    </span>
                  </span>
                </Bookable>
              ))}
            </div>
          ) : (
            <p className="sf-body">Tjänster läggs upp inom kort.</p>
          )}
        </div>
      </section>

      {/* about split + inline stats */}
      <section className={styles.sfEditAbout}>
        <div className={`${styles.sfWide} ${styles.sfEditAboutGrid}`}>
          <Reveal>
            <div
              className={styles.sfEditAboutPhoto}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <p className={`sf-italic ${styles.sfEditQuote}`}>&ldquo;{content.italic}&rdquo;</p>
            <p className="sf-body" style={{ fontSize: 16 }}>
              {content.aboutCopyHome}
            </p>
            <ul className={styles.sfStatInline}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.sfStatValue}>{n}</span>
                  <span className={styles.sfStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>
    </>
  )
}
