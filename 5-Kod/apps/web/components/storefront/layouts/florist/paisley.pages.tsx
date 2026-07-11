import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './paisley.module.css'

/**
 * PAISLEYS EGNA UNDERSIDOR (goal-59). Tidigare föll varje mall ner i de delade
 * AboutSplit/ServiceMenu/LocationHours-sektionerna så fort man lämnade hemmet —
 * här är sidorna satta som TIDNINGSSIDOR i stället:
 *   /om        REPORTAGE — kicker, enorm rubrik, byline-linjal, ingress i spalt-
 *              bredd, brödtext i två riktiga textspalter, urklippt citat + faktaruta.
 *   /tjanster  PRISLISTA i tidningsspalt — punktlinje-rader (namn … pris) i två
 *              spalter, varje rad en <Bookable>. Tomt = ärlig rad, aldrig påhittat.
 *   /kontakt   KOLOFON — kort med adress/tider/kontakt, render-on-present.
 */

/* ── /om — reportage ─────────────────────────────────────────────────────────── */
export function PaisleyOm({ tenant, content }: ThemePageProps) {
  return (
    <div className={styles.paPage}>
      <article className={styles.paReportage}>
        <Reveal>
          <p className={styles.paKicker}>Reportage · Om {tenant.name}</p>
          <h1 className={styles.paPageTitle}>{content.aboutTitle}</h1>
          <div className={styles.paByline}>
            <span>Av redaktionen</span>
            <span>{tenant.name}</span>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <p className={styles.paIngress}>{content.aboutCopy}</p>
        </Reveal>

        <Reveal delay={120}>
          <div className={styles.paPlate} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          <p className={styles.paCaption}>{content.tagline}</p>
        </Reveal>

        <Reveal delay={160}>
          <div className={styles.paColumns}>
            <p>{content.aboutCopyHome}</p>
            <p className={styles.paPull}>{content.italic}</p>
            <p>{content.heroLede}</p>
          </div>
        </Reveal>

        {content.stats.length > 0 ? (
          <Reveal delay={200}>
            <aside className={styles.paFactbox}>
              <p className={styles.paFactHead}>Fakta</p>
              <dl className={styles.paFactList}>
                {content.stats.map(([n, l]) => (
                  <div key={l} className={styles.paFactRow}>
                    <dt>{n}</dt>
                    <dd>{l}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </Reveal>
        ) : null}

        <Reveal delay={240} className={styles.paPageEnd}>
          <BookCta className={styles.paSquareCta} />
        </Reveal>
      </article>
    </div>
  )
}

/* ── /tjanster — prislista i tidningsspalt ───────────────────────────────────── */
export function PaisleyTjanster({ tenant, content, services }: ThemePageProps) {
  return (
    <div className={styles.paPage}>
      <div className={styles.paListHead}>
        <Reveal>
          <p className={styles.paKicker}>{content.servicesEyebrow}</p>
          <h1 className={styles.paPageTitle}>{content.servicesTitle}</h1>
          <p className={styles.paIngress}>
            {content.servicesIntro ??
              `Alla priser inkl. moms. Klicka en rad för att boka tid hos ${tenant.name}.`}
          </p>
        </Reveal>
      </div>

      {services.length > 0 ? (
        <>
          <ol className={styles.paPriceList}>
            {services.map((s, i) => (
              <li key={s.id}>
                <Bookable className={styles.paPriceRow} label={`Boka — ${s.name}`}>
                  <span className={styles.paPriceNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.paPriceBody}>
                    <span className={styles.paPriceName}>{s.name}</span>
                    <span className={styles.paPriceDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.paPriceDots} aria-hidden="true" />
                  <span className={styles.paPriceMeta}>
                    <span className={styles.paPriceDur}>{formatDuration(s)}</span>
                    <span className={styles.paPriceKr}>{formatPrice(s)}</span>
                  </span>
                </Bookable>
              </li>
            ))}
          </ol>
          <div className={styles.paPageEnd}>
            <BookCta className={styles.paSquareCta} />
          </div>
        </>
      ) : (
        <p className={styles.paEmpty}>
          Prislistan uppdateras just nu. Hör av dig så berättar vi vad vi kan göra för dig —{' '}
          <Link href="/kontakt">kontakta oss</Link>.
        </p>
      )}
    </div>
  )
}

/* ── /kontakt — kolofon-kort ─────────────────────────────────────────────────── */
export function PaisleyKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hasAny = Boolean(location?.address || contact.phone || contact.email || location?.hours?.length)
  return (
    <div className={styles.paPage}>
      <div className={styles.paListHead}>
        <Reveal>
          <p className={styles.paKicker}>{content.contactEyebrow ?? '— Kolofon'}</p>
          <h1 className={styles.paPageTitle}>{content.contactTitle ?? `Kontakta ${tenant.name}`}</h1>
        </Reveal>
      </div>

      <div className={styles.paColophon}>
        {location?.address ? (
          <Reveal className={styles.paColCard}>
            <p className={styles.paColHead}>Adress</p>
            <p className={styles.paColText}>{location.address}</p>
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.paColLink}
            >
              Visa på karta <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        ) : null}

        {location?.hours && location.hours.length > 0 ? (
          <Reveal delay={80} className={styles.paColCard}>
            <p className={styles.paColHead}>Öppettider</p>
            {location.hours.map((h) => (
              <p key={h.day} className={styles.paColHours}>
                <span>{h.day}</span>
                <span>{h.time}</span>
              </p>
            ))}
          </Reveal>
        ) : null}

        {contact.phone || contact.email ? (
          <Reveal delay={160} className={styles.paColCard}>
            <p className={styles.paColHead}>Kontakt</p>
            {contact.phone ? (
              <p className={styles.paColText}>
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.paColLink}>
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.paColText}>
                <a href={`mailto:${contact.email}`} className={styles.paColLink}>
                  {contact.email}
                </a>
              </p>
            ) : null}
          </Reveal>
        ) : null}
      </div>

      {!hasAny ? <p className={styles.paEmpty}>Kontaktuppgifterna publiceras här inom kort.</p> : null}

      <div className={styles.paPageEnd}>
        <BookCta className={styles.paSquareCta} />
      </div>
    </div>
  )
}
