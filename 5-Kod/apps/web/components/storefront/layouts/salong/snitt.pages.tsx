import { Bookable } from '../../Bookable'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { Service } from '@/lib/tenant-data'
import type { ThemePageProps } from './types'
import styles from './snitt.module.css'

/**
 * SNITT — UNDERSIDORNA (goal-64, exakt kopia ur "Snitt - Svart Studio.dc.html").
 *
 *   /tjanster → filens `showPriser` ("Prislistan."): grupperade hårlinje-rader —
 *               namn + beskrivning till vänster, tid, pris i Anton, "Boka" i lime.
 *   /om       → filens `showOm` ("Kvalitet före kvantitet."): text | foto i 4:5,
 *               därunder tre statistik-plattor.
 *   /kontakt  → filens `showKontakt`: faktaplattan (Studion / Nås på / Öppet) bredvid
 *               prosan.
 *
 * SYNKRONA server-komponenter (ingen async, ingen 'use client') — onboarding-studions
 * preview renderar samma komponenter.
 *
 * Render-on-present: saknas adress/kontakt/öppettider ritas rutan inte alls. Mallen
 * hittar ALDRIG på en adress — filens "Davidshallsgatan 9" är designens exempeltext,
 * inte kundens sanning, och får därför aldrig hamna i en riktig tenants kontaktkort.
 */

/**
 * Filens prislista är GRUPPERAD (Klippning · Färg · Styling & vård). Grupperna är
 * tjänsternas egen kategori ur DB:n — ALDRIG hårdkodade rubriker: en salong som säljer
 * något annat ska få sina egna grupper, inte filens. Tjänster utan kategori hamnar i en
 * namnlös grupp (rubriken ritas då inte).
 */
export function groupServices(services: Service[]): { name: string | null; items: Service[] }[] {
  const groups: { name: string | null; items: Service[] }[] = []
  for (const s of services) {
    const name = s.category?.trim() ? s.category.trim() : null
    const found = groups.find((g) => g.name === name)
    if (found) found.items.push(s)
    else groups.push({ name, items: [s] })
  }
  return groups
}

/** Prisraden: hela raden ÄR bokningsknappen (filens `row.book`) — via plattformens
 *  <Bookable>, aldrig en egen boknings-logik. */
export function SnittPriceRow({ service }: { service: Service }) {
  return (
    <Bookable className={styles.snRow} label={`Boka — ${service.name}`}>
      <span className={styles.snRowMain}>
        <span className={styles.snRowName}>{service.name}</span>
        <span className={styles.snRowDesc}>{serviceDesc(service)}</span>
      </span>
      <span className={styles.snRowTid}>{formatDuration(service)}</span>
      <span className={styles.snRowPrice}>{formatPrice(service)}</span>
      <span className={styles.snRowBook}>Boka</span>
    </Bookable>
  )
}

/* ═════════════════════════════════ PRISLISTAN ═════════════════════════════════ */

export function SnittTjanster({ content, services }: ThemePageProps) {
  const groups = groupServices(services)

  return (
    <section className={styles.snPageNarrow}>
      <p className={styles.snEyebrow}>
        <span className={styles.snDash}>—</span> {content.servicesEyebrow}
      </p>
      <h1 className={styles.snPageTitle}>
        {content.servicesTitle}
        <span className={styles.snDot}>.</span>
      </h1>
      <p className={styles.snPageLede}>
        {content.servicesIntro ??
          'Konsultation ingår alltid. Behöver vi mer tid än bokat kostar det inget extra — det är vårt problem, inte ditt.'}
      </p>

      {services.length === 0 ? (
        <p className={styles.snEmpty}>Prislistan visas snart.</p>
      ) : (
        groups.map((g, i) => (
          <div key={g.name ?? `grupp-${i}`} className={styles.snGroup}>
            {g.name ? <p className={styles.snGroupName}>{g.name}</p> : null}
            {g.items.map((s) => (
              <SnittPriceRow key={s.id} service={s} />
            ))}
          </div>
        ))
      )}
    </section>
  )
}

/* ═══════════════════════════════════ OM ═══════════════════════════════════════ */

export function SnittOm({ content }: ThemePageProps) {
  return (
    <section className={styles.snPageOm}>
      <div className={styles.snOmSplit}>
        <div>
          <p className={styles.snEyebrow}>
            <span className={styles.snDash}>—</span> {content.teamEyebrow}
          </p>
          <h1 className={styles.snOmTitle}>{content.aboutTitle}</h1>
          <p className={styles.snOmBody}>{content.aboutCopy}</p>
          <p className={styles.snOmBody}>{content.italic}</p>
        </div>
        <div
          className={styles.snOmPhoto}
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
      </div>

      {/* Filens tre statistik-plattor. Siffrorna är ägarens (branding.stats) — mallens
          egna är evergreen, aldrig ett påhittat betyg åt en namngiven salong. */}
      {content.stats.length > 0 ? (
        <div className={styles.snStatCards}>
          {content.stats.map(([value, label], i) => (
            <div key={`${value}-${label}`} className={styles.snStatCard}>
              <p className={`${styles.snStatCardValue} ${i === 0 ? styles.snStatFirst : ''}`}>{value}</p>
              <p className={styles.snStatCardLabel}>{label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/* ════════════════════════════════ KONTAKT ═════════════════════════════════════ */

export function SnittKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.snPageOm}>
      <h1 className={styles.snPageTitleAlone}>
        {content.contactTitle ?? 'Kontakt'}
        <span className={styles.snDot}>.</span>
      </h1>

      <div className={styles.snKontakt}>
        <div className={styles.snPanel}>
          {location?.address ? (
            <>
              <p className={styles.snPanelLabel}>Studion</p>
              <p className={styles.snPanelValue}>{location.address}</p>
            </>
          ) : null}
          {contact.email || contact.phone ? (
            <>
              <p className={styles.snPanelLabel}>Nås på</p>
              <p className={styles.snPanelValue}>
                {contact.email ? (
                  <>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    <br />
                  </>
                ) : null}
                {contact.phone ? (
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                ) : null}
              </p>
            </>
          ) : null}
          {hours && hours.length > 0 ? (
            <>
              <p className={styles.snPanelLabel}>Öppet</p>
              <p className={styles.snPanelValue}>
                {hours.map((h) => (
                  <span key={h.day}>
                    {h.day} {h.time}
                    <br />
                  </span>
                ))}
              </p>
            </>
          ) : null}
        </div>

        <div>
          <p className={styles.snProse}>{content.closingLede ?? content.aboutCopy}</p>
          <p className={styles.snProse}>{content.italic}</p>
        </div>
      </div>
    </section>
  )
}
