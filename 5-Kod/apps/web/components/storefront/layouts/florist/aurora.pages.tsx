import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './aurora.module.css'

/**
 * AURORA — mallens EGNA undersidor (goal-59). Ingen delad .sf*-sektion: /om, /tjanster
 * och /kontakt är komponerade i Auroras eget formspråk (valv-collage, mjuka rundade
 * kort, korall-piller) så mallen läses som en egen sajt hela vägen — inte bara på hemmet.
 *
 *  /om        bildcollage i valv (3 st, förskjutna) + berättelsen i TVÅ spalter + stat-rad
 *  /tjanster  mjuka rundade kort i rutnät, varje kort i en <Bookable> (öppnar bokningen).
 *             Utan tjänster: ärlig tom-text — vi hittar ALDRIG på ett utbud.
 *  /kontakt   ett stort rundat kontakt-kort (korall-kant) med riktiga uppgifter,
 *             render-on-present, plus karta-länk och boknings-CTA.
 */
function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <header className={styles.auPageHead}>
      <p className={styles.auEyebrow}>{eyebrow}</p>
      <h1 className={styles.auPageTitle}>{title}</h1>
      {lede ? <p className={styles.auPageLede}>{lede}</p> : null}
    </header>
  )
}

export function AuroraOm({ tenant, content }: ThemePageProps) {
  const shots = [
    content.aboutImage,
    content.galleryImages[0] ?? content.heroImages[0] ?? '',
    content.galleryImages[1] ?? content.heroImages[1] ?? '',
  ].filter(Boolean)

  return (
    <div className={styles.auRoot}>
      <PageHead eyebrow={`— Om ${tenant.name}`} title={content.aboutTitle} lede={content.italic} />

      {shots.length > 0 ? (
        <section className={styles.auPageSection}>
          <div className={styles.auOmCollage}>
            {shots.map((src, i) => (
              <Reveal
                key={`${src}-${i}`}
                delay={i * 80}
                className={styles.auOmShot}
                style={{ backgroundImage: `url(${src})` }}
              >
                <span />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.auPageSection}>
        <Reveal className={styles.auOmStory}>
          <p className={styles.auOmLead}>{content.aboutCopy}</p>
          <p className={styles.auOmBody}>{content.heroLede}</p>
        </Reveal>
      </section>

      {content.stats.length > 0 ? (
        <section className={styles.auStatBand}>
          <ul className={styles.auStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.auStatValue}>{n}</span>
                <span className={styles.auStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.auClosing}>
        <Reveal>
          <h2 className={styles.auClosingTitle}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={styles.auClosingLede}>
            {content.closingLede ?? 'Hör av dig eller boka en tid — vi hjälper dig gärna.'}
          </p>
          <div className={styles.auClosingActions}>
            <BookCta className={styles.auBtn} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}

export function AuroraTjanster({ content, services }: ThemePageProps) {
  return (
    <div className={styles.auRoot}>
      <PageHead
        eyebrow={content.servicesEyebrow}
        title={content.servicesTitle}
        lede={content.servicesIntro ?? undefined}
      />

      <section className={styles.auPageSection}>
        {services.length > 0 ? (
          <div className={styles.auSvcGrid}>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Bookable className={styles.auSvcCard} label={`Beställ — ${s.name}`}>
                  <h2 className={styles.auSvcName}>{s.name}</h2>
                  <p className={styles.auSvcDesc}>{serviceDesc(s)}</p>
                  <p className={styles.auSvcPrice}>{formatPrice(s)}</p>
                  <span className={styles.auSvcGo} aria-hidden="true">
                    Boka →
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className={styles.auEmpty}>Utbudet fylls på — hör gärna av dig så berättar vi vad vi kan göra för dig.</p>
        )}
      </section>

      <section className={styles.auClosing}>
        <Reveal>
          <h2 className={styles.auClosingTitle}>{content.closingTitle ?? 'Vill du ha något särskilt?'}</h2>
          <p className={styles.auClosingLede}>
            {content.closingLede ?? 'Vi binder gärna efter dina önskemål — boka en tid så pratar vi ihop oss.'}
          </p>
          <div className={styles.auClosingActions}>
            <BookCta className={styles.auBtn} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}

export function AuroraKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const address = location?.address ?? null

  return (
    <div className={styles.auRoot}>
      <PageHead
        eyebrow={content.contactEyebrow ?? '— Hitta hit'}
        title={content.contactTitle ?? 'Säg hej'}
        lede={`Kom förbi butiken, ring eller mejla — vi finns här för dig som vill ha blommor från ${tenant.name}.`}
      />

      <section className={styles.auPageSection}>
        <Reveal className={styles.auContactCard}>
          <div className={styles.auContactGrid}>
            <div className={styles.auContactBlock}>
              <h2 className={styles.auContactHead}>Adress</h2>
              {address ? (
                <>
                  <p className={styles.auContactValue}>{address}</p>
                  <a
                    className={styles.auBandCta}
                    href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Visa på karta
                  </a>
                </>
              ) : (
                <p className={styles.auContactValue}>Visas snart</p>
              )}
            </div>

            <div className={styles.auContactBlock}>
              <h2 className={styles.auContactHead}>Öppettider</h2>
              {hours ? (
                <div className={styles.auContactHours}>
                  {hours.map((h) => (
                    <p key={h.day} className={styles.auContactHoursRow}>
                      <span>{h.day}</span>
                      <span>{h.time}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className={styles.auContactValue}>Visas snart</p>
              )}
            </div>

            {contact.phone || contact.email ? (
              <div className={styles.auContactBlock}>
                <h2 className={styles.auContactHead}>Kontakt</h2>
                {contact.phone ? (
                  <p className={styles.auContactValue}>
                    <a className={styles.auFootLink} href={`tel:${contact.phone.replace(/\s+/g, '')}`}>
                      {contact.phone}
                    </a>
                  </p>
                ) : null}
                {contact.email ? (
                  <p className={styles.auContactValue}>
                    <a className={styles.auFootLink} href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className={styles.auContactItalic}>”{content.italic}”</p>
          <div className={styles.auContactActions}>
            <BookCta className={styles.auBtn} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
