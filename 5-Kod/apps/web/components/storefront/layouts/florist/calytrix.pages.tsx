import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './calytrix.module.css'

/**
 * CALYTRIX UNDERSIDOR (goal-59) — butikens egna sidor, inte plattformens delade
 * sektioner:
 *   /tjanster → KORT-RUTNÄT (4:5-bild + pris-fot), varje kort i en <Bookable>.
 *   /om       → TIDSLINJE (vertikal rail med noder), inte en foto-split.
 *   /kontakt  → STOR KARTPLATTA med ett flytande kontaktkort ovanpå.
 * Alla tre är server-komponenter (synkrona) och hittar aldrig på data: saknas
 * tjänster/adress/tider ritas en ärlig tomtext i stället.
 */

export function CalytrixTjanster({ tenant, content, services }: ThemePageProps) {
  return (
    <div className={styles.calPage}>
      <header className={styles.calPageHead}>
        <p className="sf-eyebrow">{content.servicesEyebrow}</p>
        <h1 className={styles.calPageTitle}>{content.servicesTitle}</h1>
        <p className={styles.calPageLede}>
          {content.servicesIntro ?? `Beställ eller boka direkt hos ${tenant.name} — klicka på ett kort så öppnas bokningen.`}
        </p>
      </header>

      {services.length > 0 ? (
        <div className={styles.calSrvGrid}>
          {services.map((s, i) => (
            <Reveal key={s.id} as="div" delay={i * 60}>
              <Bookable className={styles.calSrvCard} label={`Boka — ${s.name}`}>
                <div
                  className={styles.calSrvImg}
                  style={{ backgroundImage: `url(${content.galleryImages[i % content.galleryImages.length]})` }}
                  aria-hidden="true"
                />
                <div className={styles.calSrvBody}>
                  <h2 className={styles.calSrvName}>{s.name}</h2>
                  <p className={styles.calSrvDesc}>{serviceDesc(s)}</p>
                </div>
                <div className={styles.calSrvFoot}>
                  <span className={styles.calSrvPrice}>{formatPrice(s)}</span>
                  <span className={styles.calSrvDur}>{formatDuration(s)}</span>
                </div>
              </Bookable>
            </Reveal>
          ))}
        </div>
      ) : (
        <p className={styles.calEmpty}>
          Tjänsterna läggs upp inom kort. Hör gärna av dig så hjälper vi dig direkt.
        </p>
      )}
    </div>
  )
}

export function CalytrixOm({ tenant, content }: ThemePageProps) {
  // Tidslinjens noder = temats stats-trio (värde + etikett) — riktig data, ingen
  // påhittad grundar-historia. Saknas stats ritas bara berättelsen.
  const steps = content.stats
  return (
    <div className={styles.calPage}>
      <header className={styles.calPageHead}>
        <p className="sf-eyebrow">— Om {tenant.name}</p>
        <h1 className={styles.calPageTitle}>{content.aboutTitle}</h1>
        <p className={styles.calPageLede}>{content.aboutCopy}</p>
      </header>

      <div className={styles.calTimeline}>
        {steps.map(([value, label], i) => (
          <Reveal key={label} as="div" delay={i * 90} className={styles.calTlItem}>
            <span className={styles.calTlNum} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className={styles.calTlBody}>
              <h2 className={styles.calTlTitle}>{value}</h2>
              <p className={styles.calTlText}>{label}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal as="div" className={styles.calTlPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }}>
        <span />
      </Reveal>
      <p className={styles.calTlQuote}>{content.italic}</p>
    </div>
  )
}

export function CalytrixKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const address = location?.address ?? null
  const hours = location?.hours ?? null
  const mapHref = address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : null
  return (
    <div className={styles.calPage}>
      <header className={styles.calPageHead}>
        <p className="sf-eyebrow">{content.contactEyebrow ?? '— Kontakt'}</p>
        <h1 className={styles.calPageTitle}>{content.contactTitle ?? 'Hör av dig'}</h1>
      </header>

      {/* STOR KARTPLATTA med flytande kontaktkort ovanpå (mallens signatur-kontaktsida). */}
      <div className={styles.calMapPlate}>
        <div
          className={styles.calMapBg}
          style={{ backgroundImage: `url(${content.closingImage})` }}
          aria-hidden="true"
        />
        <div className={styles.calContactCard}>
          <h2 className={styles.calContactName}>{tenant.name}</h2>

          {address ? (
            <>
              <p className={styles.calContactLabel}>Adress</p>
              <p className={styles.calContactValue}>{address}</p>
            </>
          ) : (
            <p className={styles.calContactValue}>Adress visas snart.</p>
          )}

          {contact.phone || contact.email ? (
            <>
              <p className={styles.calContactLabel}>Kontakt</p>
              {contact.phone ? (
                <p className={styles.calContactValue}>
                  <a className={styles.calContactLink} href={`tel:${contact.phone.replace(/\s+/g, '')}`}>
                    {contact.phone}
                  </a>
                </p>
              ) : null}
              {contact.email ? (
                <p className={styles.calContactValue}>
                  <a className={styles.calContactLink} href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </p>
              ) : null}
            </>
          ) : null}

          {hours ? (
            <>
              <p className={styles.calContactLabel}>Öppettider</p>
              <div className={styles.calContactHours}>
                {hours.map((h) => (
                  <div key={h.day} className={styles.calContactHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className={styles.calContactActions}>
            <BookCta className={styles.calContactCta} />
            {mapHref ? (
              <a className={styles.calContactMapLink} href={mapHref} target="_blank" rel="noreferrer noopener">
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
