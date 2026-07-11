import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './onyx.module.css'

/**
 * ONYX — mallens EGNA undersidor (goal-59). Ingen delad .sf*-sektion: /om,
 * /tjanster och /kontakt är komponerade i mallens mörka språk, precis som hemmet.
 *
 *   /om       MÖRKT PORTRÄTT-UPPSLAG — svart titelplatta, ett stort 4/5-porträtt
 *             mot en kort textspalt, statistik-rad, teamet (ÄGARENS egna bilder,
 *             aldrig temats stock-ansikten) och ett galleri-uppslag.
 *   /tjanster SVART PRISLISTA — hårlinjer, löpnummer i korall, pris till höger,
 *             varje rad en <Bookable> som öppnar boknings-drawern. Inga tjänster
 *             → ärlig tom-text, aldrig påhittade rader.
 *   /kontakt  MÖRKT KORT — kontaktuppgifter som ett upphöjt surface-kort med
 *             korall-detaljer; adress/tider/mejl/telefon ritas bara när de finns.
 *
 * Sidorna är SYNKRONA server-komponenter (som layouterna) — ingen async, ingen
 * 'use client'; Bookable/Gallery bär själva sin klient-interaktivitet.
 */

/* ─────────────────────────────  /om  ───────────────────────────── */
export function OnyxOm({ tenant, content }: ThemePageProps) {
  return (
    <>
      <header className={styles.onxPageHead}>
        <Reveal>
          <p className={styles.onxEyebrow}>— Om {tenant.name}</p>
          <h1 className={styles.onxPageTitle}>{content.aboutTitle}</h1>
        </Reveal>
      </header>

      {/* PORTRÄTT-UPPSLAGET: bild vänster, kort text höger — 4/5 som allt annat. */}
      <section className={styles.onxSpread}>
        <Reveal>
          <div
            className={styles.onxSpreadPhoto}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
          />
        </Reveal>
        <Reveal delay={120} className={styles.onxSpreadText}>
          <p className={styles.onxQuote}>{content.italic}</p>
          <p className={styles.onxBody}>{content.aboutCopy}</p>
          <ul className={styles.onxStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.onxStatValue}>{n}</span>
                <span className={styles.onxStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* TEAMET — bara ägarens egna, uppladdade medlemmar (tomt → ingen sektion). */}
      {content.team.length > 0 ? (
        <section className={styles.onxTeam}>
          <Reveal className={styles.onxSecHead}>
            <p className={styles.onxEyebrow}>{content.teamEyebrow}</p>
            <h2 className={styles.onxTitle}>{content.teamTitle}</h2>
          </Reveal>
          <div className={styles.onxTeamGrid}>
            {content.team.map((m, i) => (
              <Reveal key={m.name + i} delay={i * 90}>
                <div className={styles.onxTeamCard}>
                  <div
                    className={styles.onxTeamPhoto}
                    style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                  />
                  <h3 className={styles.onxTeamName}>{m.name}</h3>
                  <p className={styles.onxTeamRole}>{m.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.onxGallery}>
        <Reveal className={styles.onxGalleryHead}>
          <p className={styles.onxEyebrow}>{content.galleryEyebrow ?? '— Ur arbetet'}</p>
        </Reveal>
        <Reveal>
          <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
        </Reveal>
      </section>

      <OnyxClosing content={content} />
    </>
  )
}

/* ────────────────────────────  /tjanster  ──────────────────────── */
export function OnyxTjanster({ content, services }: ThemePageProps) {
  return (
    <>
      <header className={styles.onxPageHead}>
        <Reveal>
          <p className={styles.onxEyebrow}>{content.servicesEyebrow}</p>
          <h1 className={styles.onxPageTitle}>{content.servicesTitle}</h1>
          {content.servicesIntro ? (
            <p className={styles.onxBody}>{content.servicesIntro}</p>
          ) : null}
        </Reveal>
      </header>

      <section className={styles.onxPriceSection}>
        {services.length > 0 ? (
          <div className={styles.onxPriceList}>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i, 8) * 45}>
                <Bookable className={styles.onxPriceRow} label={`Boka — ${s.name}`}>
                  <span className={styles.onxRowNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.onxPriceMain}>
                    <span className={styles.onxRowName}>{s.name}</span>
                    <span className={styles.onxRowDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.onxPriceMeta}>
                    <span className={styles.onxRowDur}>{formatDuration(s)}</span>
                    <span className={styles.onxRowPrice}>{formatPrice(s)}</span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
        ) : (
          // ÄRLIG tom-text — aldrig påhittade tjänster/priser.
          <Reveal className={styles.onxEmpty}>
            <p className={styles.onxBody}>
              Prislistan fylls på. Hör av dig så berättar vi vad vi kan göra för dig.
            </p>
            <Link href="/kontakt" className={styles.onxBtn}>
              Kontakta oss
            </Link>
          </Reveal>
        )}
      </section>

      <OnyxClosing content={content} />
    </>
  )
}

/* ────────────────────────────  /kontakt  ───────────────────────── */
export function OnyxKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hasAny = !!(location?.address || contact.phone || contact.email || location?.hours)
  return (
    <>
      <header className={styles.onxPageHead}>
        <Reveal>
          <p className={styles.onxEyebrow}>{content.contactEyebrow ?? '— Kontakt'}</p>
          <h1 className={styles.onxPageTitle}>{content.contactTitle ?? 'Hör av dig'}</h1>
        </Reveal>
      </header>

      <section className={styles.onxContact}>
        <Reveal className={styles.onxContactCard}>
          <h2 className={styles.onxTitle}>{tenant.name}</h2>

          {location?.address ? (
            <p className={styles.onxContactLine}>
              <span className={styles.onxContactKey}>Adress</span>
              <span className={styles.onxContactVal}>{location.address}</span>
            </p>
          ) : null}
          {contact.phone ? (
            <p className={styles.onxContactLine}>
              <span className={styles.onxContactKey}>Telefon</span>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                className={`${styles.onxContactVal} ${styles.onxContactLink}`}
              >
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.onxContactLine}>
              <span className={styles.onxContactKey}>Mejl</span>
              <a
                href={`mailto:${contact.email}`}
                className={`${styles.onxContactVal} ${styles.onxContactLink}`}
              >
                {contact.email}
              </a>
            </p>
          ) : null}
          {!hasAny ? (
            <p className={styles.onxBody}>Kontaktuppgifterna visas så snart de är ifyllda.</p>
          ) : null}

          {location?.address ? (
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.onxMoreLink}
            >
              Visa på karta <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </Reveal>

        {location?.hours ? (
          <Reveal delay={120} className={styles.onxHoursCard}>
            <p className={styles.onxEyebrow}>— Öppettider</p>
            <div className={styles.onxHours}>
              {location.hours.map((h) => (
                <div key={h.day} className={styles.onxHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          </Reveal>
        ) : null}
      </section>

      <OnyxClosing content={content} />
    </>
  )
}

/* Gemensam avslutning för mallens undersidor — samma mörka closing som hemmet. */
function OnyxClosing({ content }: { content: ThemePageProps['content'] }) {
  return (
    <section className={styles.onxClosing}>
      <Reveal className={styles.onxClosingInner}>
        <h2 className={styles.onxTitle}>{content.closingTitle ?? 'Redo för något som sticker ut?'}</h2>
        <p className={styles.onxClosingLede}>
          {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
        </p>
        <div className={styles.onxClosingActions}>
          <BookCta className={styles.onxBtn} />
        </div>
      </Reveal>
    </section>
  )
}
