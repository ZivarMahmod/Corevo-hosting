import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './wildthistle.module.css'

/**
 * WILD THISTLE — mallens EGNA undersidor (goal-59). Noll delade .sf*-sektioner:
 * /om, /tjanster och /kontakt är komponerade i mallens råa språk — tjock 4px
 * ink-linje under sidhuvudet, streckade linjer, radie 0, tung serif mot
 * mikroversal grotesk.
 *
 *   /om       FÄLTDAGBOK — numrerade anteckningar (01/02/03…) i en spalt, med ett
 *             "inklistrat" foto som bilaga i marginalen (sticky). Statistiken är
 *             en egen anteckning, teamet visas bara när ÄGAREN laddat upp riktiga
 *             medlemmar, och sidan slutar i ett galleri-uppslag.
 *   /tjanster STRECKAD PRISLISTA — en kolumn, löpnummer i moss, punkterad linje
 *             mellan namn och pris, varje rad en <Bookable> som öppnar boknings-
 *             drawern. Inga tjänster → ärlig tom-text, aldrig påhittade rader.
 *   /kontakt  RÅPAPPERS-RUTA — en fyrkantig, ink-ramad platta med streckade rader
 *             (adress/telefon/mejl) + öppettider som egen lista under. Fält som
 *             saknas ritas inte.
 *
 * Sidorna är SYNKRONA server-komponenter (som layouten) — ingen async, ingen
 * 'use client'; Bookable/Gallery/Reveal bär själva sin klient-interaktivitet.
 */

/* ─────────────────────────────  /om  ───────────────────────────── */
export function WildThistleOm({ tenant, content }: ThemePageProps) {
  // Fältdagbokens uppslag: mallens egna, evergreen-rubriker + ägarens/temats copy.
  const entries = [
    { title: content.aboutTitle, text: content.aboutCopy },
    { title: 'Vad vi plockar', text: 'Det som växer nu — tistlar, gräs, grenar och blommor i säsong. Inget flygs in för att se perfekt ut.' },
    { title: 'Hur vi binder', text: 'För hand, rakt och rustikt. Varje bukett blir sin egen; ingen är den andra lik.' },
  ]

  return (
    <div className={styles.wtPage}>
      <header className={styles.wtPageHead}>
        <Reveal>
          <p className={styles.wtEyebrow}>— Om {tenant.name}</p>
          <h1 className={styles.wtPageTitle}>Fältdagbok</h1>
        </Reveal>
      </header>

      <div className={styles.wtPageWrap}>
        <div className={styles.wtJournal}>
          <div>
            {entries.map((e, i) => (
              <Reveal key={e.title} as="div" delay={i * 80} className={styles.wtEntry}>
                <span className={styles.wtEntryNum} aria-hidden="true">
                  {serviceNum(i)}
                </span>
                <div>
                  <h2 className={styles.wtEntryTitle}>{e.title}</h2>
                  <p className={styles.wtEntryText}>{e.text}</p>
                  {i === 0 ? <p className={styles.wtEntryQuote}>”{content.italic}”</p> : null}
                </div>
              </Reveal>
            ))}

            {content.stats.length > 0 ? (
              <Reveal as="div" delay={240} className={styles.wtEntry}>
                <span className={styles.wtEntryNum} aria-hidden="true">
                  {serviceNum(entries.length)}
                </span>
                <div>
                  <h2 className={styles.wtEntryTitle}>Kort om oss</h2>
                  <ul className={styles.wtStats}>
                    {content.stats.map(([n, l]) => (
                      <li key={l}>
                        <span className={styles.wtStatValue}>{n}</span>
                        <span className={styles.wtStatLabel}>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ) : null}
          </div>

          <Reveal as="div" delay={120} className={styles.wtJournalAside}>
            <div
              className={styles.wtJournalPhoto}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
            <p className={styles.wtJournalCaption}>{content.tagline}</p>
          </Reveal>
        </div>

        {/* TEAMET — bara ägarens egna, uppladdade medlemmar (tomt → ingen sektion). */}
        {content.team.length > 0 ? (
          <section>
            <Reveal as="div">
              <p className={styles.wtEyebrow}>{content.teamEyebrow}</p>
              <h2 className={styles.wtH2}>{content.teamTitle}</h2>
            </Reveal>
            <div className={styles.wtTeamGrid}>
              {content.team.map((m, i) => (
                <Reveal key={m.name + i} as="div" delay={i * 80}>
                  <div
                    className={styles.wtTeamPhoto}
                    style={m.img ? { backgroundImage: `url(${m.img})` } : undefined}
                  />
                  <h3 className={styles.wtTeamName}>{m.name}</h3>
                  <p className={styles.wtTeamRole}>{m.role}</p>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <section className={styles.wtGalleryBand}>
        <div className={styles.wtWide}>
          <Reveal className={styles.wtGalleryHead} as="div">
            <p className={styles.wtEyebrow}>{content.galleryEyebrow ?? '— Ur arbetet'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      <WildThistleClosing content={content} />
    </div>
  )
}

/* ────────────────────────────  /tjanster  ──────────────────────── */
export function WildThistleTjanster({ content, services }: ThemePageProps) {
  return (
    <div className={styles.wtPage}>
      <header className={styles.wtPageHead}>
        <Reveal>
          <p className={styles.wtEyebrow}>{content.servicesEyebrow}</p>
          <h1 className={styles.wtPageTitle}>{content.servicesTitle}</h1>
          {content.servicesIntro ? (
            <p className={styles.wtPageLede}>{content.servicesIntro}</p>
          ) : null}
        </Reveal>
      </header>

      <div className={styles.wtPageWrap}>
        {services.length > 0 ? (
          <div className={styles.wtPriceList}>
            {services.map((s, i) => (
              <Reveal key={s.id} as="div" delay={Math.min(i, 8) * 45}>
                <Bookable className={styles.wtPriceRow} label={`Boka — ${s.name}`}>
                  <span className={styles.wtEntryNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.wtPriceName}>{s.name}</span>
                  <span className={styles.wtPriceDots} aria-hidden="true" />
                  <span className={styles.wtPriceDur}>{formatDuration(s)}</span>
                  <span className={styles.wtPriceVal}>{formatPrice(s)}</span>
                </Bookable>
                {serviceDesc(s) ? <p className={styles.wtPriceDesc}>{serviceDesc(s)}</p> : null}
              </Reveal>
            ))}
          </div>
        ) : (
          // ÄRLIG tom-text — aldrig påhittade tjänster/priser.
          <Reveal className={styles.wtEmpty} as="div">
            <p className={styles.wtBody}>
              Prislistan fylls på. Hör av dig så berättar vi vad vi kan binda åt dig.
            </p>
            <div className={styles.wtEmptyActions}>
              <Link href="/kontakt" className={styles.wtInkCta}>
                Kontakta oss
              </Link>
            </div>
          </Reveal>
        )}
      </div>

      <WildThistleClosing content={content} />
    </div>
  )
}

/* ────────────────────────────  /kontakt  ───────────────────────── */
export function WildThistleKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hasAny = !!(location?.address || contact.phone || contact.email)

  return (
    <div className={styles.wtPage}>
      <header className={styles.wtPageHead}>
        <Reveal>
          <p className={styles.wtEyebrow}>{content.contactEyebrow ?? '— Kontakt'}</p>
          <h1 className={styles.wtPageTitle}>{content.contactTitle ?? 'Hör av dig'}</h1>
        </Reveal>
      </header>

      <div className={styles.wtPageWrap}>
        <Reveal className={styles.wtPaperCard} as="div">
          <h2 className={styles.wtEntryTitle}>{tenant.name}</h2>

          {location?.address ? (
            <p className={styles.wtPaperRow}>
              <span className={styles.wtPaperKey}>Adress</span>
              <span className={styles.wtPaperVal}>{location.address}</span>
            </p>
          ) : null}
          {contact.phone ? (
            <p className={styles.wtPaperRow}>
              <span className={styles.wtPaperKey}>Telefon</span>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                className={`${styles.wtPaperVal} ${styles.wtPaperLink}`}
              >
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.wtPaperRow}>
              <span className={styles.wtPaperKey}>Mejl</span>
              <a
                href={`mailto:${contact.email}`}
                className={`${styles.wtPaperVal} ${styles.wtPaperLink}`}
              >
                {contact.email}
              </a>
            </p>
          ) : null}
          {!hasAny ? (
            <p className={styles.wtBody}>Kontaktuppgifterna visas så snart de är ifyllda.</p>
          ) : null}

          <div className={styles.wtPaperActions}>
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.wtLinkCta}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </Reveal>

        {location?.hours ? (
          <Reveal className={styles.wtPaperHours} as="div" delay={120}>
            <p className={styles.wtEyebrow}>— Öppettider</p>
            <div className={styles.wtHours}>
              {location.hours.map((h) => (
                <div key={h.day} className={styles.wtHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          </Reveal>
        ) : null}
      </div>

      <WildThistleClosing content={content} />
    </div>
  )
}

/* Gemensam avslutning för undersidorna — samma mörka fullbredds-foto som hemmet. */
function WildThistleClosing({ content }: { content: ThemePageProps['content'] }) {
  return (
    <section className={styles.wtClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
      <div className={styles.wtClosingOverlay} aria-hidden="true" />
      <div className={styles.wtClosingInner}>
        <Reveal>
          <p className={styles.wtClosingEyebrow}>{content.tagline}</p>
          <h2 className={styles.wtClosingTitle}>
            {content.closingTitle ?? 'Redo för något vilt vackert?'}
          </h2>
          <p className={styles.wtClosingLede}>
            {content.closingLede ?? 'Beställ en bukett, boka en kurskväll eller kom förbi butiken.'}
          </p>
          <div className={styles.wtClosingActions}>
            <BookCta className={styles.wtSquareCta} />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
