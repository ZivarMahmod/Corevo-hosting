import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './solsalt.module.css'

/**
 * SOL & SALT — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Sol i, salt ut, blommor på hörnet" — prosa till vänster,
 *               foto i 4:5 till höger, sedan de tre färgplattorna (solgul · terrakotta · kobolt).
 *   /tjanster → filens `showBoka`-panel: "Boka oss" + lede, sedan uppdragen som rader i ett
 *               papperskort. Varje rad är en <Bookable> (funktionen är plattformens — mallen
 *               bygger ALDRIG egen boknings-logik).
 *   /kontakt  → filens `showKontakt`: koboltplattan (Boden · Nås på · Öppet) till vänster,
 *               papperskortet till höger.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt/tider ritas raden inte
 * alls — mallen hittar aldrig på en adress.
 */

export function SolSaltOm({ content, tenant }: ThemePageProps) {
  return (
    <section className={styles.slPage}>
      <div className={styles.slOmSplit}>
        <div>
          <p className={styles.slEyebrow} data-corevo-editor-field="teamEyebrow" data-corevo-editor-stable-field="teamEyebrow">{content.teamEyebrow}</p>
          <h1 className={styles.slOmTitle} data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle}</h1>
          <p className={styles.slOmBody} data-corevo-editor-field="aboutCopy" data-corevo-editor-stable-field="aboutCopy">{content.aboutCopy}</p>
          <p className={styles.slOmBody} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
        </div>
        <div
          className={styles.slOmPhoto}
          data-corevo-editor-field="about_image"
          data-corevo-editor-stable-field="about_image"
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
          role="img"
          aria-label={tenant.name}
        />
      </div>

      <div className={styles.slFacts}>
        <div className={styles.slFactSun}>
          <p className={`${styles.slFactBig} ${styles.slFactInk}`} data-corevo-editor-field="aboutFact1Value" data-corevo-editor-stable-field="aboutFact1Value">{content.aboutFact1Value}</p>
          <p className={`${styles.slFactSmall} ${styles.slFactInkSoft}`} data-corevo-editor-field="aboutFact1Label" data-corevo-editor-stable-field="aboutFact1Label">{content.aboutFact1Label}</p>
        </div>
        <div className={styles.slFactClay}>
          <p className={`${styles.slFactBig} ${styles.slFactPaper}`} data-corevo-editor-field="aboutFact2Value" data-corevo-editor-stable-field="aboutFact2Value">{content.aboutFact2Value}</p>
          <p className={`${styles.slFactSmall} ${styles.slFactPaper}`} data-corevo-editor-field="aboutFact2Label" data-corevo-editor-stable-field="aboutFact2Label">{content.aboutFact2Label}</p>
        </div>
        <div className={styles.slFactBlue}>
          <p className={`${styles.slFactBig} ${styles.slFactPaper}`} data-corevo-editor-field="aboutFact3Value" data-corevo-editor-stable-field="aboutFact3Value">{content.aboutFact3Value}</p>
          <p className={`${styles.slFactSmall} ${styles.slFactPaperSoft}`} data-corevo-editor-field="aboutFact3Label" data-corevo-editor-stable-field="aboutFact3Label">{content.aboutFact3Label}</p>
        </div>
      </div>
    </section>
  )
}

export function SolSaltTjanster({ content, services, modules }: ThemePageProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  return (
    <section className={styles.slPageNarrow}>
      <p className={styles.slEyebrow} data-corevo-editor-field="servicesEyebrow" data-corevo-editor-stable-field="servicesEyebrow">{content.servicesEyebrow}</p>
      <h1 className={styles.slPageTitle} data-corevo-editor-field="servicesTitle" data-corevo-editor-stable-field="servicesTitle">{content.servicesTitle}</h1>
      <p className={styles.slPageLede} data-corevo-editor-field="servicesIntro" data-corevo-editor-stable-field="servicesIntro">
        {content.servicesIntro ??
          'Bröllop, fest eller ett grönt lyft till kontoret? Boka en tid så pratar vi färg och form.'}
      </p>

      <div className={styles.slPanel}>
        <p className={styles.slPanelLabel}>Vad gäller det?</p>
        {services.length === 0 ? (
          <p className={styles.slEmpty}>Uppdragen visas snart.</p>
        ) : (
          <div className={styles.slList}>
            {services.map((s) => (
              <Bookable slotId={`service:${s.id}`} enabled={bookingReachable} key={s.id} className={styles.slListRow} label={`Boka — ${s.name}`}>
                <span>
                  <span className={styles.slListName}>{s.name}</span>
                  <span className={styles.slListDesc}>{serviceDesc(s)}</span>
                </span>
                <span className={styles.slListPrice}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function SolSaltKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.slPage}>
      <h1 className={styles.slPageTitle} data-corevo-editor-field="contactTitle" data-corevo-editor-stable-field="contactTitle">{content.contactTitle ?? 'Hör av dig'}</h1>

      <div className={styles.slKontakt}>
        <div className={styles.slKontaktCard}>
          {location?.address ? (
            <>
              <p className={styles.slKontaktLabel}>Boden</p>
              <p className={styles.slKontaktValue} data-corevo-editor-field="location.address" data-corevo-editor-stable-field="location.address">{location.address}</p>
            </>
          ) : null}

          {contact.email || contact.phone ? (
            <>
              <p className={styles.slKontaktLabel}>Nås på</p>
              <p className={styles.slKontaktValue}>
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
              <p className={styles.slKontaktLabel}>Öppet</p>
              <p className={styles.slKontaktValue}>
                {hours.map((h, index) => (
                  <span key={h.day}>
                    {h.day} <span data-corevo-editor-field={`opening_hours.${index}.time`} data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span>
                    <br />
                  </span>
                ))}
              </p>
            </>
          ) : null}
        </div>

        {/* Filens högra kort ÄR ett kontaktformulär (Namn · E-post · "Vad kan vi hjälpa
            till med?" · Skicka) — utan etiketter, bara placeholders, precis som .dc.html.
            Det låg som en mejl-CTA tills motorn fick sin kontakt-räls i goal-64; nu
            skickar rutan på riktigt. */}
        <div className={styles.slKontaktForm}>
          <p className={styles.slKontaktIntro} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede ?? content.aboutCopy}</p>
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
