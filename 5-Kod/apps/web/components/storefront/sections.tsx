import { BookCta } from '@/components/brand/BookCta'
import { Reveal } from './Reveal'
import { Parallax } from './Parallax'
import { ABOUT_PHOTO, CLOSING_PHOTO, STYLIST_PHOTOS, type StorePhoto } from './images'
import styles from './storefront.module.css'

/* Editorial section building blocks (server components). Each leads with type or
   a photo, keeps magazine rhythm + generous whitespace, and restyles per
   template via the [data-template] scope in storefront.module.css.

   Address / phone / opening hours are NOT in the public data layer yet
   (crossModuleGaps). We show graceful Swedish placeholders ("Visas snart" /
   sensible defaults) and a default Stockholm map, so the page never looks empty
   before the salon fills in its profile. */

/** Small eyebrow + display H2 header used to open most sections. */
export function SectionHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead?: string
}) {
  return (
    <Reveal className={styles.secHead}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.secTitle}>{title}</h2>
      {lead ? <p className={styles.secLead}>{lead}</p> : null}
    </Reveal>
  )
}

/** Centred large italic warmth phrase, generous whitespace. */
export function AccentPhrase({ text }: { text: string }) {
  return (
    <section className={styles.phraseBand}>
      <Reveal>
        <p className={styles.phrase}>{text}</p>
      </Reveal>
    </section>
  )
}

/** "Våra frisörer" — stylist spotlights (portrait + name + role + one-line bio).
 *  Photo-driven; the portrait lifts on hover. Until staff bios exist in the data
 *  layer, generic but warm placeholders keep the section credible. */
export function StylistSpotlights({ salonName }: { salonName: string }) {
  const stylists: { photo: StorePhoto; name: string; role: string; bio: string }[] = [
    {
      photo: STYLIST_PHOTOS[0]!,
      name: 'Vårt team',
      role: 'Frisörer & stylister',
      bio: 'Erfarna stylister som lyssnar på vad du vill ha och ser till att du trivs.',
    },
    {
      photo: STYLIST_PHOTOS[1]!,
      name: 'Färg & slingor',
      role: 'Färgspecialister',
      bio: 'Från subtila slingor till djärva förändringar — alltid med omsorg om håret.',
    },
    {
      photo: STYLIST_PHOTOS[2]!,
      name: 'Klippning',
      role: 'Klipp & form',
      bio: 'En frisyr som sitter, anpassad efter dig, din vardag och din stil.',
    },
  ]
  return (
    <section className="section">
      <div className="section-inner">
        <SectionHeader
          eyebrow="— Våra frisörer"
          title="Människorna bakom stolen"
          lead={`Teamet på ${salonName} brinner för hantverket och för att du ska känna dig hemma.`}
        />
        <ul className={styles.stylists}>
          {stylists.map((s, i) => (
            <Reveal as="li" key={s.name} delay={i * 80} className={styles.stylist}>
              <div className={styles.stylistPhoto}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.photo.src} alt={s.photo.alt} loading="lazy" />
              </div>
              <h3 className={styles.stylistName}>{s.name}</h3>
              <p className={styles.stylistRole}>{s.role}</p>
              <p className={styles.stylistBio}>{s.bio}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** "Om salongen" — split: interior photo one side, copy + stat-trio the other. */
export function AboutSplit({ salonName }: { salonName: string }) {
  const stats = [
    { value: '8+', label: 'år av hantverk' },
    { value: '5★', label: 'omdömen från gäster' },
    { value: '100%', label: 'omsorg, varje gång' },
  ]
  return (
    <section className={`section ${styles.aboutSection}`}>
      <div className={`section-inner ${styles.aboutGrid}`}>
        <Reveal className={styles.aboutPhoto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ABOUT_PHOTO.src} alt={ABOUT_PHOTO.alt} loading="lazy" />
        </Reveal>
        <Reveal className={styles.aboutCopy} delay={80}>
          <p className={styles.eyebrow}>— Om {salonName}</p>
          <h2 className={styles.secTitle}>Hantverk, kvalitet och personlig service</h2>
          <p className={styles.aboutText}>
            {salonName} är en salong där hantverk och omtanke står i centrum. Vårt mål är att du
            ska lämna oss nöjd — varje gång. Vi tar emot både nya och återkommande gäster.
          </p>
          <ul className={styles.stats}>
            {stats.map((s) => (
              <li key={s.label} className={styles.stat}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/** "Plats & öppettider" — address + opening-hours table + embedded OSM map.
 *  No API key needed (OpenStreetMap iframe). Real address/hours aren't in the
 *  data layer yet → graceful placeholders + a neutral default map view. */
export function LocationHours({ salonName }: { salonName: string }) {
  const hours: { day: string; time: string }[] = [
    { day: 'Måndag–Fredag', time: '09–18' },
    { day: 'Lördag', time: '10–15' },
    { day: 'Söndag', time: 'Stängt' },
  ]
  // Neutral default map (central Sweden) until the salon sets its coordinates.
  const mapSrc =
    'https://www.openstreetmap.org/export/embed.html?bbox=11.8%2C57.6%2C12.1%2C57.8&layer=mapnik'

  return (
    <section className={`section ${styles.locSection}`}>
      <div className="section-inner">
        <SectionHeader eyebrow="— Hitta hit" title="Plats & öppettider" />
        <div className={styles.locGrid}>
          <Reveal className={styles.locInfo}>
            <div className={styles.locBlock}>
              <p className={styles.locLabel}>Adress</p>
              <p className={styles.locValue}>Visas snart</p>
              <p className={styles.locHint}>
                {salonName} lägger till adress och vägbeskrivning i sin profil.
              </p>
            </div>
            <div className={styles.locBlock}>
              <p className={styles.locLabel}>Öppettider</p>
              <table className={styles.hoursTable}>
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.day}>
                      <th scope="row">{h.day}</th>
                      <td>{h.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.locHint}>
                Lediga tider syns alltid i bokningen — välj den som passar dig.
              </p>
            </div>
          </Reveal>
          <Reveal className={styles.locMap} delay={80}>
            <iframe
              title={`Karta över ${salonName}`}
              src={mapSrc}
              className={styles.mapFrame}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** Closing CTA — full-bleed photo with parallax + big serif headline + Boka. */
export function ClosingCta() {
  return (
    <section className={styles.closing} aria-label="Boka tid">
      <Parallax src={CLOSING_PHOTO.src} alt={CLOSING_PHOTO.alt}>
        <p className={styles.closingEyebrow}>Redo när du är</p>
        <h2 className={styles.closingTitle}>Redo för en ny stil?</h2>
        <p className={styles.closingLead}>
          Hitta en tid som passar dig och boka online på under en minut — bekräftelse direkt.
        </p>
        <div className={styles.closingActions}>
          <BookCta />
        </div>
      </Parallax>
    </section>
  )
}
