import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './eloria.module.css'

/**
 * ELORIA — TEMA-PAKETETS UNDERSIDOR (goal-59). Före det här renderade alla mallar samma
 * AboutSplit / ServiceMenu / LocationHours på /om, /tjanster och /kontakt — sidan föll
 * tillbaka i plattformens skelett så fort man lämnade hemmet.
 *
 * Eloria svarar med sitt eget klassiska språk, samma tre grepp som hemmet: den mörkgröna
 * plattan med guldram, prislistans guld-ledare och det guldramade kortet.
 *   /om       — SIDHUVUD som mörkgrön guldramad platta + ett klassiskt UPPSLAG i guldram
 *               (porträttfoto | text med anfang), stat-trio med guld-ledare, teamet (bara
 *               när ägaren laddat upp riktiga medarbetare) och en avslutande guldram.
 *   /tjanster — hela prislistan med guld-ledare; VARJE rad är en <Bookable> som öppnar
 *               bokningen. Inga tjänster → ärlig tom-text, aldrig påhittade rader.
 *   /kontakt  — ETT guldramat kort med besöksuppgifter i vänsterspalten och öppettiderna
 *               som prislista i högerspalten. Render-on-present hela vägen.
 */

/** Sidhuvud — mörkgrön guldramad platta (samma signatur som heroplattan på hemmet). */
function EloriaPlate({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <section className={styles.elPageHead}>
      <Reveal className={styles.elPagePlate}>
        <span className={styles.elEyebrowDark}>{eyebrow}</span>
        <h1 className={styles.elPageTitle}>{title}</h1>
        {lede ? <p className={styles.elPageLede}>{lede}</p> : null}
      </Reveal>
    </section>
  )
}

export function EloriaOm({ tenant, content }: ThemePageProps) {
  const team = content.team

  return (
    <>
      <EloriaPlate eyebrow={`— Om ${tenant.name}`} title={content.aboutTitle} lede={content.italic} />

      {/* Uppslaget — guldram runt HELA ytan, porträtt till vänster, sättningen till höger. */}
      <section className={styles.elSpreadSection}>
        <Reveal className={styles.elSpread}>
          <div
            className={styles.elSpreadPhoto}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
            role="img"
            aria-label={`Miljön hos ${tenant.name}`}
          />
          <div className={styles.elSpreadCopy}>
            <p className={styles.elEyebrow}>— Vårt hantverk</p>
            <p className={styles.elSpreadLead}>{content.aboutCopy}</p>
            <ul className={styles.elFacts}>
              {content.stats.map(([n, l]) => (
                <li key={l} className={styles.elFactRow}>
                  <span className={styles.elFactLabel}>{l}</span>
                  <span className={styles.elPriceDots} aria-hidden="true" />
                  <span className={styles.elFactValue}>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Teamet är ÄGAR-ONLY (content.team = uppladdade medarbetare). Tomt → ingen sektion,
          aldrig stock-ansikten presenterade som kundens personal. */}
      {team.length > 0 ? (
        <section className={styles.elTeamSection}>
          <Reveal className={styles.elSecHead}>
            <p className={styles.elEyebrow}>{content.teamEyebrow}</p>
            <h2 className={styles.elH2}>{content.teamTitle}</h2>
          </Reveal>
          <div className={styles.elTeamGrid}>
            {team.map((m, i) => (
              <Reveal key={`${m.name}-${i}`} delay={i * 90} className={styles.elTeamCard}>
                {m.img ? (
                  <div className={styles.elTeamPhoto} style={{ backgroundImage: `url(${m.img})` }} />
                ) : (
                  <div className={styles.elTeamPhoto}>
                    <span className={styles.elTeamMonogram} aria-hidden="true">
                      {m.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() ?? '')
                        .join('')}
                    </span>
                  </div>
                )}
                <span className={styles.elCardRule} aria-hidden="true" />
                <h3 className={styles.elCardName}>{m.name}</h3>
                <p className={styles.elCardExcerpt}>{m.role}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* Avslutning — guldramad platta, samma bracket som hemmets closing. */}
      <section className={styles.elPageHead}>
        <Reveal className={styles.elPagePlate}>
          <span className={styles.elEyebrowDark}>— Välkommen in</span>
          <h2 className={styles.elPageTitle}>{content.closingTitle ?? 'Låt oss binda något åt dig'}</h2>
          <p className={styles.elPageLede}>
            {content.closingLede ?? 'Beställ, begär en offert eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.elClosingActions}>
            <BookCta className={styles.elPlateCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}

export function EloriaTjanster({ content, services }: ThemePageProps) {
  return (
    <>
      <EloriaPlate
        eyebrow={content.servicesEyebrow}
        title={content.servicesTitle}
        lede={content.servicesIntro ?? 'Klicka på en rad för att boka — priserna nedan är våra ordinarie.'}
      />

      <section className={styles.elPricePage}>
        <div className={styles.elPricePageInner}>
          {services.length > 0 ? (
            <>
              <div className={styles.elPriceList}>
                {services.map((s, i) => (
                  <Reveal key={s.id} delay={Math.min(i, 8) * 50}>
                    <Bookable className={styles.elPriceRow} label={`Boka — ${s.name}`}>
                      <span className={styles.elPriceMain}>
                        <span className={styles.elPriceName}>{s.name}</span>
                        <span className={styles.elPriceDesc}>{serviceDesc(s)}</span>
                      </span>
                      <span className={styles.elPriceDots} aria-hidden="true" />
                      <span className={styles.elPriceVal}>{formatPrice(s)}</span>
                    </Bookable>
                  </Reveal>
                ))}
              </div>
              <Reveal className={styles.elSecFoot}>
                <BookCta className={styles.elPlateCtaLight} />
              </Reveal>
            </>
          ) : (
            <Reveal className={styles.elEmpty}>
              <p className={styles.elBody}>
                Prislistan fylls på inom kort. Hör gärna av dig så berättar vi vad vi kan göra för dig.
              </p>
              <Link href="/kontakt" className={styles.elMoreLink}>
                Kontakta oss <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          )}
        </div>
      </section>
    </>
  )
}

export function EloriaKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasContact = !!contact.email || !!contact.phone

  return (
    <>
      <EloriaPlate
        eyebrow={content.contactEyebrow ?? '— Kontakt'}
        title={content.contactTitle ?? 'Hitta hit'}
        lede={`Välkommen in till ${tenant.name} — eller hör av dig så hjälper vi dig på vägen.`}
      />

      {/* ETT guldramat kort: besöksuppgifter | öppettider. */}
      <section className={styles.elContactSection}>
        <Reveal className={styles.elContactCard}>
          <div className={styles.elContactCol}>
            <p className={styles.elEyebrow}>— Adress</p>
            {location?.address ? (
              <>
                <p className={styles.elContactValue}>{location.address}</p>
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.elMapLink}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              </>
            ) : (
              <p className={styles.elBody}>Adressen visas så snart den är ifylld.</p>
            )}

            {hasContact ? (
              <>
                <p className={`${styles.elEyebrow} ${styles.elContactGap}`}>— Kontakt</p>
                {contact.phone ? (
                  <p className={styles.elContactValue}>
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.elContactLink}>
                      {contact.phone}
                    </a>
                  </p>
                ) : null}
                {contact.email ? (
                  <p className={styles.elContactValue}>
                    <a href={`mailto:${contact.email}`} className={styles.elContactLink}>
                      {contact.email}
                    </a>
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className={styles.elContactCol}>
            <p className={styles.elEyebrow}>— Öppettider</p>
            {hours ? (
              <ul className={styles.elFacts}>
                {hours.map((h) => (
                  <li key={h.day} className={styles.elFactRow}>
                    <span className={styles.elFactLabel}>{h.day}</span>
                    <span className={styles.elPriceDots} aria-hidden="true" />
                    <span className={styles.elFactValue}>{h.time}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.elBody}>Öppettiderna visas så snart de är ifyllda.</p>
            )}
            <div className={styles.elClosingActions}>
              <BookCta className={styles.elPlateCtaLight} />
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
