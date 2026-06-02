import { HeroCarousel } from '../HeroCarousel'
import { Reveal } from '../Reveal'
import { Gallery } from '../Gallery'
import { Bookable } from '../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../service-format'
import type { StorefrontLayoutProps } from './types'
import styles from '../storefront.module.css'

/**
 * SALVIA — the full editorial base (handoff Home.jsx). Distinct shape:
 *  full-bleed hero carousel with copy anchored bottom-left, numbered service rows
 *  (01–05), About split + stat-trio, Team 3-up, Gallery masonry, Location + map,
 *  then the 3-col footer (rendered by the public layout chrome).
 *
 * This is the ONLY layout that uses the transparent-over-hero fixed nav: its hero
 * carries the global `.hero` sentinel (NavShell goes transparent) and the hashed
 * `.heroSection` (whose negative margin cancels the reserved --nav-h so the photo
 * meets the viewport top under the nav).
 */
export function SalviaLayout({ tenant, content, services, location }: StorefrontLayoutProps) {
  const rows = services.slice(0, 5)
  const hasMore = services.length > 5

  return (
    <>
      {/* HERO — full-bleed carousel, copy bottom-left */}
      <section className={`hero ${styles.heroSection}`} aria-label="Välkommen">
        <HeroCarousel
          images={content.heroImages.map((src) => ({ src, alt: '' }))}
          align="left"
        >
          <p className={styles.heroEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.heroTitle} style={{ whiteSpace: 'pre-line' }}>
            {content.heroTitle}
          </h1>
          <p className={styles.heroLead}>{content.heroLede}</p>
          <div className={styles.heroActions}>
            <BookCta className={styles.heroCta} />
          </div>
        </HeroCarousel>
      </section>

      {/* TJÄNSTER — numbered editorial rows 01–05 */}
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
                  <Bookable className={styles.sfRow} label={`Boka — ${s.name}`}>
                    <span className={styles.sfRowNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.sfRowMain}>
                      <span className={styles.sfRowName}>{s.name}</span>
                      <span className={styles.sfRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.sfRowMeta}>
                      <span className={styles.sfRowPrice}>{formatPrice(s)}</span>
                      <span className={styles.sfRowTime}>{formatDuration(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="sf-body" style={{ marginTop: 32 }}>
              Tjänster läggs upp inom kort. Du är ändå varmt välkommen att boka eller höra av dig.
            </p>
          )}
          {hasMore ? (
            <Reveal>
              <a href="/tjanster" className={styles.sfMoreLink}>
                Se alla tjänster <span aria-hidden="true">→</span>
              </a>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* OM — split photo + copy + stat-trio */}
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
            <p className={`sf-italic ${styles.sfAboutItalic}`}>{content.italic}</p>
            <p className="sf-body" style={{ fontSize: 17 }}>
              {content.aboutCopy}
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

      {/* TEAM — 3-up */}
      <section className={styles.sfTeam}>
        <div className={styles.sfWide}>
          <Reveal style={{ textAlign: 'center' }}>
            <p className="sf-eyebrow">{content.teamEyebrow}</p>
            <h2 className="sf-h1" style={{ marginTop: 12 }}>
              {content.teamTitle}
            </h2>
          </Reveal>
          <ul className={styles.sfTeamGrid}>
            {content.team.map((m, i) => (
              <Reveal as="li" key={m.name + i} delay={i * 90} className={styles.sfTeamCard}>
                <div className={styles.sfTeamPhoto} style={{ backgroundImage: `url(${m.img})` }} />
                <h3 className={styles.sfTeamName}>{m.name}</h3>
                <p className="sf-body" style={{ fontSize: 14 }}>
                  {m.role}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* GALLERI — masonry grid + lightbox */}
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

      {/* PLATS & ÖPPETTIDER + closing CTA */}
      <section className={styles.sfLocBand}>
        <div className={`${styles.sfWide} ${styles.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">— Hitta hit</p>
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
            {/* Honest map affordance: we don't geocode, so rather than embed a
                misleading default-bbox map we link to a real OSM search for the
                saved address (matches the LocationHours pattern). */}
            <div className={styles.sfMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(
                    location.address,
                  )}`}
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
            Redo för en ny stil?
          </h2>
          <p className={styles.sfClosingLead}>Boka din tid på under en minut.</p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={styles.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
