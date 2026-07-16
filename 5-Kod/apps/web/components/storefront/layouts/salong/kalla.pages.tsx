import { Bookable } from '../../Bookable'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { Service } from '@/lib/tenant-data'
import type { ThemePageProps } from './types'
import styles from './kalla.module.css'

const EDITOR_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'] as const

/**
 * KÄLLA — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om        → filens `showOm`: "Långsamt är det nya snabbt" — 4:5-foto till vänster, två
 *                stycken prosa till höger, sedan de tre sifferrutorna (mitten i teal).
 *   /tjanster  → filens `showBehandlingar`: prisgrupper med hårlinje-rubrik mellan två
 *                streck, sedan rader med namn/beskrivning · tid · pris · "Boka →". Varje rad
 *                är en <Bookable> — filens `row.book` förifyller bokningen; funktionen är
 *                plattformens.
 *   /kontakt   → filens `showKontakt`: teal-kortet (Rummet / Nås på / Öppet) till vänster,
 *                den ljusa rutan till höger.
 *
 * PRISERNA kommer ur `services` — aldrig filens hårdkodade siffror. Grupperingen följer
 * tjänstens `category`; saknar kunden kategorier ritas raderna i EN grupp utan rubrik,
 * i stället för att mallen hittar på "Hårspa-ritualer" åt någon som inte har dem.
 *
 * Render-on-present: saknas adress/kontakt/öppettider ritas den raden inte alls — mallen
 * hittar aldrig på en adress. SYNKRONA server-komponenter.
 */

export function KallaOm({ content }: ThemePageProps) {
  return (
    <section className={styles.kaPageWide}>
      <div className={styles.kaOmSplit}>
        <div
          className={styles.kaOmPhoto}
          data-corevo-editor-field="about_image"
          data-corevo-editor-stable-field="about_image"
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
        />
        <div>
          <p className={styles.kaSecEyebrow}>{content.teamEyebrow}</p>
          <h1 className={styles.kaOmTitle}>{content.aboutTitle}</h1>
          <p className={styles.kaOmBody}>{content.aboutCopy}</p>
          <p className={styles.kaOmBody}>{content.italic}</p>
        </div>
      </div>

      {/* Filens tre sifferrutor. Mittenrutan är teal — vartannat-mönstret ÄR designen. */}
      {content.stats.length > 0 ? (
        <ul className={styles.kaStats}>
          {content.stats.map(([value, label], i) => (
            <li key={`${value}-${i}`} className={i % 2 === 1 ? styles.kaStatDark : styles.kaStat}>
              <p className={styles.kaStatValue}>{value}</p>
              <p className={styles.kaStatLabel}>{label}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** Gruppera tjänsterna på deras egen kategori, i den ordning kategorierna dyker upp.
 *  Ingen kategori alls → en enda namnlös grupp (filens grammatik utan påhittad rubrik). */
function groupServices(services: Service[]): { name: string | null; items: Service[] }[] {
  const order: string[] = []
  const byCat = new Map<string, Service[]>()
  const loose: Service[] = []
  for (const s of services) {
    const cat = s.category?.trim()
    if (!cat) {
      loose.push(s)
      continue
    }
    if (!byCat.has(cat)) {
      byCat.set(cat, [])
      order.push(cat)
    }
    byCat.get(cat)!.push(s)
  }
  const groups = order.map((name) => ({ name: name as string | null, items: byCat.get(name)! }))
  if (loose.length > 0) groups.push({ name: null, items: loose })
  return groups
}

export function KallaTjanster({ content, services }: ThemePageProps) {
  const groups = groupServices(services)

  return (
    <section className={styles.kaPage}>
      <div className={styles.kaPageHead}>
        <p className={styles.kaEyebrow}>{content.servicesEyebrow}</p>
        <h1 className={styles.kaPageTitle}>{content.servicesTitle}</h1>
      </div>

      {services.length === 0 ? (
        <p className={styles.kaEmpty}>Behandlingarna visas snart.</p>
      ) : (
        groups.map((g, gi) => (
          <div key={g.name ?? `grupp-${gi}`} className={styles.kaPriceGroup}>
            {g.name ? (
              <div className={styles.kaPriceGroupHead}>
                <span />
                <p className={styles.kaPriceGroupName}>{g.name}</p>
                <span />
              </div>
            ) : null}
            {g.items.map((s) => (
              <Bookable key={s.id} className={styles.kaPriceRow} label={`Boka — ${s.name}`}>
                <span className={styles.kaPriceMain}>
                  <span className={styles.kaPriceName}>{s.name}</span>
                  <span className={styles.kaPriceDesc}>{serviceDesc(s)}</span>
                </span>
                <span className={styles.kaPriceTid}>{formatDuration(s)}</span>
                <span className={styles.kaPriceValue}>{formatPrice(s)}</span>
                <span className={styles.kaPriceBook}>Boka →</span>
              </Bookable>
            ))}
          </div>
        ))
      )}
    </section>
  )
}

export function KallaKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  const editorHours = EDITOR_DAYS.map((day) => ({ day, time: hours?.find((row) => row.day === day)?.time ?? '' }))
  const hasHours = editorHours.some((row) => row.time)

  return (
    <section className={styles.kaPageWide}>
      <div className={styles.kaPageHead}>
        <h1 className={styles.kaPageTitle}>{content.contactTitle ?? 'Kontakt'}</h1>
      </div>

      <div className={styles.kaKontakt}>
        <div className={styles.kaKontaktCard}>
          <p className={styles.kaKontaktLabel} data-corevo-fact-group="location.address"
            hidden={!location?.address}>Rummet</p>
          <p className={styles.kaKontaktValue} data-corevo-fact-group="location.address"
            data-corevo-editor-field="location.address"
            data-corevo-editor-stable-field="location.address"
            hidden={!location?.address}>{location?.address ?? ''}</p>
          <p className={styles.kaKontaktLabel} data-corevo-contact-group
            hidden={!contact.email && !contact.phone}>Nås på</p>
          <p className={styles.kaKontaktValue} data-corevo-contact-group
            hidden={!contact.email && !contact.phone}>
            <a href={contact.email ? `mailto:${contact.email}` : '#'} hidden={!contact.email}
              data-corevo-editor-field="contact.email"
              data-corevo-editor-stable-field="contact.email">{contact.email ?? ''}</a>
            <br data-corevo-contact-email-break hidden={!contact.email} />
            <a href={contact.phone ? `tel:${contact.phone.replace(/\s+/g, '')}` : '#'} hidden={!contact.phone}
              data-corevo-editor-field="contact.phone"
              data-corevo-editor-stable-field="contact.phone">{contact.phone ?? ''}</a>
          </p>
          <p className={styles.kaKontaktLabel} data-corevo-opening-group hidden={!hasHours}>Öppet</p>
          <p className={styles.kaKontaktValue} data-corevo-opening-group hidden={!hasHours}>
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
          <p className={styles.kaKontaktProse}>{content.closingLede ?? content.aboutCopy}</p>
          {/* Filens formulär (goal-64) — Källas kontaktsida hade bara prosa; .dc.html har
              en riktig ruta (Namn · E-post · "Vad kan vi hjälpa till med?" · Skicka).
              Nu finns kontakt-rälsen, så rutan kan vara det den ritades som. */}
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
