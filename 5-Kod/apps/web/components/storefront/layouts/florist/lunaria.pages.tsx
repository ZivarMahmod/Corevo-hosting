import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — undersidorna (goal-64, EXAKT kopia ur "Lunaria - Art Déco.dc.html").
 *
 *   /om       → filens `showOm`: "Blomsterboden vid boulevarden" — prosa till vänster, foto i
 *               4:5 i en guldram till höger, sedan sifferbandet (1926 · 100% · IV) i EN
 *               guldram med silverlinjer emellan.
 *   /tjanster → filens `showBoka`-ruta: guldetikett "Ärende", sedan rader med deco-rutan
 *               på snedden, namn till vänster, pris i guld till höger. Varje rad är en
 *               <Bookable> — funktionen är plattformens (drawer eller /boka).
 *   /kontakt  → filens `showKontakt`: faktarutan (Butiken · Kontakt · Öppet) till
 *               vänster, prosan + sänd-knappen till höger.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt ritas rutan inte
 * alls — mallen hittar aldrig på en adress.
 */

export function LunariaOm({ content, tenant }: ThemePageProps) {
  const stats = content.stats ?? []

  return (
    <section className={styles.lnPage}>
      <div className={styles.lnAbout}>
        <div>
          <p className={styles.lnAboutEyebrow} data-corevo-editor-field="teamEyebrow" data-corevo-editor-stable-field="teamEyebrow">{content.teamEyebrow ?? 'Om butiken'}</p>
          <h1 className={styles.lnAboutTitle} data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle}</h1>
          <p className={styles.lnAboutCopy} data-corevo-editor-field="aboutCopy" data-corevo-editor-stable-field="aboutCopy">{content.aboutCopy}</p>
          {content.closingLede ? (
            <p className={styles.lnAboutCopy} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede}</p>
          ) : null}
        </div>
        <div className={styles.lnAboutFrame}>
          <div
            className={styles.lnAboutPhoto}
            data-corevo-editor-field="about_image"
            data-corevo-editor-stable-field="about_image"
            style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
            role="img"
            aria-label={tenant.name}
          />
        </div>
      </div>

      {stats.length > 0 ? (
        <div className={styles.lnStats}>
          {stats.map(([value, label], index) => (
            <div key={label} className={styles.lnStat}>
              <p className={styles.lnStatValue} data-corevo-editor-field={`stats.${index}.value`} data-corevo-editor-stable-field={`stats.${index}.value`}>{value}</p>
              <p className={styles.lnStatLabel} data-corevo-editor-field={`stats.${index}.label`} data-corevo-editor-stable-field={`stats.${index}.label`}>{label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function LunariaTjanster({ content, services, modules }: ThemePageProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  return (
    <section className={styles.lnPageNarrow}>
      <h1 className={styles.lnPageTitle} data-corevo-editor-field="servicesTitle" data-corevo-editor-stable-field="servicesTitle">{content.servicesTitle}</h1>
      <p className={styles.lnPageLede} data-corevo-editor-field="servicesIntro" data-corevo-editor-stable-field="servicesIntro">
        {content.servicesIntro ??
          'Konsultation för bröllop, större arrangemang eller ett samtal om det ni drömmer om.'}
      </p>

      <div className={styles.lnPanel}>
        <p className={styles.lnPanelLabel} data-corevo-editor-field="servicesEyebrow" data-corevo-editor-stable-field="servicesEyebrow">{content.servicesEyebrow}</p>
        {services.length === 0 ? (
          <p className={styles.lnEmpty}>Butikens tjänster visas snart.</p>
        ) : (
          <div className={styles.lnServiceList}>
            {services.map((s) => (
              <Bookable slotId={`service:${s.id}`} enabled={bookingReachable} key={s.id} className={styles.lnServiceRow} label={`Boka — ${s.name}`}>
                <span className={styles.lnDiamond} aria-hidden="true" />
                <span className={styles.lnServiceName}>
                  {s.name}
                  <span className={styles.lnServiceDesc}>{serviceDesc(s)}</span>
                </span>
                <span className={styles.lnServicePrice}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function LunariaKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.lnPage}>
      <h1 className={styles.lnPageTitle} data-corevo-editor-field="contactTitle" data-corevo-editor-stable-field="contactTitle">{content.contactTitle ?? 'Kontakt'}</h1>

      <div className={styles.lnContact}>
        <div className={styles.lnContactBox}>
          {location?.address ? (
            <>
              <p className={styles.lnFactLabel}>Butiken</p>
              <p className={styles.lnFactValue} data-corevo-editor-field="location.address" data-corevo-editor-stable-field="location.address">{location.address}</p>
            </>
          ) : null}
          {contact.email || contact.phone ? (
            <>
              <p className={styles.lnFactLabel}>Kontakt</p>
              <p className={styles.lnFactValue}>
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
              <p className={styles.lnFactLabel}>Öppet</p>
              <p className={styles.lnFactValue}>
                {hours.map((h, index) => <span key={h.day}>{index > 0 ? ' · ' : null}{h.day} <span data-corevo-editor-field={`opening_hours.${index}.time`} data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span></span>)}
              </p>
            </>
          ) : null}
        </div>

        <div className={styles.lnContactBox}>
          <p className={styles.lnContactProse} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede ?? content.aboutCopy}</p>
          {/* Filens formulär, nu kopplat till kontakt-rälsen (goal-64). Lunarias knapp
              heter "Sänd" — inte "Skicka" — och meddelandefältet "Er hälsning". Art déco
              tilltalar i ni-form; den rösten är designens, inte vår att normalisera. */}
          <ContactForm
            rows={[
              [{ key: 'name', placeholder: 'Namn', required: true }],
              [{ key: 'email', placeholder: 'E-post', required: true }],
              [{ key: 'message', placeholder: 'Er hälsning', required: true }],
            ]}
            submitLabel="Sänd"
            doneText="Tack — er hälsning är mottagen."
          />
        </div>
      </div>
    </section>
  )
}
