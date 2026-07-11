import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './isalara.module.css'

/**
 * ISALARA — mallens EGNA undersidor (goal-59). Noll delade .sf*-sektioner: /om,
 * /tjanster och /kontakt är komponerade i mallens kvällsblå språk, precis som
 * hemmet. Varje sida öppnar med en MARINBLÅ platta och en SKRIPT-rubrik (samma
 * hand som wordmarket) — sidorna bär signaturen, inte bara startsidan.
 *
 *   /om       PORTRÄTT + BREV — 4/5-porträtt mot en brevspalt på sandpapper:
 *             kursiv inledning, brödtext, script-signatur. Statistik-rad + en
 *             galleri-remsa i samma 4/5.
 *   /tjanster TVÅSPALT MED GULD-PRICK — samma prislista som hemmet, varje rad en
 *             <Bookable> som öppnar boknings-drawern. Inga tjänster → ÄRLIG
 *             tom-text, aldrig påhittade rader.
 *   /kontakt  ETT MÖRKBLÅTT KORT centrerat på sanden — nyckel/värde-rader.
 *             Adress/telefon/mejl/tider ritas bara när de finns.
 *
 * Sidorna är SYNKRONA server-komponenter (som layouten) — ingen async, ingen
 * 'use client'; Bookable/Reveal bär själva sin klient-interaktivitet.
 */

/* ─────────────────────────────  /om  ───────────────────────────── */
export function IsalaraOm({ tenant, content }: ThemePageProps) {
  const strip = content.galleryImages.slice(0, 3)
  return (
    <div className={styles.islPage}>
      <header className={styles.islPageHead}>
        <p className={styles.islPageEyebrow}>— Om {tenant.name}</p>
        <h1 className={styles.islPageTitle}>{content.aboutTitle}</h1>
      </header>

      <section className={styles.islLetterGrid}>
        <Reveal>
          <div
            className={styles.islPortrait}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
          />
        </Reveal>
        <Reveal delay={120}>
          <div className={styles.islLetter}>
            <p className={styles.islLetterOpen}>{content.italic}</p>
            <p className={styles.islLetterBody}>{content.aboutCopy}</p>
            <p className={styles.islLetterSign}>{tenant.name}</p>
          </div>
          <ul className={styles.islStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.islStatValue}>{n}</span>
                <span className={styles.islStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {strip.length > 0 ? (
        <section className={styles.islStrip} aria-label="Ur arbetet">
          {strip.map((src, i) => (
            <Reveal
              key={src + i}
              delay={i * 90}
              className={styles.islStripImg}
              style={{ backgroundImage: `url(${src})` }}
            >
              <span />
            </Reveal>
          ))}
        </section>
      ) : null}

      <IsalaraClosing content={content} />
    </div>
  )
}

/* ────────────────────────────  /tjanster  ──────────────────────── */
export function IsalaraTjanster({ content, services }: ThemePageProps) {
  return (
    <div className={styles.islPage}>
      <header className={styles.islPageHead}>
        <p className={styles.islPageEyebrow}>{content.servicesEyebrow}</p>
        <h1 className={styles.islPageTitle}>{content.servicesTitle}</h1>
        {content.servicesIntro ? (
          <p className={styles.islPageLede}>{content.servicesIntro}</p>
        ) : null}
      </header>

      {services.length > 0 ? (
        <section className={styles.islPriceWrap}>
          <div className={styles.islPriceCols}>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i, 8) * 45}>
                <Bookable className={styles.islPriceRow} label={`Boka — ${s.name}`}>
                  <span className={styles.islPriceDot} aria-hidden="true" />
                  <span className={styles.islPriceMain}>
                    <span className={styles.islPriceName}>{s.name}</span>
                    <span className={styles.islPriceDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.islPriceValue}>{formatPrice(s)}</span>
                </Bookable>
              </Reveal>
            ))}
          </div>
        </section>
      ) : (
        // ÄRLIG tom-text — aldrig påhittade tjänster eller priser.
        <Reveal className={styles.islEmpty}>
          <p className={styles.islBody}>
            Prislistan fylls på. Hör av dig så berättar vi vad vi kan binda åt dig.
          </p>
          <div className={styles.islEmptyCta}>
            <Link href="/kontakt" className={styles.islBtn}>
              Kontakta oss
            </Link>
          </div>
        </Reveal>
      )}

      <IsalaraClosing content={content} />
    </div>
  )
}

/* ────────────────────────────  /kontakt  ───────────────────────── */
export function IsalaraKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasAny = !!(location?.address || contact.phone || contact.email || hours)
  return (
    <div className={styles.islPage}>
      <header className={styles.islPageHead}>
        <p className={styles.islPageEyebrow}>{content.contactEyebrow ?? '— Kontakt'}</p>
        <h1 className={styles.islPageTitle}>{content.contactTitle ?? 'Hör av dig'}</h1>
      </header>

      <section className={styles.islContact}>
        <Reveal className={styles.islContactCard}>
          <p className={styles.islContactTitle}>{tenant.name}</p>

          {location?.address ? (
            <p className={styles.islContactLine}>
              <span className={styles.islContactKey}>Adress</span>
              <span className={styles.islContactVal}>{location.address}</span>
            </p>
          ) : null}
          {contact.phone ? (
            <p className={styles.islContactLine}>
              <span className={styles.islContactKey}>Telefon</span>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                className={`${styles.islContactVal} ${styles.islContactLink}`}
              >
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.islContactLine}>
              <span className={styles.islContactKey}>Mejl</span>
              <a
                href={`mailto:${contact.email}`}
                className={`${styles.islContactVal} ${styles.islContactLink}`}
              >
                {contact.email}
              </a>
            </p>
          ) : null}
          {hours
            ? hours.map((h) => (
                <p key={h.day} className={styles.islContactLine}>
                  <span className={styles.islContactKey}>{h.day}</span>
                  <span className={styles.islContactVal}>{h.time}</span>
                </p>
              ))
            : null}

          {!hasAny ? (
            <p className={styles.islContactBody}>
              Kontaktuppgifterna visas så snart de är ifyllda.
            </p>
          ) : null}

          <div className={styles.islContactCta}>
            <BookCta className={`${styles.islBtn} ${styles.islBtnLight}`} />
          </div>

          {location?.address ? (
            <p className={styles.islContactBody}>
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.islContactLink}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            </p>
          ) : null}
        </Reveal>
      </section>
    </div>
  )
}

/* Gemensam avslutning för mallens undersidor — samma marinblå closing som hemmet. */
function IsalaraClosing({ content }: { content: ThemePageProps['content'] }) {
  return (
    <section className={styles.islClosing}>
      <Reveal className={styles.islClosingInner}>
        <h2 className={styles.islClosingTitle}>
          {content.closingTitle ?? 'Redo att beställa något vackert?'}
        </h2>
        <p className={styles.islClosingLede}>
          {content.closingLede ??
            'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.'}
        </p>
        <div className={styles.islClosingCta}>
          <BookCta className={`${styles.islBtn} ${styles.islBtnLight}`} />
        </div>
      </Reveal>
    </section>
  )
}
