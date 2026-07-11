import { Reveal } from '../Reveal'
import { Gallery } from '../Gallery'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../service-format'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * FLORA — bohemisk blomsterbutik (florist-branschens tema; byggt 2026-07-11 med
 * Hantverksfloristerna som första kund, men modulärt som de andra fem). Distinkt
 * form: sido-hero med mjuk blob (linne + mossgrönt), italisk citat-band, numrerade
 * bukett-rader (pris-lista, ingen duration — blommor är inte tidsbokningar),
 * om-split med foto, galleri-masonry, plats/öppettider och stängnings-CTA.
 * Serif-tungt (Playfair + PT Serif) för hantverkskänslan.
 */
export function FloraLayout({ tenant, content, services, location }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  return (
    <>
      {/* HERO — text bredvid rundad bild med blob-accent (bohemiskt mjukt) */}
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
            <span className={styles.sfSideNote}>eller kom förbi butiken →</span>
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

      {/* CITAT — det italiska bandet (bohemisk andhämtning mellan sektionerna) */}
      <section style={{ padding: '64px 24px', textAlign: 'center', background: 'var(--color-accent-soft)' }}>
        <Reveal>
          <p className="sf-italic" style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', maxWidth: '36rem', margin: '0 auto', color: 'var(--color-primary)' }}>
            {content.italic}
          </p>
        </Reveal>
      </section>

      {/* BUKETTER & TJÄNSTER — numrerade rader, pris utan duration */}
      <section className={styles.sfServices}>
        <div className={styles.sfNarrow}>
          <Reveal>
            <p className="sf-eyebrow">{content.servicesEyebrow}</p>
            <h2 className="sf-h1" style={{ marginTop: 12, maxWidth: '38rem' }}>
              {content.servicesTitle}
            </h2>
          </Reveal>
          {rows.length > 0 ? (
            <div className={styles.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.sfRow} label={`Beställ — ${s.name}`}>
                    <span className={styles.sfRowNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.sfRowMain}>
                      <span className={styles.sfRowName}>{s.name}</span>
                      <span className={styles.sfRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.sfRowMeta}>
                      <span className={styles.sfRowPrice}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="sf-body" style={{ marginTop: 32 }}>
              Buketter och binderier läggs upp inom kort. Ring oss gärna så länge.
            </p>
          )}
          {hasMore ? (
            <Reveal>
              <a href="/tjanster" className={styles.sfMoreLink}>
                Se allt vi gör <span aria-hidden="true">→</span>
              </a>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* OM — split foto + text + stat-trio */}
      <section className={styles.sfAboutBand}>
        <div className={`${styles.sfWide} ${styles.sfAboutGrid}`}>
          <Reveal>
            <div
              className={styles.sfAboutPhoto}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>{content.aboutTitle}</h2>
            <p className="sf-body" style={{ fontSize: 17, marginTop: 16 }}>
              {content.aboutCopyHome}
            </p>
            <ul className={styles.sfStatTrio}>
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

      {/* GALLERI — masonry + lightbox (bröllop, begravning, inspiration) */}
      <section className={styles.sfGalleryBand}>
        <div className={styles.sfWide}>
          <Reveal>
            <p className="sf-eyebrow">— Galleri</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* PLATS & ÖPPETTIDER */}
      <section className={styles.sfLocBand}>
        <div className={`${styles.sfWide} ${styles.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">— Hitta till butiken</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>
                {location.address}
              </p>
            ) : (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>
                Adress visas snart.
              </p>
            )}
            {location?.hours ? (
              <div className={styles.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.sfHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={styles.sfMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.sfMapLink}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={styles.sfMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.sfClosing}>
        <Reveal>
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto' }}>
            Blommor för din dag?
          </h2>
          <p className={styles.sfClosingLead}>Beställ eller hör av dig — vi hjälper dig gärna.</p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={styles.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
