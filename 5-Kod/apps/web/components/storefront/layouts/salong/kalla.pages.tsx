import { Bookable } from '../../Bookable'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { Service } from '@/lib/tenant-data'
import type { ThemePageProps } from './types'
import styles from './kalla.module.css'

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

  return (
    <section className={styles.kaPageWide}>
      <div className={styles.kaPageHead}>
        <h1 className={styles.kaPageTitle}>{content.contactTitle ?? 'Kontakt'}</h1>
      </div>

      <div className={styles.kaKontakt}>
        <div className={styles.kaKontaktCard}>
          {location?.address ? (
            <>
              <p className={styles.kaKontaktLabel}>Rummet</p>
              <p className={styles.kaKontaktValue}>{location.address}</p>
            </>
          ) : null}
          {contact.email || contact.phone ? (
            <>
              <p className={styles.kaKontaktLabel}>Nås på</p>
              <p className={styles.kaKontaktValue}>
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
              <p className={styles.kaKontaktLabel}>Öppet</p>
              <p className={styles.kaKontaktValue}>
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

        <p className={styles.kaKontaktProse}>{content.closingLede ?? content.aboutCopy}</p>
      </div>
    </section>
  )
}
