import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
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
 * Den vita plattan i filen är ett kontaktFORMULÄR. Formuläret är designens BILD av
 * kontakt-modulen; plattformen har ingen formulärs-endpoint på /kontakt, och en ruta som
 * inte skickar något är värre än ingen ruta. Plattan behåller därför sin form och sin text,
 * men handlingen går via mailto/tel — de kanaler som FAKTISKT når florristen.
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

export function AuroraTjanster({ content, services }: ThemePageProps) {
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
              <Bookable className={styles.auSvcBook} label={`Boka — ${s.name}`}>
                Boka plats
              </Bookable>
            </Reveal>
          ))}
        </div>
      )}

      <p className={styles.auSvcFoot}>
        Privat grupp eller möhippa? <a href="/offert">Be om en offert</a> så ordnar vi ett eget
        event.
      </p>
    </div>
  )
}

export function AuroraKontakt({ content, tenant, location, contact }: ThemePageProps) {
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

        <Reveal delay={140} className={styles.auContactCard}>
          <h2 className={styles.auContactCardTitle}>Skriv till oss</h2>
          <p className={styles.auContactCardBody}>
            Berätta gärna om färger, budget och leveransadress — så återkommer vi med ett
            förslag. Vill du hellre prata? Ring, så tar vi det direkt.
          </p>
          <div className={styles.auContactActions}>
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className={styles.auBtn}>
                Skicka ett mejl
              </a>
            ) : null}
            {contact.phone ? (
              <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.auLink}>
                ring {tenant.name.toLowerCase()} →
              </a>
            ) : null}
          </div>
        </Reveal>
      </section>
    </div>
  )
}
