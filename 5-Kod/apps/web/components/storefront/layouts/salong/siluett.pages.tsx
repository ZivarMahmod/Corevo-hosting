import { Bookable } from '../../Bookable'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { ContactForm } from '../../kontakt/ContactForm'
import type { Service } from '@/lib/tenant-data'
import type { ThemePageProps } from './types'
import styles from './siluett.module.css'

/**
 * SILUETT — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Form före trend, alltid." — text | 4:5-foto, sedan tre
 *               nyckeltal över 2px-linjer (mittersta i elviolett, precis som i filen).
 *   /tjanster → filens `showPriser`: prislistan grupperad (Klipp / Färg / Styling & vård),
 *               hårlinje-rader med namn, tid, pris och "Boka →". Grupperna kommer ur
 *               SALONGENS EGNA tjänstekategorier — aldrig filens mockdata.
 *   /kontakt  → filens `showKontakt`: bläcksvart faktaplatta | vit prosaruta.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt ritas rutan inte
 * alls — mallen hittar aldrig på en adress.
 */

/* ═════════════════════════════════════ /om ════════════════════════════════ */

export function SiluettOm({ content, tenant }: ThemePageProps) {
  const photo = content.aboutImage ?? content.heroImages[0] ?? ''
  // Filens tre nyckeltal. Ägarens egna (settings.branding.stats) vinner; utan dem
  // ritas inget sifferband — mallen hittar inte på ett grundningsår.
  const stats = content.stats.slice(0, 3)

  return (
    <section className={styles.siPageOm}>
      <div className={styles.siOmSplit}>
        <div>
          <p className={styles.siEyebrow}>{content.teamEyebrow}</p>
          <h1 className={styles.siOmTitle}>{content.aboutTitle}</h1>
          <p className={styles.siOmBody}>{content.aboutCopy}</p>
          <p className={styles.siOmBodyLast}>{content.italic}</p>
        </div>
        <div
          className={styles.siOmPhoto}
          style={photo ? { backgroundImage: `url(${photo})` } : undefined}
          role="img"
          aria-label={tenant.name}
        />
      </div>

      {stats.length > 0 ? (
        <div className={styles.siStats}>
          {stats.map(([value, label], i) => (
            <div key={label} className={styles.siStat}>
              <p
                className={`${styles.siStatValue} ${i === 1 ? styles.siStatValueAccent : ''}`}
              >
                {value}
              </p>
              <p className={styles.siStatLabel}>{label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════════ /tjanster ═════════════════════════════ */

/** Filens `priceData`: prislistan i grupper. Tjänster utan kategori hamnar i en
 *  namnlös första grupp — vi hittar aldrig på en rubrik åt salongen. */
function groupServices(services: Service[]): { name: string | null; items: Service[] }[] {
  const groups: { name: string | null; items: Service[] }[] = []
  for (const s of services) {
    const key = s.category?.trim() || null
    const found = groups.find((g) => g.name === key)
    if (found) found.items.push(s)
    else groups.push({ name: key, items: [s] })
  }
  return groups
}

export function SiluettTjanster({ content, services, modules }: ThemePageProps) {
  const groups = groupServices(services)
  const bookingReachable = modules?.bookingReachable ?? false

  return (
    <section className={styles.siPageNarrow}>
      <p className={styles.siEyebrow}>{content.servicesEyebrow}</p>
      <h1 className={styles.siPageTitle}>{content.servicesTitle}</h1>

      {services.length === 0 ? (
        <p className={styles.siEmpty}>Prislistan visas snart.</p>
      ) : (
        groups.map((g) => (
          <div key={g.name ?? '—'} className={styles.siPriceGroup}>
            {g.name ? (
              <div className={styles.siPriceGroupHead}>
                <p className={styles.siPriceGroupName}>{g.name}</p>
              </div>
            ) : null}
            {g.items.map((s) => (
              <Bookable enabled={bookingReachable} key={s.id} className={styles.siPriceRow} label={`Boka — ${s.name}`}>
                <span className={styles.siPriceMain}>
                  <span className={styles.siPriceName}>{s.name}</span>
                  <span className={styles.siPriceDesc}>{serviceDesc(s)}</span>
                </span>
                <span className={styles.siPriceTid}>{formatDuration(s)}</span>
                <span className={styles.siPriceKr}>{formatPrice(s)}</span>
                <span className={styles.siPriceBook}>Boka →</span>
              </Bookable>
            ))}
          </div>
        ))
      )}
    </section>
  )
}

/* ═══════════════════════════════════ /kontakt ═════════════════════════════ */

export function SiluettKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.siPageKontakt}>
      <h1 className={styles.siPageTitle}>{content.contactTitle ?? 'Kontakt'}</h1>

      <div className={styles.siKontaktGrid}>
        <div className={styles.siKontaktCard}>
          {location?.address ? (
            <>
              <p className={styles.siKontaktLabel}>Salongen</p>
              <p className={styles.siKontaktValue}>{location.address}</p>
            </>
          ) : null}

          {contact.email || contact.phone ? (
            <>
              <p className={styles.siKontaktLabel}>Nås på</p>
              <p className={styles.siKontaktValue}>
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
              <p className={styles.siKontaktLabel}>Öppet</p>
              <p className={styles.siKontaktValueLast}>
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
          <p className={styles.siKontaktProse}>{content.closingLede ?? content.aboutCopy}</p>
          {/* Filens formulär (goal-64): Namn · E-post · "Vad kan vi hjälpa till med?" ·
              Skicka — placeholders utan etiketter, modemagasinets rena rutnät. */}
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
