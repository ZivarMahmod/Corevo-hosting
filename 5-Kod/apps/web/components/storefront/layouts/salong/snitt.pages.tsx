import { Bookable } from '../../Bookable'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { Service } from '@/lib/tenant-data'
import type { ThemePageProps } from './types'
import styles from './snitt.module.css'

const EDITOR_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'] as const

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
export function SnittPriceRow({ service, enabled }: { service: Service; enabled: boolean }) {
  return (
    <Bookable slotId={`service:${service.id}`} enabled={enabled} className={styles.snRow} label={`Boka — ${service.name}`}>
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

export function SnittTjanster({ content, services, modules }: ThemePageProps) {
  const groups = groupServices(services)
  const bookingReachable = modules?.bookingReachable ?? false

  return (
    <section className={styles.snPageNarrow}>
      <p className={styles.snEyebrow} data-corevo-editor-field="servicesEyebrow" data-corevo-editor-stable-field="servicesEyebrow">
        <span className={styles.snDash}>—</span> {content.servicesEyebrow}
      </p>
      <h1 className={styles.snPageTitle} data-corevo-editor-field="servicesTitle" data-corevo-editor-stable-field="servicesTitle">
        {content.servicesTitle}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>
      <p className={styles.snPageLede} data-corevo-editor-field="servicesIntro" data-corevo-editor-stable-field="servicesIntro">
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
                <SnittPriceRow key={s.id} service={s} enabled={bookingReachable} />
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
          <p className={styles.snEyebrow} data-corevo-editor-field="teamEyebrow" data-corevo-editor-stable-field="teamEyebrow">
            <span className={styles.snDash}>—</span> {content.teamEyebrow}
          </p>
          <h1 className={styles.snOmTitle} data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle}</h1>
          <p className={styles.snOmBody} data-corevo-editor-field="aboutCopyHome" data-corevo-editor-stable-field="aboutCopyHome">{content.aboutCopyHome}</p>
          <p className={styles.snOmBody} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
        </div>
        <div
          className={styles.snOmPhoto}
          data-corevo-editor-field="about_image"
          data-corevo-editor-stable-field="about_image"
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
      </div>

      {/* Filens tre statistik-plattor. Siffrorna är ägarens (branding.stats) — mallens
          egna är evergreen, aldrig ett påhittat betyg åt en namngiven salong. */}
      {content.stats.length > 0 ? (
        <div className={styles.snStatCards}>
          {content.stats.map(([value, label], i) => (
            <div key={`${value}-${label}`} className={styles.snStatCard}>
              <p className={`${styles.snStatCardValue} ${i === 0 ? styles.snStatFirst : ''}`} data-corevo-editor-field={`stats.${i}.value`} data-corevo-editor-stable-field={`stats.${i}.value`}>{value}</p>
              <p className={styles.snStatCardLabel} data-corevo-editor-field={`stats.${i}.label`} data-corevo-editor-stable-field={`stats.${i}.label`}>{label}</p>
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
  const editorHours = EDITOR_DAYS.map((day) => ({ day, time: hours?.find((row) => row.day === day)?.time ?? '' }))
  const hasHours = editorHours.some((row) => row.time)

  return (
    <section className={styles.snPageOm}>
      <h1 className={styles.snPageTitleAlone} data-corevo-editor-field="contactTitle" data-corevo-editor-stable-field="contactTitle">
        {content.contactTitle ?? 'Kontakt'}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>

      <div className={styles.snKontakt}>
        <div className={styles.snPanel}>
          <p className={styles.snPanelLabel} data-corevo-fact-group="location.address"
            hidden={!location?.address}>Studion</p>
          <p className={styles.snPanelValue} data-corevo-fact-group="location.address"
            data-corevo-editor-field="location.address"
            data-corevo-editor-stable-field="location.address"
            hidden={!location?.address}>{location?.address ?? ''}</p>
          <p className={styles.snPanelLabel} data-corevo-contact-group
            hidden={!contact.email && !contact.phone}>Nås på</p>
          <p className={styles.snPanelValue} data-corevo-contact-group
            hidden={!contact.email && !contact.phone}>
            <a href={contact.email ? `mailto:${contact.email}` : '#'} hidden={!contact.email}
              data-corevo-editor-field="contact.email"
              data-corevo-editor-stable-field="contact.email">{contact.email ?? ''}</a>
            <br data-corevo-contact-email-break hidden={!contact.email} />
            <a href={contact.phone ? `tel:${contact.phone.replace(/\s+/g, '')}` : '#'} hidden={!contact.phone}
              data-corevo-editor-field="contact.phone"
              data-corevo-editor-stable-field="contact.phone">{contact.phone ?? ''}</a>
          </p>
          <p className={styles.snPanelLabel} data-corevo-opening-group hidden={!hasHours}>Öppet</p>
          <p className={styles.snPanelValue} data-corevo-opening-group hidden={!hasHours}>
            {editorHours.map((h, index) => (
              <span key={h.day} data-corevo-opening-row={index} hidden={!h.time}>
                {h.day}{' '}
                <span data-corevo-editor-field={`opening_hours.${index}.time`}
                  data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</span>
                <br />
              </span>
            ))}
          </p>
        </div>

        <div>
          <p className={styles.snProse} data-corevo-editor-field="closingLede" data-corevo-editor-stable-field="closingLede">{content.closingLede ?? content.aboutCopy}</p>
          <p className={styles.snProse} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
          {/* Filens formulär (goal-64): Namn · E-post · "Vad kan vi hjälpa till med?" ·
              Skicka. Svart studio — rutan var prosa, .dc.html ville ha en submit. */}
          <ContactForm
            rows={[
              [{ key: 'name', placeholder: 'Namn', required: true }],
              [{ key: 'email', placeholder: 'E-post', required: true }],
              [{ key: 'message', placeholder: 'Vad kan vi hjälpa till med?', required: true }],
            ]}
            submitLabel="Skicka"
          />
        </div>
      </div>
    </section>
  )
}
