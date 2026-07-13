import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './blomstertorget.module.css'

/**
 * BLOMSTERTORGET — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Om torget" — 4:3-foto till vänster, tre stycken prosa
 *               till höger (ortsraden inleder första stycket), sedan sifferrutan
 *               64 · 06:45 · 0 kr i en svart 3px-ram.
 *   /tjanster → filens `showKurser` (Kungörelser): radgrammatiken med text till vänster
 *               och pris + "Boka plats" till höger. Varje rad är en <Bookable> —
 *               funktionen är plattformens, formen är tidningens.
 *   /kontakt  → filens `showKontakt` ("Till redaktionen"): faktaspalten (Ståndet ·
 *               Telefon & post · Öppet) till vänster, redaktionsrutan till höger.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt/tider ritas det
 * blocket inte alls — tidningen hittar aldrig på en adress.
 */

export function BlomstertorgetOm({ content, tenant }: ThemePageProps) {
  return (
    <section className={styles.btPage}>
      <h1 className={styles.btPageTitle}>{content.aboutTitle}</h1>
      <p className={styles.btLede}>{content.teamTitle ?? tenant.name}</p>

      <div className={styles.btSplit}>
        <div
          className={styles.btSplitPhoto}
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
        <div className={styles.btProse}>
          <p>
            <span className={styles.btDateline}>{content.findEyebrow ?? 'Hötorget.'}</span>{' '}
            {content.aboutCopy}
          </p>
          {content.whyBody ? <p>{content.whyBody}</p> : null}
          {content.whySub ? <p>{content.whySub}</p> : null}
        </div>
      </div>

      {content.stats.length > 0 ? (
        <ul className={styles.btStats}>
          {content.stats.map(([varde, etikett]) => (
            <li key={etikett} className={styles.btStat}>
              <span className={styles.btStatValue}>{varde}</span>
              <span className={styles.btStatLabel}>{etikett}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function BlomstertorgetTjanster({ content, services }: ThemePageProps) {
  return (
    <section className={styles.btPageNarrow}>
      <h1 className={styles.btPageTitle}>{content.servicesTitle}</h1>
      <p className={styles.btLede}>{content.servicesEyebrow}</p>

      {services.length === 0 ? (
        <p className={styles.btEmpty}>Inga kungörelser är införda ännu.</p>
      ) : (
        <div className={styles.btList}>
          {services.map((s) => (
            <Bookable key={s.id} className={styles.btListRow} label={`Boka plats — ${s.name}`}>
              <span>
                <span className={styles.btListName}>{s.name}</span>
                <span className={styles.btListDesc}>{serviceDesc(s)}</span>
              </span>
              <span className={styles.btListPrice}>{formatPrice(s)}</span>
            </Bookable>
          ))}
        </div>
      )}
    </section>
  )
}

export function BlomstertorgetKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasFacts = !!location?.address || !!contact.phone || !!contact.email || !!hours

  return (
    <section className={styles.btPage}>
      <h1 className={styles.btPageTitle}>{content.contactTitle ?? 'Till redaktionen'}</h1>
      <p className={styles.btLede}>
        {content.contactEyebrow ?? 'Frågor, beröm eller klagomål — allt läses, det mesta besvaras.'}
      </p>

      <div className={styles.btContact}>
        {hasFacts ? (
          <div>
            {location?.address ? (
              <>
                <p className={styles.btFactHead}>Ståndet</p>
                <p className={styles.btFactText}>{location.address}</p>
              </>
            ) : null}
            {contact.phone || contact.email ? (
              <>
                <p className={styles.btFactHead}>Telefon &amp; post</p>
                <p className={styles.btFactText}>
                  {contact.phone ? (
                    <>
                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                      <br />
                    </>
                  ) : null}
                  {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
                </p>
              </>
            ) : null}
            {hours ? (
              <>
                <p className={styles.btFactHead}>Öppet</p>
                <p className={styles.btFactText}>
                  {hours.map((h) => (
                    <span key={h.day}>
                      {h.day} {h.time}
                      <br />
                    </span>
                  ))}
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {/* INSÄNDAREN. Tidningens formulär postar nu på riktigt — motorn fick sin kontakt-
            räls i goal-64, så den döda <a>-knappen är ersatt av en riktig submit. Fälten
            är .dc.html:s exakta: bara placeholders (ingen etikett), gemener, och knappen
            heter "Skicka insändaren" — inte "Skicka". Redaktionens röst, inte vår. */}
        <div className={styles.btBox}>
          <p className={styles.btBoxHead}>Insändare</p>
          <p className={styles.btBoxText}>{content.closingLede ?? content.aboutCopy}</p>
          <ContactForm
            rows={[
              [{ key: 'name', placeholder: 'namn', required: true }],
              [{ key: 'email', placeholder: 'e-post', required: true }],
              [
                {
                  key: 'message',
                  placeholder: 'skriv kort och kärnfullt — redaktionen förkortar ändå',
                  required: true,
                },
              ],
            ]}
            submitLabel="Skicka insändaren"
            doneText="Tack! Insändaren är hos redaktionen."
          />
        </div>
      </div>
    </section>
  )
}
