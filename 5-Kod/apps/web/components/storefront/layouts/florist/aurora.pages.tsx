import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { ThemePageProps } from './types'
import styles from './aurora.module.css'

/**
 * AURORA — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Vi gillar blommor. Mycket." — text vänster, valv-foto
 *               höger, sedan tre cirkel-porträtt.
 *   /tjanster → filens kurs-grammatik (`showKurser`): höga valv-kort med namn, pris och
 *               en inramad knapp. Knappen är <Bookable> — bokningen är MODULENS.
 *   /kontakt  → filens `showKontakt`: fakta-spalt (telefon/e-post/studio + öppettider) till
 *               vänster, vit platta till höger.
 *
 * Den vita plattan i filen är ett kontaktFORMULÄR — och är det nu på riktigt. Motorn fick
 * sin kontakt-räls i goal-64 (contact_messages + lib/storefront/kontakt/intake.ts +
 * mejl till kunden), så plattan behöver inte längre amputeras till mailto/tel. Fälten är
 * filens EXAKTA: Namn | Telefon på samma rad, sedan Meddelande, knapp "Skicka".
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt ritas blocket inte
 * alls — mallen hittar aldrig på en adress.
 */

export function AuroraOm({ content, tenant }: ThemePageProps) {
  const photo = content.aboutImage ?? content.heroImages[0] ?? ''

  return (
    <div className={styles.auPage}>
      <section className={styles.auSplit}>
        <Reveal>
          <p className={styles.auEyebrow}>Om {tenant.name}</p>
          <h1 className={styles.auSplitTitle}>{content.aboutTitle}</h1>
          <p className={styles.auProse}>{content.aboutCopy}</p>
          <p className={styles.auQuoteInline}>{content.italic}</p>
        </Reveal>
        <Reveal delay={140}>
          <div
            className={styles.auSplitPhoto}
            style={photo ? { backgroundImage: `url(${photo})` } : undefined}
          />
        </Reveal>
      </section>

      {content.team.length > 0 ? (
        <section className={styles.auTeam}>
          {content.team.map((t, i) => (
            <Reveal key={t.name} delay={i * 90} className={styles.auTeamCard}>
              <div
                className={styles.auTeamImg}
                style={t.img ? { backgroundImage: `url(${t.img})` } : undefined}
              />
              <p className={styles.auTeamName}>{t.name}</p>
              <p className={styles.auTeamRole}>{t.role}</p>
            </Reveal>
          ))}
        </section>
      ) : null}
    </div>
  )
}

export function AuroraTjanster({ content, services, modules }: ThemePageProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  const offertReachable = modules?.offertReachable ?? false
  return (
    <div className={styles.auPage}>
      <div className={styles.auPageHead}>
        <p className={styles.auEyebrow}>{content.servicesEyebrow}</p>
        <h1 className={styles.auPageTitle}>{content.servicesTitle}</h1>
        <p className={styles.auPageLede}>
          {content.servicesIntro ??
            'Små grupper, mycket blommor och fika i studion. Alla nivåer är välkomna.'}
        </p>
      </div>

      {services.length === 0 ? (
        <p className={styles.auEmpty}>Tjänsterna visas snart.</p>
      ) : (
        <div className={styles.auGrid3}>
          {services.map((s, i) => (
            <Reveal key={s.id} delay={i * 90} className={styles.auSvcCard}>
              <div
                className={styles.auSvcImg}
                style={
                  content.galleryImages[i % content.galleryImages.length]
                    ? {
                        backgroundImage: `url(${content.galleryImages[i % content.galleryImages.length]})`,
                      }
                    : undefined
                }
              />
              <p className={styles.auSvcName}>{s.name}</p>
              <p className={styles.auSvcDesc}>{serviceDesc(s)}</p>
              <p className={styles.auSvcPrice}>{formatPrice(s)}</p>
              <Bookable enabled={bookingReachable} className={styles.auSvcBook} label={`Boka — ${s.name}`}>
                Boka plats
              </Bookable>
            </Reveal>
          ))}
        </div>
      )}

      <p className={styles.auSvcFoot}>
        Privat grupp eller möhippa?{' '}
        {offertReachable ? <a href="/offert">Be om en offert</a> : <span>Be om en offert</span>}{' '}
        så ordnar vi ett eget event.
      </p>
    </div>
  )
}

export function AuroraKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <div className={styles.auPageMid}>
      <section className={styles.auContact}>
        <Reveal>
          <p className={styles.auEyebrow}>{content.contactEyebrow ?? 'Kontakt'}</p>
          <h1 className={styles.auContactTitle}>{content.contactTitle ?? 'Säg hej!'}</h1>
          <p className={styles.auContactLede}>
            Frågor om en beställning, ett bröllop eller något helt annat? Skriv en rad — vi
            svarar samma dag.
          </p>

          <div className={styles.auFacts}>
            {contact.phone ? (
              <p className={styles.auFact}>
                <span className={styles.auFactLabel}>telefon</span>
                <span className={styles.auFactValue}>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                </span>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.auFact}>
                <span className={styles.auFactLabel}>e-post</span>
                <span className={styles.auFactValue}>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </span>
              </p>
            ) : null}
            {location?.address ? (
              <p className={styles.auFact}>
                <span className={styles.auFactLabel}>studio</span>
                <span className={styles.auFactValue}>{location.address}</span>
              </p>
            ) : null}
          </div>

          {hours ? (
            <div className={styles.auHours}>
              {hours.map((h) => (
                <div key={h.day} className={styles.auHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>

        {/* Filens vita platta ÄR ett kontaktformulär (h2 "Skriv till oss" + Namn|Telefon
            på samma rad + Meddelande + "Skicka"). Den låg som mailto/tel tills motorn
            fick sin kontakt-räls — nu finns den (lib/storefront/kontakt/intake.ts), så
            plattan är åter det designen sa att den var. Fälten är Auroras EXAKTA: namn
            och TELEFON (inte e-post) sida vid sida, sedan meddelandet. */}
        <Reveal delay={140} className={styles.auContactCard}>
          <h2 className={styles.auContactCardTitle}>Skriv till oss</h2>
          <ContactForm
            rows={[
              [
                { key: 'name', label: 'Namn', placeholder: 'Ditt namn', required: true },
                { key: 'phone', label: 'Telefon', placeholder: '07x-…', required: true },
              ],
              [
                {
                  key: 'message',
                  label: 'Meddelande',
                  placeholder: 'Berätta gärna om färger, budget och leveransadress…',
                  rows: 5,
                  required: true,
                },
              ],
            ]}
            submitLabel="Skicka"
            doneText="Tack! Vi hör av oss samma dag."
          />
        </Reveal>
      </section>
    </div>
  )
}
