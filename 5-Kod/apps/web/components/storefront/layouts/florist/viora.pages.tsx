import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './viora.module.css'

/**
 * VIORA — mallens EGNA undersidor (goal-59). Noll delade .sf*-sektioner: sidorna är
 * komponerade i hemmets språk — SPLIT + KORT, aldrig rader.
 *
 *   /om       SPLIT SOM HERON — violett textplatta till vänster, foto till höger (exakt
 *             hemmets möte), sedan stats-kort, teamet i kort (ÄGARENS egna bilder) och
 *             ett galleri-uppslag.
 *   /tjanster KORT-GRID (inte prislista i rader): varje tjänst är ett kort med namn,
 *             beskrivning, tid och pris — hela kortet är en <Bookable> som öppnar
 *             boknings-drawern. Inga tjänster → ärlig tom-text, aldrig påhittade rader.
 *   /kontakt  SPLIT MED KARTA — kontaktkort till vänster, kart-yta till höger; adress,
 *             telefon, mejl och tider ritas bara när de finns.
 *
 * SYNKRONA server-komponenter (som layouten) — ingen async, ingen 'use client';
 * Bookable/Gallery/BookCta bär själva sin klient-interaktivitet.
 */

/* ─────────────────────────────  /om  ───────────────────────────── */
export function VioraOm({ tenant, content }: ThemePageProps) {
  return (
    <>
      {/* SPLIT-HERO — samma möte som hemmet: färgplatta | foto */}
      <section className={styles.vioHero}>
        <div className={styles.vioHeroPanel}>
          <Reveal>
            <p className={styles.vioHeroEyebrow}>— Om {tenant.name}</p>
            <h1 className={styles.vioPageTitle}>{content.aboutTitle}</h1>
            <p className={styles.vioHeroLede}>{content.aboutCopy}</p>
          </Reveal>
        </div>
        <div
          className={styles.vioHeroPhoto}
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
      </section>

      {/* STATS — kort, inte en rad med streck (mallens kort-språk) */}
      {content.stats.length > 0 ? (
        <section className={styles.vioStatSection}>
          <ul className={styles.vioStatGrid}>
            {content.stats.map(([n, l], i) => (
              <Reveal as="li" key={l} delay={i * 90} className={styles.vioStatCard}>
                <span className={styles.vioStatValue}>{n}</span>
                <span className={styles.vioStatLabel}>{l}</span>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.vioQuoteBand}>
        <Reveal>
          <span className={styles.vioQuoteMark} aria-hidden="true">”</span>
          <p className={styles.vioQuote}>{content.italic}</p>
        </Reveal>
      </section>

      {/* TEAMET — bara ägarens egna, uppladdade medlemmar (tomt → ingen sektion). */}
      {content.team.length > 0 ? (
        <section className={styles.vioTeamSection}>
          <Reveal className={styles.vioSecHead}>
            <p className={styles.vioEyebrow}>{content.teamEyebrow}</p>
            <h2 className={styles.vioH2}>{content.teamTitle}</h2>
          </Reveal>
          <div className={styles.vioTeamGrid}>
            {content.team.map((m, i) => (
              <Reveal key={m.name + i} delay={i * 90}>
                <div className={styles.vioTeamCard}>
                  <div
                    className={styles.vioTeamPhoto}
                    style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                  />
                  <h3 className={styles.vioTeamName}>{m.name}</h3>
                  <p className={styles.vioTeamRole}>{m.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.vioGallery}>
        <div className={styles.vioGalleryInner}>
          <Reveal>
            <p className={styles.vioEyebrow}>{content.galleryEyebrow ?? '— Ur arbetet'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      <VioraClosing content={content} />
    </>
  )
}

/* ────────────────────────────  /tjanster  ──────────────────────── */
export function VioraTjanster({ content, services }: ThemePageProps) {
  return (
    <>
      <header className={styles.vioPageHead}>
        <Reveal>
          <p className={styles.vioEyebrow}>{content.servicesEyebrow}</p>
          <h1 className={styles.vioPageTitle}>{content.servicesTitle}</h1>
          {content.servicesIntro ? <p className={styles.vioBody}>{content.servicesIntro}</p> : null}
        </Reveal>
      </header>

      <section className={styles.vioSvcSection}>
        {services.length > 0 ? (
          <div className={styles.vioSvcGrid}>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i, 8) * 60}>
                {/* HELA kortet öppnar bokningen — priserna bor i kort, inte i rader. */}
                <Bookable className={styles.vioSvcCard} label={`Boka — ${s.name}`}>
                  <span className={styles.vioSvcTop}>
                    <span className={styles.vioSvcName}>{s.name}</span>
                    <span className={styles.vioSvcPrice}>{formatPrice(s)}</span>
                  </span>
                  <span className={styles.vioSvcDesc}>{serviceDesc(s)}</span>
                  <span className={styles.vioSvcMeta}>
                    <span className={styles.vioSvcDur}>{formatDuration(s)}</span>
                    <span className={styles.vioSvcBook} aria-hidden="true">
                      Boka <span>→</span>
                    </span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
        ) : (
          // ÄRLIG tom-text — aldrig påhittade tjänster/priser.
          <Reveal className={styles.vioEmpty}>
            <p className={styles.vioBody}>
              Tjänsterna fylls på. Hör av dig så berättar vi vad vi kan göra för dig.
            </p>
            <Link href="/kontakt" className={styles.vioMoreLink}>
              Kontakta oss <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        )}
      </section>

      <VioraClosing content={content} />
    </>
  )
}

/* ────────────────────────────  /kontakt  ───────────────────────── */
export function VioraKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hasAny = !!(location?.address || contact.phone || contact.email || location?.hours)
  return (
    <>
      <header className={styles.vioPageHead}>
        <Reveal>
          <p className={styles.vioEyebrow}>{content.contactEyebrow ?? '— Kontakt'}</p>
          <h1 className={styles.vioPageTitle}>{content.contactTitle ?? 'Hör av dig'}</h1>
        </Reveal>
      </header>

      {/* SPLIT MED KARTA — kort till vänster, kart-yta till höger */}
      <section className={styles.vioContactSplit}>
        <Reveal className={styles.vioContactCard}>
          <h2 className={styles.vioH2}>{tenant.name}</h2>

          {location?.address ? (
            <p className={styles.vioContactLine}>
              <span className={styles.vioContactKey}>Adress</span>
              <span className={styles.vioContactVal}>{location.address}</span>
            </p>
          ) : null}
          {contact.phone ? (
            <p className={styles.vioContactLine}>
              <span className={styles.vioContactKey}>Telefon</span>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                className={`${styles.vioContactVal} ${styles.vioContactLink}`}
              >
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.vioContactLine}>
              <span className={styles.vioContactKey}>Mejl</span>
              <a
                href={`mailto:${contact.email}`}
                className={`${styles.vioContactVal} ${styles.vioContactLink}`}
              >
                {contact.email}
              </a>
            </p>
          ) : null}
          {location?.hours ? (
            <div className={styles.vioContactHours}>
              <span className={styles.vioContactKey}>Öppettider</span>
              <div className={styles.vioHoursList}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.vioHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!hasAny ? (
            <p className={styles.vioBody}>Kontaktuppgifterna visas så snart de är ifyllda.</p>
          ) : null}
        </Reveal>

        <Reveal delay={120} className={styles.vioMapPanel}>
          {location?.address ? (
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.vioMapLink}
            >
              Visa på karta <span aria-hidden="true">→</span>
            </a>
          ) : (
            <span className={styles.vioMapHint}>Karta visas när adressen är ifylld.</span>
          )}
        </Reveal>
      </section>

      <VioraClosing content={content} />
    </>
  )
}

/* Gemensam avslutning för mallens undersidor — samma violetta platta som hemmet. */
function VioraClosing({ content }: { content: ThemePageProps['content'] }) {
  return (
    <section className={styles.vioClosing}>
      <Reveal className={styles.vioClosingInner}>
        <h2 className={styles.vioClosingTitle}>{content.closingTitle ?? 'Blommor för din dag?'}</h2>
        <p className={styles.vioClosingLede}>
          {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
        </p>
        <div className={styles.vioClosingActions}>
          <BookCta className={styles.vioClosingCta} />
        </div>
      </Reveal>
    </section>
  )
}
