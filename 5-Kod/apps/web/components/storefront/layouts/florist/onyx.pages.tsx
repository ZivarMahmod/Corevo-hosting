import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './onyx.module.css'

/**
 * ONYX — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Floristen som aldrig sover." — prosa till vänster,
 *               foto i 4:5 till höger, sedan tre siffror i hårlinje-rastret (21:45 /
 *               7 dgr / 0 st).
 *   /tjanster → filens kurs-/prislist-grammatik: inramad lista, hårlinje mellan raderna,
 *               namn + beskrivning till vänster, mässingspris till höger. Varje rad är
 *               en <Bookable> — FUNKTIONEN är plattformens.
 *   /kontakt  → filens `showKontakt`: "Hör av dig" — faktarutan (STUDION) till vänster,
 *               prosan till höger, båda i hårlinjeramar.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt ritas rutan inte
 * alls — mallen hittar ALDRIG på en adress eller ett telefonnummer.
 *
 * Onyx är MÖRK: varje rot-sektion sätter sin egen svarta bakgrund (.onPage*), så ingen
 * text kan hamna på en ärvd ljus yta.
 */

export function OnyxOm({ content, tenant }: ThemePageProps) {
  const stats = content.stats ?? []

  return (
    <section className={styles.onPage}>
      <div className={styles.onAbout}>
        <div>
          <p className={styles.onEyebrow}>{content.teamEyebrow ?? 'OM ONYX'}</p>
          <h1 className={styles.onAboutTitle}>{content.aboutTitle}</h1>
          <div className={styles.onAboutProse}>
            <p>{content.aboutCopy}</p>
            <p>{content.italic}</p>
            <p>— {tenant.name}</p>
          </div>
        </div>
        <div
          className={styles.onAboutPhoto}
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
      </div>

      {stats.length > 0 ? (
        <ul className={styles.onStats}>
          {stats.map(([num, label]) => (
            <li key={num} className={styles.onStat}>
              <p className={styles.onStatNum}>{num}</p>
              <p className={styles.onStatLabel}>{label}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function OnyxTjanster({ content, services, modules }: ThemePageProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  return (
    <section className={styles.onPageNarrow}>
      <p className={styles.onEyebrow}>{content.servicesEyebrow}</p>
      <h1 className={styles.onPageTitle}>{content.servicesTitle}</h1>
      {services.length === 0 ? (
        <p className={styles.onEmpty}>[ TJÄNSTERNA VISAS SNART ]</p>
      ) : (
        <div className={styles.onList}>
          {services.map((s) => (
            <Bookable enabled={bookingReachable} key={s.id} className={styles.onListRow} label={`BOKA — ${s.name}`}>
              <span>
                <span className={styles.onListName}>{s.name}</span>
                <span className={styles.onListDesc}>{serviceDesc(s)}</span>
              </span>
              <span className={styles.onListPrice}>{formatPrice(s)}</span>
            </Bookable>
          ))}
        </div>
      )}
    </section>
  )
}

export function OnyxKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasFacts = Boolean(location?.address || contact.email || contact.phone || hours)

  return (
    <section className={styles.onPageWide}>
      <p className={styles.onEyebrow}>KONTAKT</p>
      <h1 className={styles.onPageTitle}>{content.closingTitle ?? 'Hör av dig'}</h1>

      <div className={styles.onContact}>
        {hasFacts ? (
          <div className={styles.onBox}>
            <p className={styles.onBoxLabel}>STUDION</p>
            {location?.address ? <p className={styles.onBoxAddress}>{location.address}</p> : null}
            {contact.phone || contact.email ? (
              <p className={styles.onBoxContact}>
                {contact.phone ? (
                  <>
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                    <br />
                  </>
                ) : null}
                {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
              </p>
            ) : null}
            {hours ? (
              <p className={styles.onBoxHours}>
                {hours.map((h) => `${h.day} ${h.time}`).join(' · ').toUpperCase()}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={styles.onBox}>
          <p className={styles.onBoxLabel}>VAD BEHÖVER DU?</p>
          <p className={styles.onBoxProse}>{content.closingLede ?? content.aboutCopy}</p>
          <p className={styles.onBoxProse}>{content.italic}</p>
          {/* Filens formulär (goal-64). Onyx säger "Mejl", inte "E-post", och skriker
              "SKICKA" i versaler — mörk studio-röst, verbatim ur .dc.html. */}
          <ContactForm
            rows={[
              [{ key: 'name', placeholder: 'Namn', required: true }],
              [{ key: 'email', placeholder: 'Mejl', required: true }],
              [{ key: 'message', placeholder: 'Vad behöver du?', required: true }],
            ]}
            submitLabel="SKICKA"
          />
        </div>
      </div>
    </section>
  )
}
