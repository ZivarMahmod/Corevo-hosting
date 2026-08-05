import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './sivsav.module.css'

/**
 * SIV & SÄV — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Två händer, ett fönster mot norr" — prosa till vänster,
 *               portalfotot (200px upptill) till höger, sedan tre nyckelord över en hårlinje.
 *   /tjanster → filens kort-grammatik: vita 24px-kort, namn + beskrivning till vänster,
 *               pris till höger. Varje rad är en <Bookable> (funktionen är plattformens).
 *   /kontakt  → filens `showKontakt`: faktakolumn (Ateljén / Kontakt / Öppet) till vänster,
 *               vit kort-panel till höger.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt/öppettider ritas
 * blocket inte alls — mallen hittar aldrig på en adress.
 */

export function SivSavOm({ content, tenant }: ThemePageProps) {
  // Filens tre nyckelord under hårlinjen. Ägarens stats vinner när de finns.
  const stats =
    content.stats.length > 0
      ? content.stats.map(([value, label]) => ({ value, label }))
      : [
          { value: 'Säsong', label: 'som enda regel' },
          { value: 'För hand', label: 'varje bukett, varje dag' },
          { value: 'Lugnt', label: 'få buketter om dagen' },
        ]

  return (
    <section className={styles.ssPage}>
      <div className={styles.ssOmSplit}>
        <div>
          <p className={styles.ssEyebrow} data-corevo-editor-field="teamEyebrow" data-corevo-editor-stable-field="teamEyebrow">{content.teamEyebrow ?? 'Om oss'}</p>
          <h1 className={styles.ssOmTitle} data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle}</h1>
          <p className={styles.ssOmBody} data-corevo-editor-field="aboutCopy" data-corevo-editor-stable-field="aboutCopy">{content.aboutCopy}</p>
          <p className={styles.ssOmBody} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
        </div>
        <div
          className={styles.ssOmPhoto}
          data-corevo-editor-field="about_image"
          data-corevo-editor-stable-field="about_image"
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
      </div>

      <div className={styles.ssOmStats}>
        {stats.map((s, index) => (
          <div key={s.value}>
            <p className={styles.ssOmStatValue} data-corevo-editor-field={`stats.${index}.value`} data-corevo-editor-stable-field={`stats.${index}.value`}>{s.value}</p>
            <p className={styles.ssOmStatLabel} data-corevo-editor-field={`stats.${index}.label`} data-corevo-editor-stable-field={`stats.${index}.label`}>{s.label}</p>
          </div>
        ))}
      </div>

      <p className="sr-only">{tenant.name}</p>
    </section>
  )
}

export function SivSavTjanster({ content, services, modules }: ThemePageProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  return (
    <section className={styles.ssPage}>
      <p className={styles.ssEyebrow} data-corevo-editor-field="servicesEyebrow" data-corevo-editor-stable-field="servicesEyebrow">{content.servicesEyebrow}</p>
      <h1 className={styles.ssPageTitle} data-corevo-editor-field="servicesTitle" data-corevo-editor-stable-field="servicesTitle">{content.servicesTitle}</h1>
      {services.length === 0 ? (
        <p className={styles.ssEmpty}>Tjänsterna visas snart.</p>
      ) : (
        <div className={styles.ssServiceList}>
          {services.map((s) => (
            <Bookable slotId={`service:${s.id}`} enabled={bookingReachable} key={s.id} className={styles.ssServiceRow} label={`Boka — ${s.name}`}>
              <span>
                <span className={styles.ssServiceName}>{s.name}</span>
                <span className={styles.ssServiceDesc}>{serviceDesc(s)}</span>
              </span>
              <span className={styles.ssServicePrice}>{formatPrice(s)}</span>
            </Bookable>
          ))}
        </div>
      )}
    </section>
  )
}

export function SivSavKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.ssPage}>
      <h1 className={styles.ssPageTitle} data-corevo-editor-field="contactTitle" data-corevo-editor-stable-field="contactTitle">{content.contactTitle ?? 'Hör av dig'}</h1>

      <div className={styles.ssKontaktGrid}>
        <div>
          {location?.address ? (
            <>
              <p className={styles.ssFactLabel}>Ateljén</p>
              <p className={styles.ssFactValue} data-corevo-editor-field="location.address" data-corevo-editor-stable-field="location.address">{location.address}</p>
            </>
          ) : null}

          {contact.email || contact.phone ? (
            <>
              <p className={styles.ssFactLabel}>Kontakt</p>
              <p className={styles.ssFactValue}>
                {contact.email ? (
                  <>
                    <a href={`mailto:${contact.email}`} data-corevo-editor-field="contact.email" data-corevo-editor-stable-field="contact.email">{contact.email}</a>
                    <br />
                  </>
                ) : null}
                {contact.phone ? (
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} data-corevo-editor-field="contact.phone" data-corevo-editor-stable-field="contact.phone">{contact.phone}</a>
                ) : null}
              </p>
            </>
          ) : null}

          {hours ? (
            <>
              <p className={styles.ssFactLabel}>Öppet</p>
              <p className={styles.ssFactValue}>
                {hours.map((h, index) => <span key={h.day}>{index > 0 ? ' · ' : null}{h.day} <span data-corevo-editor-field={`opening_hours.${index}.time`} data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span></span>)}
              </p>
            </>
          ) : null}
        </div>

        <div className={styles.ssCard}>
          <p className={styles.ssCardProse} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede ?? content.aboutCopy}</p>
          {/* Filens formulär (goal-64): bara placeholders, ingen etikett — skandinavisk
              renhet. Mejl-CTA:n var en amputation; nu skickar rutan på riktigt. */}
          <ContactForm
            rows={[
              [{ key: 'name', placeholder: 'Namn', required: true }],
              [{ key: 'email', placeholder: 'E-post', required: true }],
              [{ key: 'message', placeholder: 'Vad kan vi hjälpa till med?', required: true }],
            ]}
            submitLabel="Skicka"
          />
        </div>
      </div>
    </section>
  )
}
