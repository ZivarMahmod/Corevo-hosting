import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './seraphina.module.css'

/**
 * SERAPHINA — mallens EGNA undersidor (goal-59). Ingen delad .sf*-sektion: /om,
 * /tjanster och /kontakt är komponerade i mallens bröllopsspråk, precis som hemmet.
 *
 *   /om       BRUDPORTRÄTT-UPPSLAG — ett stort 4/5-porträtt i guldmatta, med ett
 *             textkort som ÖVERLAPPAR bilden (kortet ligger i papper med guldram),
 *             kursivt citat, brödtext, guld-statistik och ett galleri-uppslag.
 *   /tjanster GULDRAMAD PRISLISTA — hela listan ligger inuti EN guldram (dubbel
 *             linje, som heron), streckade rader, löpnummer i guld, pris höger.
 *             Varje rad är en <Bookable> som öppnar boknings-drawern. Inga
 *             tjänster → ärlig tom-text, aldrig påhittade rader/priser.
 *   /kontakt  BOKNINGSFÖRFRÅGAN-KORT — ett centrerat guldramat kort med rubrik,
 *             kontaktrader (bara de som finns), CTA till bokningen och en
 *             öppettidslista bredvid. Ingen påhittad adress, ingen falsk karta.
 *
 * SYNKRONA server-komponenter (som layouten) — ingen async, ingen 'use client';
 * Bookable/Gallery/BookCta bär själva sin klient-interaktivitet.
 */

/* ─────────────────────────────  /om  ───────────────────────────── */
export function SeraphinaOm({ tenant, content }: ThemePageProps) {
  return (
    <div className={styles.seraRoot}>
      <header className={styles.seraPageHead}>
        <Reveal>
          <p className={styles.seraEyebrow}>— Om {tenant.name}</p>
          <h1 className={styles.seraPageTitle}>{content.aboutTitle}</h1>
        </Reveal>
      </header>

      {/* BRUDPORTRÄTT-UPPSLAGET: 4/5-porträtt + överlappande textkort i guldram. */}
      <section className={styles.seraSpread}>
        <Reveal className={styles.seraSpreadMat}>
          <div
            className={styles.seraImg}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
          />
        </Reveal>
        <Reveal delay={120} className={styles.seraSpreadCard}>
          <p className={styles.seraQuote}>{content.italic}</p>
          <p className={styles.seraBody}>{content.aboutCopy}</p>
          <ul className={styles.seraStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.seraStatValue}>{n}</span>
                <span className={styles.seraStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* TEAMET — bara ägarens egna, uppladdade medlemmar (tomt → ingen sektion). */}
      {content.team.length > 0 ? (
        <section className={styles.seraShop}>
          <Reveal className={styles.seraHead}>
            <p className={styles.seraEyebrow}>{content.teamEyebrow}</p>
            <h2 className={styles.seraH2}>{content.teamTitle}</h2>
          </Reveal>
          <div className={styles.seraGrid}>
            {content.team.map((m, i) => (
              <Reveal key={m.name + i} delay={i * 90}>
                <div className={styles.seraMat}>
                  <div
                    className={styles.seraImg}
                    style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                  />
                </div>
                <h3 className={styles.seraBlogName}>{m.name}</h3>
                <p className={styles.seraStatLabel}>{m.role}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.seraGalleryBand}>
        <div className={styles.seraContainer}>
          <Reveal>
            <p className={styles.seraEyebrow}>{content.galleryEyebrow ?? '— Ur våra bröllop'}</p>
          </Reveal>
          <Reveal className={styles.seraGallery}>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Blomsterarrangemang' }))} />
          </Reveal>
        </div>
      </section>

      <SeraphinaClosing content={content} />
    </div>
  )
}

/* ────────────────────────────  /tjanster  ──────────────────────── */
export function SeraphinaTjanster({ content, services }: ThemePageProps) {
  return (
    <div className={styles.seraRoot}>
      <header className={styles.seraPageHead}>
        <Reveal>
          <p className={styles.seraEyebrow}>{content.servicesEyebrow}</p>
          <h1 className={styles.seraPageTitle}>{content.servicesTitle}</h1>
          {content.servicesIntro ? <p className={styles.seraPageLede}>{content.servicesIntro}</p> : null}
        </Reveal>
      </header>

      <section className={styles.seraPriceSection}>
        <div className={styles.seraContainer}>
          {services.length > 0 ? (
            <Reveal className={styles.seraPriceFrame}>
              <p className={styles.seraPriceFrameHead}>Prislista</p>
              <div className={styles.seraPriceList}>
                {services.map((s, i) => (
                  <Bookable key={s.id} className={styles.seraListRow} label={`Boka — ${s.name}`}>
                    <span className={styles.seraPriceNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.seraPriceMain}>
                      <span className={styles.seraPriceName}>{s.name}</span>
                      <span className={styles.seraPriceDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.seraListMeta}>
                      <span className={styles.seraStatLabel}>{formatDuration(s)}</span>
                      <span className={styles.seraPricePrice}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                ))}
              </div>
            </Reveal>
          ) : (
            // ÄRLIG tom-text — aldrig påhittade tjänster/priser.
            <Reveal className={styles.seraPriceFrame}>
              <p className={styles.seraPriceFrameHead}>Prislista</p>
              <p className={styles.seraBody}>
                Prislistan fylls på. Berätta om er dag så återkommer vi med ett förslag.
              </p>
              <Link href="/kontakt" className={styles.seraCta}>
                Kontakta oss
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      <SeraphinaClosing content={content} />
    </div>
  )
}

/* ────────────────────────────  /kontakt  ───────────────────────── */
export function SeraphinaKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hasAny = !!(location?.address || contact.phone || contact.email)
  return (
    <div className={styles.seraRoot}>
      <header className={styles.seraPageHead}>
        <Reveal>
          <p className={styles.seraEyebrow}>{content.contactEyebrow ?? '— Kontakt'}</p>
          <h1 className={styles.seraPageTitle}>{content.contactTitle ?? 'Bokningsförfrågan'}</h1>
        </Reveal>
      </header>

      <section className={styles.seraContact}>
        <div className={styles.seraContactGrid}>
          {/* BOKNINGSFÖRFRÅGAN-KORTET — guldram, som hero-ramen. */}
          <Reveal className={styles.seraRequestCard}>
            <p className={styles.seraEyebrow}>— {tenant.name}</p>
            <h2 className={styles.seraH2}>Berätta om er dag</h2>
            <p className={styles.seraBody}>
              Boka en konsultation så går vi igenom stil, färger och budget tillsammans — helt
              utan kostnad.
            </p>
            <div className={styles.seraHeroActions}>
              <BookCta />
            </div>

            {hasAny ? (
              <dl className={styles.seraContactLines}>
                {location?.address ? (
                  <div className={styles.seraContactLine}>
                    <dt className={styles.seraContactKey}>Adress</dt>
                    <dd className={styles.seraContactVal}>{location.address}</dd>
                  </div>
                ) : null}
                {contact.phone ? (
                  <div className={styles.seraContactLine}>
                    <dt className={styles.seraContactKey}>Telefon</dt>
                    <dd className={styles.seraContactVal}>
                      <a
                        href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                        className={styles.seraContactLink}
                      >
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {contact.email ? (
                  <div className={styles.seraContactLine}>
                    <dt className={styles.seraContactKey}>Mejl</dt>
                    <dd className={styles.seraContactVal}>
                      <a href={`mailto:${contact.email}`} className={styles.seraContactLink}>
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className={styles.seraBody}>Kontaktuppgifterna visas så snart de är ifyllda.</p>
            )}

            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.seraMore}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </Reveal>

          {location?.hours ? (
            <Reveal delay={120}>
              <p className={styles.seraEyebrow}>— Öppettider</p>
              <div className={styles.seraHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.seraHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <SeraphinaClosing content={content} />
    </div>
  )
}

/* Gemensam avslutning för mallens undersidor — samma guldband som hemmet. */
function SeraphinaClosing({ content }: { content: ThemePageProps['content'] }) {
  return (
    <section className={styles.seraClosing}>
      <Reveal>
        <h2 className={styles.seraClosingTitle}>{content.closingTitle ?? 'Redo att planera er dag?'}</h2>
        <p className={styles.seraClosingLede}>
          {content.closingLede ?? 'Begär en offert eller boka en konsultation — vi hjälper er gärna vidare.'}
        </p>
        <div className={styles.seraClosingActions}>
          <BookCta className={styles.seraClosingCta} />
        </div>
      </Reveal>
    </section>
  )
}
