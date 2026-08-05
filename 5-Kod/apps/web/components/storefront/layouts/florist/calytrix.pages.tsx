import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './calytrix.module.css'

/**
 * CALYTRIX — UNDERSIDORNA (goal-64, exakt kopia ur "Calytrix - E-handel.dc.html").
 *
 *   /om       → filens `showOm`: "Vi packar din beställning" — 56px serif-rubrik och två
 *               stycken prosa till vänster, 5:4-foto till höger, sedan tre kolumner med
 *               2px svart överlinje (Floristerna · Beställningarna · Leveransen).
 *   /tjanster → filens `showLeverans`-grammatik: vita kantade rutor i två kolumner, med
 *               versal eyebrow, priset i display-serif och beskrivningen under. Varje
 *               ruta är en <Bookable> — funktionen är plattformens (samma boknings-
 *               drawer), formen är mallens.
 *   /kontakt  → filens `showKontakt`: faktaraden (telefon/e-post/butik) + öppettider till
 *               vänster, den vita plattan till höger. Plattan ÄR filens kontaktformulär
 *               (Namn · E-post · Meddelande · SKICKA) och skickar nu på riktigt: motorn
 *               fick sin kontakt-räls i goal-64 (contact_messages + mejl till kunden).
 *
 * SYNKRONA server-komponenter (ingen async, ingen 'use client').
 * Render-on-present: saknas adress/telefon/mejl ritas raden inte alls — mallen hittar
 * ALDRIG på en adress.
 */

export function CalytrixOm({ content, tenant }: ThemePageProps) {
  // Filens tre kolumner. Rubrikerna är filens; texterna är dess egna, verbatim.
  const pelare = [
    {
      title: content.pillar1Title ?? 'Floristerna',
      body: content.pillar1Body ?? 'Binder varje beställning för hand, samma dag.',
    },
    {
      title: content.pillar2Title ?? 'Beställningarna',
      body: content.pillar2Body ?? 'Packas svalt och säkert — kortet skrivs för hand.',
    },
    {
      title: content.pillar3Title ?? 'Leveransen',
      body: content.pillar3Body ?? 'Eget bud i stan, kyld transport i resten av landet.',
    },
  ]

  return (
    <section className={styles.cxPage}>
      <div className={styles.cxOmSplit}>
        <div>
          <h1 className={styles.cxPageTitle} data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle}</h1>
          <div className={styles.cxOmProse}>
            <p data-corevo-editor-field="aboutCopy" data-corevo-editor-stable-field="aboutCopy">{content.aboutCopy}</p>
            <p data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
          </div>
        </div>
        <div
          className={styles.cxOmPhoto}
          data-corevo-editor-field="about_image"
          data-corevo-editor-stable-field="about_image"
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
          role="img"
          aria-label={`Ur ${tenant.name}`}
        />
      </div>

      <ul className={styles.cxOmCols}>
        {pelare.map((p, index) => (
          <li key={p.title} className={styles.cxOmCol}>
            <p className={styles.cxOmColTitle} data-corevo-editor-field={`pillar${index + 1}Title`} data-corevo-editor-stable-field={`pillar${index + 1}Title`}>{p.title}</p>
            <p className={styles.cxOmColText} data-corevo-editor-field={`pillar${index + 1}Body`} data-corevo-editor-stable-field={`pillar${index + 1}Body`}>{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CalytrixTjanster({ content, services, modules }: ThemePageProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  return (
    <section className={styles.cxPageNarrow}>
      <h1 className={styles.cxPageTitle} data-corevo-editor-field="servicesTitle" data-corevo-editor-stable-field="servicesTitle">{content.servicesTitle}</h1>
      <p className={styles.cxPageLede} data-corevo-editor-field="servicesIntro" data-corevo-editor-stable-field="servicesIntro">
        {content.servicesIntro ??
          'Vi levererar med eget bud inom staden och med ombud i hela landet. Så här funkar det.'}
      </p>

      {services.length === 0 ? (
        <p className={styles.cxEmpty}>Sortimentet läggs upp inom kort.</p>
      ) : (
        <div className={styles.cxCards2}>
          {services.map((s) => (
            <Bookable slotId={`service:${s.id}`} enabled={bookingReachable} key={s.id} className={styles.cxFact} label={`Beställ — ${s.name}`}>
              <span className={styles.cxFactEyebrow}>{s.name}</span>
              <span className={styles.cxFactValue}>{formatPrice(s)}</span>
              <span className={styles.cxFactText}>{serviceDesc(s)}</span>
            </Bookable>
          ))}
        </div>
      )}
    </section>
  )
}

export function CalytrixKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const address = location?.address ?? null

  return (
    <section className={styles.cxPage}>
      <div className={styles.cxContact}>
        <div>
          <h1 className={styles.cxPageTitle} data-corevo-editor-field="contactTitle" data-corevo-editor-stable-field="contactTitle">{content.contactTitle ?? 'Kontakt'}</h1>
          <p className={styles.cxPageLede} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">
            {content.closingLede ?? 'Frågor om en order? Ange ordernumret så går det fortare.'}
          </p>

          <div className={styles.cxContactRows}>
            {contact.phone ? (
              <p className={styles.cxContactRow}>
                <span className={styles.cxContactLabel}>Telefon&nbsp;&nbsp;</span>
                <span className={styles.cxContactValue}>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} data-corevo-editor-field="contact.phone" data-corevo-editor-stable-field="contact.phone">{contact.phone}</a>
                </span>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.cxContactRow}>
                <span className={styles.cxContactLabel}>E-post&nbsp;&nbsp;</span>
                <span className={styles.cxContactValue}>
                  <a href={`mailto:${contact.email}`} data-corevo-editor-field="contact.email" data-corevo-editor-stable-field="contact.email">{contact.email}</a>
                </span>
              </p>
            ) : null}
            {address ? (
              <p className={styles.cxContactRow}>
                <span className={styles.cxContactLabel}>Butik&nbsp;&nbsp;</span>
                <span className={styles.cxContactValue} data-corevo-editor-field="location.address" data-corevo-editor-stable-field="location.address">{address}</span>
              </p>
            ) : null}
          </div>

          {hours ? (
            <div className={styles.cxHours}>
              {hours.map((h, index) => (
                <div key={h.day} className={styles.cxHoursRow}>
                  <span className={styles.cxHoursDay}>{h.day}</span>
                  <span className={styles.cxHoursTime} data-corevo-editor-field={`opening_hours.${index}.time`} data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <aside className={styles.cxContactCard}>
          <h2 className={styles.cxContactCardTitle}>
            <span data-corevo-editor-field="closingTitle" data-corevo-editor-stable-field="closingTitle">{content.closingTitle ?? 'Någon blir glad idag.'}</span>
          </h2>
          <p className={styles.cxContactCardText}>
            <span data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede ?? 'Vi svarar vardagar 9–18.'}</span>
          </p>
          {/* Filens vita platta = kontaktformuläret (Namn · E-post · Meddelande · SKICKA).
              Den var amputerad till en mailto tills motorn fick sin kontakt-räls; nu
              skickar den på riktigt. Etiketter, placeholders och VERSALERNA i knappen
              är lyfta verbatim ur .dc.html. */}
          <ContactForm
            rows={[
              [{ key: 'name', label: 'Namn', placeholder: 'Ditt namn', required: true }],
              [{ key: 'email', label: 'E-post', placeholder: 'namn@mail.se', required: true }],
              [
                {
                  key: 'message',
                  label: 'Meddelande',
                  placeholder: 'Skriv ditt ärende…',
                  required: true,
                },
              ],
            ]}
            submitLabel="SKICKA"
            doneText="Tack! Vi svarar vardagar 9–18."
          />
        </aside>
      </div>
    </section>
  )
}
