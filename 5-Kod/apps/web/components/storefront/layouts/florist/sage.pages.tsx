import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './sage.module.css'

/**
 * SAGE — mallens EGNA undersidor (goal-59). Tidigare föll varje mall tillbaka på de
 * delade sektionerna (AboutSplit + StylistSpotlights + ServiceMenu + LocationHours) så
 * fort man lämnade hemmet — därför kändes 20 mallar som samma sajt. Sage kör galleri-
 * studions eget språk hela vägen ut:
 *
 *   /om        MUSEAL TVÅ-SPALT — en smal, klibbande vänsterspalt (etikett + versal-
 *              rubrik + hårlinje-fakta) mot ETT stort 4/5-foto och en läsbar textspalt.
 *              Ingen team-rad med runda porträtt; en utställningsskylt.
 *   /tjanster  STRAM TABELL — hårlinje-rader (tjänst · beskrivning · tid · pris), varje
 *              rad en <Bookable> som öppnar bokningen. services=[] → ärlig tom-text,
 *              aldrig påhittade rader.
 *   /kontakt   LUFTIG CENTRERAD KOLUMN — en enda mittkolumn av hårlinje-block: adress,
 *              öppettider, kontakt, karta. Render-on-present hela vägen.
 */
export function SageOm({ tenant, content }: ThemePageProps) {
  return (
    <div className={styles.sgPage}>
      <div className={styles.sgMuseum}>
        <Reveal className={styles.sgMuseumAside}>
          <p className={styles.sgEyebrow}>— Om {tenant.name}</p>
          <h1 className={styles.sgPageTitle}>{content.aboutTitle}</h1>
          <ul className={styles.sgFacts}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.sgFactValue}>{n}</span>
                <span className={styles.sgFactLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className={styles.sgMuseumMain}>
          <div
            className={styles.sgMuseumPhoto}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
            role="img"
            aria-label={`Miljön hos ${tenant.name}`}
          />
          <p className={styles.sgMuseumCaption}>{tenant.name} — i verkstaden</p>
          <p className={styles.sgProse}>{content.aboutCopy}</p>
          <p className={styles.sgProse}>{content.aboutCopyHome}</p>
        </Reveal>
      </div>

      <section className={styles.sgQuoteBand}>
        <Reveal>
          <p className={styles.sgQuote}>&rdquo;{content.italic}&rdquo;</p>
        </Reveal>
      </section>
    </div>
  )
}

export function SageTjanster({ tenant, content, services }: ThemePageProps) {
  return (
    <div className={styles.sgPage}>
      <Reveal className={styles.sgPageHead}>
        <p className={styles.sgEyebrow}>{content.servicesEyebrow}</p>
        <h1 className={styles.sgPageTitle}>{content.servicesTitle}</h1>
        <p className={styles.sgLede}>
          {content.servicesIntro ??
            `Allt vi gör hos ${tenant.name}. Priserna är inkl. moms — välj en rad och boka en tid.`}
        </p>
      </Reveal>

      {services.length > 0 ? (
        <>
          <div className={styles.sgTable}>
            <div className={styles.sgTableHead} aria-hidden="true">
              <span>Tjänst</span>
              <span>Tid</span>
              <span>Pris</span>
            </div>
            {services.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i, 8) * 50}>
                <Bookable className={styles.sgTableRow} label={`Boka — ${s.name}`}>
                  <span className={styles.sgTableMain}>
                    <span className={styles.sgTableName}>{s.name}</span>
                    <span className={styles.sgTableDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.sgTableTime}>{formatDuration(s)}</span>
                  <span className={styles.sgTablePrice}>{formatPrice(s)}</span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.sgPageFoot}>
            <BookCta className={styles.sgPillCta} />
          </Reveal>
        </>
      ) : (
        <Reveal className={styles.sgEmpty}>
          <p className={styles.sgLede}>
            Prislistan fylls på. Hör av dig så berättar vi vad vi kan göra för dig.
          </p>
          <Link href="/kontakt" className={styles.sgBandCta}>
            Kontakta oss
          </Link>
        </Reveal>
      )}
    </div>
  )
}

export function SageKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const hasContact = !!contact.phone || !!contact.email

  return (
    <div className={styles.sgPage}>
      <Reveal className={styles.sgPageHead}>
        <p className={styles.sgEyebrow}>{content.contactEyebrow ?? '— Hitta hit'}</p>
        <h1 className={styles.sgPageTitle}>{content.contactTitle ?? 'Kontakt'}</h1>
        <p className={styles.sgLede}>
          Välkommen in till {tenant.name} — eller hör av dig, vi svarar gärna.
        </p>
      </Reveal>

      <div className={styles.sgColumn}>
        <Reveal className={styles.sgColBlock}>
          <p className={styles.sgColLabel}>Adress</p>
          {location?.address ? (
            <>
              <p className={styles.sgColValue}>{location.address}</p>
              <a
                className={styles.sgBandCta}
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Visa på karta
              </a>
            </>
          ) : (
            <p className={styles.sgColValue}>Visas snart</p>
          )}
        </Reveal>

        <Reveal className={styles.sgColBlock} delay={80}>
          <p className={styles.sgColLabel}>Öppettider</p>
          {hours ? (
            <div className={styles.sgColHours}>
              {hours.map((h) => (
                <div key={h.day} className={styles.sgColHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.sgColValue}>Visas snart</p>
          )}
        </Reveal>

        {hasContact ? (
          <Reveal className={styles.sgColBlock} delay={160}>
            <p className={styles.sgColLabel}>Kontakt</p>
            {contact.phone ? (
              <p className={styles.sgColValue}>
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.sgColValue}>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </p>
            ) : null}
          </Reveal>
        ) : null}

        <Reveal className={styles.sgColBlock} delay={240}>
          <p className={styles.sgColLabel}>Boka</p>
          <p className={styles.sgColValue}>Lediga tider syns alltid i bokningen.</p>
          <div className={styles.sgPageFoot}>
            <BookCta className={styles.sgPillCta} />
          </div>
        </Reveal>
      </div>
    </div>
  )
}
