import type { ThemePageProps } from '../florist/types'
import styles from './zentum.pages.module.css'

/**
 * ZENTUM UNDERSIDOR — /om, /tjanster, /kontakt i mallens formspråk.
 * Headern är overlay → varje sida börjar med en navy title-bar (padding-top 140px,
 * exakt som cleanfin header-style-4 kräver). Inga modul-länkar renderas här.
 */

function TitleBar({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <section className={styles.titleBar}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
    </section>
  )
}

export function ZentumOm({ tenant, content }: ThemePageProps) {
  const bild = content.aboutImage || content.heroImages[0] || ''
  return (
    <div className={styles.root}>
      <TitleBar eyebrow="Om oss" title={`Om ${tenant.name}`} />
      <section className={styles.secIntro}>
        <p className={styles.introStatement}>{content.italic}</p>
      </section>
      <section className={styles.secSplit}>
        {bild ? (
          <div className={styles.splitMedia} style={{ backgroundImage: `url(${bild})` }} role="img" aria-label={tenant.name} />
        ) : (
          <div className={styles.splitMedia} />
        )}
        <div className={styles.splitBody}>
          <div className={styles.splitBodyInner}>
            <h2 className={styles.splitTitle}>{content.aboutTitle}</h2>
            <p className={styles.splitLead}>{content.aboutCopy}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export function ZentumTjanster({ content, services }: ThemePageProps) {
  const bilder = content.galleryImages
  return (
    <div className={styles.root}>
      <TitleBar eyebrow="Våra tjänster" title={content.servicesTitle} />
      <section className={styles.secServices}>
        <div className={styles.container}>
          {services.length > 0 ? (
            <div className={styles.servicesGrid}>
              {services.map((s, i) => (
                <article key={s.id} className={styles.serviceCard}>
                  <div className={styles.serviceMedia}>
                    {bilder[i % Math.max(bilder.length, 1)] ? (
                      <img src={bilder[i % bilder.length]} alt={s.name} loading="lazy" />
                    ) : null}
                  </div>
                  <h3 className={styles.serviceTitle}>{s.name}</h3>
                  {s.price_cents != null ? (
                    <p className={styles.servicePrice}>
                      {Math.round(s.price_cents / 100).toLocaleString('sv-SE')} kr
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.sectionDesc}>
              Kontakta oss så berättar vi vad vi kan göra för ditt bolag.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export function ZentumKontakt({ tenant, content, location, contact }: ThemePageProps) {
  return (
    <div className={styles.root}>
      <TitleBar eyebrow="Kontakt" title="Kontakta oss" />
      <section className={styles.secContact}>
        <div className={styles.container}>
          <div className={styles.contactGrid}>
            <div>
              <h2 className={styles.sectionTitle}>{tenant.name}</h2>
              <p className={styles.sectionDesc}>{content.tagline}</p>
              <ul className={styles.contactList}>
                {contact.email ? (
                  <li>
                    <span className={styles.contactLabel}>E-post</span>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li>
                    <span className={styles.contactLabel}>Telefon</span>
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                  </li>
                ) : null}
                {location?.address ? (
                  <li>
                    <span className={styles.contactLabel}>Besök</span>
                    <span>{location.address}</span>
                  </li>
                ) : null}
              </ul>
            </div>

            {/* Formuläret är en mailto-post: ingen kontaktform-motor finns i mallen,
                och ett fält som inte gör något ljuger. */}
            <form className={styles.contactForm} action={`mailto:${contact.email ?? ''}`} method="post">
              <label className={styles.field}>
                <span className={styles.contactLabel}>Namn</span>
                <input type="text" name="namn" required />
              </label>
              <label className={styles.field}>
                <span className={styles.contactLabel}>E-post</span>
                <input type="email" name="epost" required />
              </label>
              <label className={styles.field}>
                <span className={styles.contactLabel}>Meddelande</span>
                <textarea name="meddelande" rows={5} required />
              </label>
              <button type="submit" className={styles.btn}>
                Skicka
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
