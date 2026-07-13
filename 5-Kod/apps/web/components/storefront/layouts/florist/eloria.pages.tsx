import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { BookCta } from '@/components/brand/BookCta'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './eloria.module.css'

/**
 * ELORIA — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: uppslag i 4:5 till vänster, "Det tidlösa hantverket" till
 *               höger, signerat med husets kursiva devis — och under det siffer-raden
 *               mellan två hårlinjer (100% · Samma dag · Klassisk).
 *   /tjanster → filens `showBrollop`-prislista: guldprickade linjer, namn i garamond till
 *               vänster, pris i guld till höger. Varje rad är en <Bookable> (funktionen är
 *               plattformens), och foten bär filens "Boka konsultation".
 *   /kontakt  → filens `showKontakt`: rubrik + lede, sedan faktaraden i tre kolumner
 *               (Telefon · Butik · Öppet) över en hårlinje.
 *
 * SYNKRONA server-komponenter. Filens kontaktformulär kräver klient-state och ligger i
 * plattformens boknings-/offert-räls — därav <BookCta> i stället för ett eget formulär;
 * mallen bygger ALDRIG egen boknings-logik (vektor-regeln). Render-on-present: saknas
 * adress/kontakt ritas kolumnen inte alls — mallen hittar aldrig på en adress.
 */

export function EloriaOm({ content, tenant }: ThemePageProps) {
  const stats = content.stats ?? []

  return (
    <>
      <section className={styles.elPageWide}>
        <div className={styles.elAbout}>
          <div
            className={styles.elAboutImg}
            style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
          />
          <div>
            <p className={styles.elEyebrow}>{content.teamEyebrow ?? 'Om oss'}</p>
            <h1 className={styles.elAboutTitle}>{content.aboutTitle}</h1>
            <p className={styles.elAboutCopy}>{content.aboutCopy}</p>
            <p className={styles.elAboutItalic}>”{content.italic}”</p>
          </div>
        </div>

        {/* Siffer-raden: tre kolumner, mittkolumnen inramad av lodräta hårlinjer. */}
        {stats.length > 0 ? (
          <div className={styles.elStats}>
            {stats.map(([num, label], i) => (
              <div key={`${num}-${label}`} className={i === 1 ? styles.elStatMid : undefined}>
                <p className={styles.elStatNum}>{num}</p>
                <p className={styles.elStatLabel}>{label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <p className={styles.elSrOnly}>{tenant.name}</p>
    </>
  )
}

export function EloriaTjanster({ content, services }: ThemePageProps) {
  return (
    <section className={styles.elPageNarrow}>
      <p className={styles.elBandEyebrow}>{content.servicesEyebrow}</p>
      <h1 className={styles.elPageTitle}>{content.servicesTitle}</h1>

      {services.length === 0 ? (
        <p className={styles.elEmpty}>Tjänsterna visas snart.</p>
      ) : (
        <>
          <div className={styles.elPriceList}>
            {services.map((s) => (
              <Bookable key={s.id} className={styles.elPriceRow} label={`Boka — ${s.name}`}>
                <span>
                  <span className={styles.elPriceName}>{s.name}</span>
                  <span className={styles.elPriceDesc}>{serviceDesc(s)}</span>
                </span>
                <span className={styles.elPriceValue}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
          <p className={styles.elPriceFoot}>
            <BookCta className={styles.elBtnDark} label="Boka konsultation" />
          </p>
        </>
      )}
    </section>
  )
}

export function EloriaKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.elPageNarrow}>
      <p className={styles.elBandEyebrow}>{content.contactEyebrow ?? 'Kontakt & förfrågan'}</p>
      <h1 className={styles.elPageTitle}>{content.closingTitle ?? 'Skriv till oss'}</h1>
      <p className={styles.elContactProse}>
        {content.closingLede ??
          'Berätta kort om tillfället, datumet och era önskemål — vi återkommer inom en timme under öppettid.'}
      </p>

      {/* Filens kontaktformulär, återställt (goal-64). Eloria är den ENDA mallen med ett
          fjärde fält: "Tillfälle & datum" — det landar i contact_messages.subject, så
          florristen ser direkt vad förfrågan gäller. Knappen heter "Skicka förfrågan"
          (inte "Skicka") precis som i .dc.html. Tidigare låg här en BookCta som skickade
          besökaren till bokningen — men filen ber om ett formulär, inte en bokning. */}
      <div className={styles.elContactFoot}>
        <ContactForm
          rows={[
            [{ key: 'name', label: 'Namn', placeholder: 'för- och efternamn', required: true }],
            [{ key: 'email', label: 'E-post', placeholder: 'namn@adress.se', required: true }],
            [
              {
                key: 'subject',
                label: 'Tillfälle & datum',
                placeholder: 't.ex. bröllop, 14 juni',
              },
            ],
            [
              {
                key: 'message',
                label: 'Ert meddelande',
                placeholder: 'berätta gärna om plats, färger och känsla…',
                required: true,
              },
            ],
          ]}
          submitLabel="Skicka förfrågan"
          doneText="Tack! Vi återkommer inom en timme under öppettid."
        />
      </div>

      <div className={styles.elContactFacts}>
        {contact.phone ? (
          <div>
            <p className={styles.elFactLabel}>Telefon</p>
            <p className={styles.elFactValue}>
              <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
            </p>
          </div>
        ) : null}
        {location?.address ? (
          <div>
            <p className={styles.elFactLabel}>Butik</p>
            <p className={styles.elFactValue}>{location.address}</p>
          </div>
        ) : null}
        {hours ? (
          <div>
            <p className={styles.elFactLabel}>Öppet</p>
            <p className={styles.elFactValue}>
              {hours.map((h) => `${h.day} ${h.time}`).join(' · ')}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
