import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { AteljeVinterKontaktForm } from './ateljevinter.kontaktform'
import type { ThemePageProps } from './types'
import styles from './ateljevinter.module.css'

/**
 * ATELJÉ VINTER — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "två händer, ett bord" — foto i 4:5 till vänster,
 *               tre stycken prosa till höger, signerat.
 *   /tjanster → filens prislist-grammatik: hårlinje-rader, namn till vänster, pris till
 *               höger. Varje rad är en <Bookable> (funktionen är plattformens).
 *   /kontakt  → filens `showKontakt`: faktaraden (ateljén / nås på) över en hårlinje,
 *               sedan formuläret.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt ritas rutan inte
 * alls — mallen hittar aldrig på en adress.
 */

export function AteljeVinterOm({ content, tenant }: ThemePageProps) {
  return (
    <section className={styles.avPage}>
      <p className={styles.avEyebrow}>{content.teamEyebrow ?? 'ateljén'}</p>
      <h1 className={styles.avPageTitle}>{content.aboutTitle}</h1>
      <div className={styles.avSplit}>
        <div
          className={styles.avSplitPhoto}
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
        <div className={styles.avProse}>
          <p>{content.aboutCopy}</p>
          <p>{content.italic}</p>
          <p>— {tenant.name}</p>
        </div>
      </div>
    </section>
  )
}

export function AteljeVinterTjanster({ content, services }: ThemePageProps) {
  return (
    <section className={styles.avPageNarrow}>
      <p className={styles.avEyebrow}>{content.servicesEyebrow}</p>
      <h1 className={styles.avPageTitle}>{content.servicesTitle}</h1>
      {services.length === 0 ? (
        <p className={styles.avEmpty}>tjänsterna visas snart.</p>
      ) : (
        <div className={styles.avList}>
          {services.map((s) => (
            <Bookable key={s.id} className={styles.avListRow} label={`beställ — ${s.name}`}>
              <span>
                <span className={styles.avListName}>{s.name}</span>
                <span className={styles.avListDesc}>{serviceDesc(s)}</span>
              </span>
              <span className={styles.avListPrice}>{formatPrice(s)}</span>
            </Bookable>
          ))}
        </div>
      )}
    </section>
  )
}

export function AteljeVinterKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.avPageNarrow}>
      <p className={styles.avEyebrow}>kontakt</p>
      <h1 className={styles.avPageTitle}>{content.closingTitle ?? 'skriv en rad'}</h1>

      <div className={styles.avFacts}>
        {location?.address ? (
          <div>
            <p className={styles.avFactLabel}>ateljén</p>
            <p className={styles.avFactValue}>{location.address}</p>
          </div>
        ) : null}
        {contact.email || contact.phone || hours ? (
          <div>
            <p className={styles.avFactLabel}>nås på</p>
            <p className={styles.avFactValue}>
              {contact.email ? (
                <>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  <br />
                </>
              ) : null}
              {contact.phone ? (
                <>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                  <br />
                </>
              ) : null}
              {hours ? hours.map((h) => `${h.day} ${h.time}`).join(' · ') : null}
            </p>
          </div>
        ) : null}
      </div>

      <p className={styles.avProse}>{content.closingLede ?? content.aboutCopy}</p>

      {/* Filens formulär (goal-64 regression): egen understruken markup i stället
          för det delade boxade ContactForm-fältet — samma understrykning som
          offert/kurser/kassa. Ateljé Vinter skriver ALLT i gemener. */}
      <AteljeVinterKontaktForm doneText="tack — vi läser och hör av oss." />
    </section>
  )
}
