import { BookCta } from '@/components/brand/BookCta'
import { currentTenant } from '@/lib/tenant-data'
import { Reveal } from './Reveal'
import { Parallax } from './Parallax'
import type { ResolvedThemeContent } from './theme-content'
import styles from './storefront.module.css'

/* Editorial section building blocks (server components). Each leads with type or
   a photo, keeps magazine rhythm + generous whitespace, and restyles per
   template via the [data-template] scope in storefront.module.css.

   Contact (email/phone), address and opening hours are REAL: contact comes from
   the salon's saved settings (settings.contact), address from locations.address,
   and hours are derived from the salon's real working_hours. When a field is not
   filled in yet we omit it gracefully or show an honest "Visas snart" placeholder
   — we never invent contact details, an address or opening hours. */

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

/** "Våra frisörer" — stylist spotlights (portrait + name + role).
 *  Photo-driven; the portrait lifts on hover. Team comes from the resolved theme
 *  content: the owner's uploaded team (settings.branding.team) when present,
 *  otherwise the strong per-theme default — so the section is always credible. */
export function StylistSpotlights({
  salonName,
  content,
}: {
  salonName: string
  content: ResolvedThemeContent
}) {
  return (
    <section className="section">
      <div className="section-inner">
        <SectionHeader
          eyebrow={content.teamEyebrow}
          title={content.teamTitle}
          lead={`Teamet på ${salonName} brinner för hantverket och för att du ska känna dig hemma.`}
        />
        <ul className={styles.stylists}>
          {content.team.map((s, i) => (
            <Reveal as="li" key={`${s.name}-${i}`} delay={i * 80} className={styles.stylist}>
              <div className={styles.stylistPhoto}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.name} loading="lazy" />
              </div>
              <h3 className={styles.stylistName}>{s.name}</h3>
              <p className={styles.stylistRole}>{s.role}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** "Om salongen" — split: interior photo one side, copy the other.
 *  Photo + body copy come from the resolved theme content: the owner's uploaded
 *  about image (settings.branding.about_image) when present, otherwise the
 *  per-theme default, plus the theme's evergreen about copy. No fabricated
 *  statistics — we lead with honest copy instead of inventing facts. */
export function AboutSplit({
  salonName,
  content,
}: {
  salonName: string
  content: ResolvedThemeContent
}) {
  return (
    <section className={`section ${styles.aboutSection}`}>
      <div className={`section-inner ${styles.aboutGrid}`}>
        <Reveal className={styles.aboutPhoto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.aboutImage} alt={`Miljön hos ${salonName}`} loading="lazy" />
        </Reveal>
        <Reveal className={styles.aboutCopy} delay={80}>
          <p className={styles.eyebrow}>— Om {salonName}</p>
          <h2 className={styles.secTitle}>{content.aboutTitle}</h2>
          <p className={styles.aboutText}>{content.aboutCopy}</p>
        </Reveal>
      </div>
    </section>
  )
}

/** "Plats & öppettider" — REAL address + REAL opening hours + contact + map.
 *  Address comes from locations.address, hours are derived from the salon's real
 *  working_hours, contact (email/phone) from the saved settings. Each field is
 *  omitted gracefully (or shown as an honest "Visas snart") until it exists — we
 *  never invent an address or opening hours. The map only loads once we have a
 *  real address to search for; otherwise it is omitted (no misleading default). */
export async function LocationHours({ salonName }: { salonName: string }) {
  const bundle = await currentTenant()
  const location = bundle?.location ?? null
  const contact = bundle?.settings.contact ?? { email: null, phone: null }
  const address = location?.address ?? null
  const hours = location?.hours ?? null
  const hasContact = !!contact.email || !!contact.phone

  // Link to a real map search for the saved address. We don't embed an OSM iframe
  // here: the embed needs a bounding box we can't derive without geocoding, so a
  // fabricated default-bbox map would be misleading. A search link is honest and
  // always points at the real address.
  const mapHref = address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : null

  return (
    <section className={`section ${styles.locSection}`}>
      <div className="section-inner">
        <SectionHeader eyebrow="— Hitta hit" title="Plats & öppettider" />
        <div className={styles.locGrid}>
          <Reveal className={styles.locInfo}>
            <div className={styles.locBlock}>
              <p className={styles.locLabel}>Adress</p>
              {address ? (
                <>
                  <p className={styles.locValue}>{address}</p>
                  {mapHref ? (
                    <p className={styles.locContactValue}>
                      <a
                        href={mapHref}
                        className={styles.moreLink}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Visa på karta <span aria-hidden="true">→</span>
                      </a>
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className={styles.locValue}>Visas snart</p>
                  <p className={styles.locHint}>
                    {salonName} lägger till adress och vägbeskrivning i sin profil.
                  </p>
                </>
              )}
            </div>

            <div className={styles.locBlock}>
              <p className={styles.locLabel}>Öppettider</p>
              {hours ? (
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
              ) : (
                <p className={styles.locValue}>Visas snart</p>
              )}
              <p className={styles.locHint}>
                Lediga tider syns alltid i bokningen — välj den som passar dig.
              </p>
            </div>

            {hasContact ? (
              <div className={styles.locBlock}>
                <p className={styles.locLabel}>Kontakt</p>
                {contact.phone ? (
                  <p className={styles.locValue}>
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                      className={styles.locContactLink}
                    >
                      {contact.phone}
                    </a>
                  </p>
                ) : null}
                {contact.email ? (
                  <p className={styles.locContactValue}>
                    <a href={`mailto:${contact.email}`} className={styles.locContactLink}>
                      {contact.email}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** Closing CTA — full-bleed photo with parallax + big serif headline + Boka.
 *  Photo comes from the resolved theme content (owner's closing image when
 *  uploaded, otherwise the per-theme default). */
export function ClosingCta({ content }: { content: ResolvedThemeContent }) {
  return (
    <section className={styles.closing} aria-label="Boka tid">
      <Parallax src={content.closingImage} alt="Inbjudande salongsmiljö redo att ta emot dig">
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
