import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — mallens EGNA undersidor (goal-59 tema-paket). Tidigare föll varje mall
 * tillbaka på de DELADE sektionerna så fort man lämnade hemmet — därför kändes hela
 * sviten som samma sajt. Lunaria kör sitt eget språk (offset + hårlinjer + stora tal)
 * hela vägen ut:
 *
 *   /om        OFFSET-UPPSLAG — samma grammatik som hemmets hero: ett foto till höger
 *              och en textplatta som skjuter UT över dess vänsterkant. Under: en
 *              hårlinje-delad faktarad och en citat-remsa i vetefärg. Ingen team-rad.
 *   /tjanster  LUGN LISTA — stora display-siffror (nummer vänster, pris höger) på
 *              hårlinje-rader, varje rad en <Bookable> som öppnar bokningen.
 *              services=[] → ärlig tom-text, aldrig påhittade rader.
 *   /kontakt   ÖVERLAPPANDE KORT — ett nattblått foto-band med ett ljust kort som
 *              ligger OVANPÅ dess nederkant (adress · tider · kontakt · boka).
 *              Render-on-present hela vägen.
 */
export function LunariaOm({ tenant, content }: ThemePageProps) {
  return (
    <div className={styles.lnPage}>
      <section className={styles.lnSpread}>
        <div className={styles.lnSpreadFrame}>
          <Reveal
            className={styles.lnSpreadPhoto}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
          >
            <span />
          </Reveal>
          <Reveal delay={140} className={styles.lnSpreadCard}>
            <p className={styles.lnEyebrow}>— Om {tenant.name}</p>
            <h1 className={styles.lnPageTitle}>{content.aboutTitle}</h1>
            <p className={styles.lnBody}>{content.aboutCopy}</p>
            <p className={styles.lnBody}>{content.aboutCopyHome}</p>
          </Reveal>
        </div>
      </section>

      <section className={styles.lnFactBand}>
        <Reveal>
          <ul className={styles.lnFactRow}>
            {content.stats.map(([n, l]) => (
              <li key={l} className={styles.lnFact}>
                <span className={styles.lnStatValue}>{n}</span>
                <span className={styles.lnStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className={styles.lnQuoteBand}>
        <Reveal>
          <p className={styles.lnQuote}>&rdquo;{content.italic}&rdquo;</p>
        </Reveal>
      </section>
    </div>
  )
}

export function LunariaTjanster({ tenant, content, services }: ThemePageProps) {
  return (
    <div className={styles.lnPage}>
      <Reveal className={styles.lnPageHead}>
        <p className={styles.lnEyebrow}>{content.servicesEyebrow}</p>
        <h1 className={styles.lnPageTitle}>{content.servicesTitle}</h1>
        <p className={styles.lnHeroLede}>
          {content.servicesIntro ??
            `Allt vi gör hos ${tenant.name}. Välj en rad så öppnar vi bokningen.`}
        </p>
      </Reveal>

      {services.length > 0 ? (
        <div className={styles.lnNarrow}>
          <div className={styles.lnPriceList}>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i, 8) * 50}>
                <Bookable className={styles.lnPriceRow} label={`Beställ — ${s.name}`}>
                  <span className={styles.lnPriceNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.lnPriceMain}>
                    <span className={styles.lnPriceName}>{s.name}</span>
                    <span className={styles.lnPriceDesc}>{serviceDesc(s)}</span>
                    <span className={styles.lnPriceTime}>{formatDuration(s)}</span>
                  </span>
                  <span className={styles.lnPriceValue}>{formatPrice(s)}</span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.lnPageFoot}>
            <BookCta className={styles.lnCta} />
          </Reveal>
        </div>
      ) : (
        <Reveal className={styles.lnPageFoot}>
          <p className={styles.lnBody} style={{ margin: '0 auto' }}>
            Prislistan fylls på. Hör av dig så berättar vi vad vi kan göra för dig.
          </p>
          <Link href="/kontakt" className={styles.lnBandCta}>
            Kontakta oss
          </Link>
        </Reveal>
      )}
    </div>
  )
}

export function LunariaKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasContact = !!contact.phone || !!contact.email
  const bandPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''

  return (
    <div className={styles.lnPage}>
      <section className={styles.lnContactWrap}>
        <div
          className={styles.lnContactBand}
          style={bandPhoto ? { backgroundImage: `url(${bandPhoto})` } : undefined}
        >
          <div className={styles.lnContactScrim} />
        </div>

        {/* Kortet ligger OVANPÅ bandets nederkant — samma offset-grammatik som heron. */}
        <Reveal className={styles.lnContactCard}>
          <p className={styles.lnEyebrow}>{content.contactEyebrow ?? '— Hitta hit'}</p>
          <h1 className={styles.lnPageTitle}>{content.contactTitle ?? 'Kontakt'}</h1>
          <p className={styles.lnBody}>
            Välkommen in till {tenant.name} — eller hör av dig, vi svarar gärna.
          </p>

          <div className={styles.lnContactGrid}>
            <div className={styles.lnContactBlock}>
              <p className={styles.lnContactLabel}>Adress</p>
              {location?.address ? (
                <>
                  <p className={styles.lnContactValue}>{location.address}</p>
                  <a
                    className={styles.lnBandCta}
                    style={{ margin: '20px 0 0' }}
                    href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Visa på karta
                  </a>
                </>
              ) : (
                <p className={styles.lnContactValue}>Visas snart</p>
              )}
            </div>

            <div className={styles.lnContactBlock}>
              <p className={styles.lnContactLabel}>Öppettider</p>
              {hours ? (
                <div className={styles.lnHours}>
                  {hours.map((h) => (
                    <div key={h.day} className={styles.lnHoursRow}>
                      <span>{h.day}</span>
                      <span>{h.time}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.lnContactValue}>Visas snart</p>
              )}
            </div>

            {hasContact ? (
              <div className={styles.lnContactBlock}>
                <p className={styles.lnContactLabel}>Kontakt</p>
                {contact.phone ? (
                  <p className={styles.lnContactValue}>
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                  </p>
                ) : null}
                {contact.email ? (
                  <p className={styles.lnContactValue}>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={styles.lnContactActions}>
            <BookCta className={styles.lnCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
