import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './mina.module.css'

/**
 * MINA — mallens EGNA undersidor (goal-59). Ingen mall i sviten har den här
 * kompositionen:
 *
 *   /om        SMAL CENTRERAD SPALT — samma rena typografiska kolumn som hemmets
 *              om-sektion (38rem, centrerad, ingen sidobild): rubrik → två stycken →
 *              stat-rad → EN citatrad. Ingen team-grid, inget split-foto.
 *   /tjanster  CHIP-GRID — tjänsterna som täta, klickbara pris-CHIPS (rosa platta,
 *              versalt namn, tid + pris), inte en tabell och inte en radlista. Varje
 *              chip är en <Bookable> som öppnar bokningen. services=[] → ärlig
 *              tom-text, aldrig påhittade tjänster.
 *   /kontakt   ETT ENKELT FORMULÄRSKORT — ett kort (mailto-formulär) mot en tunn
 *              faktakolumn (adress · öppettider · kontakt). Render-on-present.
 */
export function MinaOm({ tenant, content }: ThemePageProps) {
  return (
    <div className={styles.miPage}>
      <Reveal className={styles.miPageHead}>
        <p className={styles.miPageEyebrow}>— Om {tenant.name}</p>
        <h1 className={styles.miPageTitle}>{content.aboutTitle}</h1>
      </Reveal>

      <div className={styles.miPageColumn}>
        <Reveal>
          <p className={styles.miProse}>{content.aboutCopy}</p>
          <p className={styles.miProse}>{content.aboutCopyHome}</p>
        </Reveal>

        <Reveal delay={100}>
          <ul className={styles.miStatRow}>
            {content.stats.map(([n, l]) => (
              <li key={l} className={styles.miStatItem}>
                <span className={styles.miStatValue}>{n}</span>
                <span className={styles.miStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal className={styles.miQuoteBand}>
        <p className={styles.miQuote}>{content.italic}</p>
        <div className={styles.miPageFoot}>
          <BookCta className={styles.miPlateCta} />
        </div>
      </Reveal>
    </div>
  )
}

export function MinaTjanster({ tenant, content, services }: ThemePageProps) {
  return (
    <div className={styles.miPage}>
      <Reveal className={styles.miPageHead}>
        <p className={styles.miPageEyebrow}>{content.servicesEyebrow}</p>
        <h1 className={styles.miPageTitle}>{content.servicesTitle}</h1>
        <p className={styles.miPageLede}>
          {content.servicesIntro ??
            `Allt vi gör hos ${tenant.name}. Välj en ruta så öppnas bokningen direkt.`}
        </p>
      </Reveal>

      {services.length > 0 ? (
        <>
          <div className={styles.miChipGrid}>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i, 8) * 50}>
                <Bookable className={styles.miChip} label={`Boka — ${s.name}`}>
                  <span className={styles.miChipName}>{s.name}</span>
                  <span className={styles.miChipDesc}>{serviceDesc(s)}</span>
                  <span className={styles.miChipMeta}>
                    <span className={styles.miChipTime}>{formatDuration(s)}</span>
                    <span className={styles.miChipPrice}>{formatPrice(s)}</span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.miPageFoot}>
            <BookCta className={styles.miPlateCta} />
          </Reveal>
        </>
      ) : (
        <Reveal className={styles.miPageColumn}>
          <p className={styles.miProse}>
            Prislistan fylls på. Hör av dig så berättar vi vad vi kan göra för dig.
          </p>
          <Link href="/kontakt" className={styles.miTextCta}>
            Kontakta oss <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
      )}
    </div>
  )
}

export function MinaKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasContact = !!contact.phone || !!contact.email

  return (
    <div className={styles.miPage}>
      <Reveal className={styles.miPageHead}>
        <p className={styles.miPageEyebrow}>{content.contactEyebrow ?? '— Hör av dig'}</p>
        <h1 className={styles.miPageTitle}>{content.contactTitle ?? 'Kontakt'}</h1>
        <p className={styles.miPageLede}>
          Skriv en rad till {tenant.name} — vi svarar samma dag vi kan.
        </p>
      </Reveal>

      <div className={styles.miContactGrid}>
        {/* Enkelt formulärskort — mailto (ingen server-action behövs för en
            statisk kontaktsida). Renderas bara när e-postadressen finns. */}
        {contact.email ? (
          <Reveal className={styles.miFormCard}>
            <form className={styles.miForm} action={`mailto:${contact.email}`} method="post" encType="text/plain">
              <label className={styles.miField}>
                <span className={styles.miFieldLabel}>Namn</span>
                <input className={styles.miInput} type="text" name="namn" autoComplete="name" required />
              </label>
              <label className={styles.miField}>
                <span className={styles.miFieldLabel}>E-post</span>
                <input className={styles.miInput} type="email" name="epost" autoComplete="email" required />
              </label>
              <label className={styles.miField}>
                <span className={styles.miFieldLabel}>Meddelande</span>
                <textarea className={styles.miTextarea} name="meddelande" rows={5} required />
              </label>
              <button type="submit" className={`btn-accent ${styles.miPlateCta}`}>
                Skicka
              </button>
            </form>
          </Reveal>
        ) : null}

        <Reveal className={styles.miFactCol} delay={100}>
          {location?.address ? (
            <div className={styles.miFact}>
              <p className={styles.miFactLabel}>Adress</p>
              <p className={styles.miFactValue}>{location.address}</p>
              <a
                className={styles.miTextCta}
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            </div>
          ) : null}

          {hours ? (
            <div className={styles.miFact}>
              <p className={styles.miFactLabel}>Öppettider</p>
              <div className={styles.miFactHours}>
                {hours.map((h) => (
                  <div key={h.day} className={styles.miFactHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasContact ? (
            <div className={styles.miFact}>
              <p className={styles.miFactLabel}>Kontakt</p>
              {contact.phone ? (
                <p className={styles.miFactValue}>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                </p>
              ) : null}
              {contact.email ? (
                <p className={styles.miFactValue}>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.miFact}>
            <p className={styles.miFactLabel}>Boka</p>
            <p className={styles.miFactValue}>Lediga tider syns alltid i bokningen.</p>
            <div className={styles.miPageFoot}>
              <BookCta className={styles.miPlateCta} />
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
