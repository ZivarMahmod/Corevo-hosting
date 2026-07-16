import { BookCta } from '@/components/brand/BookCta'
import { currentTenant } from '@/lib/tenant-data'
import { Reveal } from './Reveal'
import { Parallax } from './Parallax'
import type { ResolvedThemeContent } from './theme-content'
import { unsplashSrcSet } from './img'
import styles from './storefront.module.css'

const EDITOR_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'] as const

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

/** Subpage-hero (goal-57 körning 14, fruitkha-mönstret): tonad hel-bredds-band med
 *  centrerad eyebrow + stor rubrik — standard-sidhuvud på modulernas EGNA sidor.
 *  Teasers/sektioner på startsidan fortsätter använda SectionHeader. */
export function SubpageHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string
  title: string
  lede?: string
}) {
  return (
    <header className={styles.subHero}>
      <p className={`${styles.eyebrow} ${styles.subHeroEyebrow}`}>{eyebrow}</p>
      <h1 className={styles.subHeroTitle}>{title}</h1>
      {lede ? <p className={styles.subHeroLead}>{lede}</p> : null}
    </header>
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
          lead={content.teamLead ?? `Teamet på ${salonName} brinner för hantverket och för att du ska känna dig hemma.`}
        />
        <ul className={styles.stylists}>
          {content.team.map((s, i) => (
            <Reveal as="li" key={`${s.name}-${i}`} delay={i * 80} className={styles.stylist}>
              <div className={styles.stylistPhoto}>
                {/* Foto valfritt — utan bild visas ett initial-monogram (aldrig en tom
                    vit låda, aldrig en trasig img). */}
                {s.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.img} alt={s.name} loading="lazy" />
                ) : (
                  <span aria-hidden="true" className={styles.monogram}>
                    {s.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                )}
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
          <img
            src={content.aboutImage}
            srcSet={unsplashSrcSet(content.aboutImage)}
            sizes="(max-width: 900px) 100vw, 50vw"
            alt={`Miljön hos ${salonName}`}
            loading="lazy"
            data-corevo-editor-field="about_image"
            data-corevo-editor-stable-field="about_image"
          />
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
export async function LocationHours({
  salonName,
  content,
}: {
  salonName: string
  /** Resolvat tema-innehåll — bär ägarens rubrik-overrides för sektionen. */
  content?: ResolvedThemeContent
}) {
  const bundle = await currentTenant()
  const location = bundle?.location ?? null
  const contact = bundle?.settings.contact ?? { email: null, phone: null }
  const social = bundle?.settings.social ?? { instagram: null, facebook: null, tiktok: null }
  const map = bundle?.settings.map ?? null
  const address = location?.address ?? null
  const hours = location?.hours ?? null
  const editorHours = EDITOR_DAYS.map((day) => ({
    day,
    time: hours?.find((row) => row.day === day)?.time ?? '',
  }))
  const hasHours = editorHours.some((row) => row.time)
  const hasContact = !!contact.email || !!contact.phone
  const hasSocial = !!social.instagram || !!social.facebook || !!social.tiktok

  // Map: when saveTenantContact managed to geocode the address (settings.map) we
  // embed a real OSM map centred on it; otherwise fall back to the honest search
  // link (no fabricated default-bbox map).
  const mapHref = address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : null
  const mapEmbed = map
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(map.lon - 0.004).toFixed(5)}%2C${(map.lat - 0.0025).toFixed(5)}%2C${(map.lon + 0.004).toFixed(5)}%2C${(map.lat + 0.0025).toFixed(5)}&layer=mapnik&marker=${map.lat.toFixed(6)}%2C${map.lon.toFixed(6)}`
    : null

  return (
    <section className={`section ${styles.locSection}`}>
      <div className="section-inner">
        <SectionHeader
          eyebrow={content?.contactEyebrow ?? '— Hitta hit'}
          title={content?.contactTitle ?? 'Plats & öppettider'}
        />
        <div className={styles.locGrid}>
          <Reveal className={styles.locInfo}>
            <div className={styles.locBlock}>
              <p className={styles.locLabel}>Adress</p>
              <p className={styles.locValue} data-corevo-fact-group="location.address"
                data-corevo-editor-field="location.address"
                data-corevo-editor-stable-field="location.address"
                hidden={!address}>{address ?? ''}</p>
              <p className={styles.locContactValue} data-corevo-map-link-group hidden={!mapHref}>
                <a
                  href={mapHref ?? '#'}
                  className={styles.moreLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-corevo-map-link
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              </p>
              {!address ? (
                <>
                  <p className={styles.locValue} data-corevo-address-placeholder>Visas snart</p>
                  <p className={styles.locHint} data-corevo-address-placeholder>
                    {salonName} lägger till adress och vägbeskrivning i sin profil.
                  </p>
                </>
              ) : null}
            </div>

            <div className={styles.locBlock}>
              <p className={styles.locLabel}>Öppettider</p>
              <table className={styles.hoursTable} data-corevo-opening-group hidden={!hasHours}>
                <tbody>
                  {editorHours.map((h, index) => (
                    <tr key={h.day} data-corevo-opening-row={index} hidden={!h.time}>
                      <th scope="row">{h.day}</th>
                      <td data-corevo-editor-field={`opening_hours.${index}.time`}
                        data-corevo-editor-stable-field={`opening_hours.${index}.time`}>{h.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.locValue} data-corevo-opening-placeholder hidden={hasHours}>Visas snart</p>
              <p className={styles.locHint}>
                Lediga tider syns alltid i bokningen — välj den som passar dig.
              </p>
            </div>

            {/* Behåll tre dolda ankare i preview-DOM:en. De ändrar inte den publicerade
                layouten, men gör att den allra första sociala länken kan visas direkt
                medan ägaren skriver — utan att bryggan skapar egen design-markup. */}
            <div className={styles.locBlock} data-corevo-social-group hidden={!hasSocial}>
              <p className={styles.locLabel}>Följ oss</p>
              <p className={`${styles.locContactValue} ${styles.locSocialRow}`}>
                <a href={social.instagram ?? '#'} className={styles.locContactLink}
                  target="_blank" rel="noreferrer noopener" hidden={!social.instagram}
                  data-corevo-editor-field="social.instagram"
                  data-corevo-editor-stable-field="social.instagram">
                  Instagram
                </a>
                <a href={social.facebook ?? '#'} className={styles.locContactLink}
                  target="_blank" rel="noreferrer noopener" hidden={!social.facebook}
                  data-corevo-editor-field="social.facebook"
                  data-corevo-editor-stable-field="social.facebook">
                  Facebook
                </a>
                <a href={social.tiktok ?? '#'} className={styles.locContactLink}
                  target="_blank" rel="noreferrer noopener" hidden={!social.tiktok}
                  data-corevo-editor-field="social.tiktok"
                  data-corevo-editor-stable-field="social.tiktok">
                  TikTok
                </a>
              </p>
            </div>

            <div className={styles.locBlock} data-corevo-contact-group hidden={!hasContact}>
              <p className={styles.locLabel}>Kontakt</p>
              <p className={styles.locValue} data-corevo-contact-phone-row hidden={!contact.phone}>
                <a href={contact.phone ? `tel:${contact.phone.replace(/\s+/g, '')}` : '#'}
                  className={styles.locContactLink} hidden={!contact.phone}
                  data-corevo-editor-field="contact.phone"
                  data-corevo-editor-stable-field="contact.phone">{contact.phone ?? ''}</a>
              </p>
              <p className={styles.locContactValue} data-corevo-contact-email-row hidden={!contact.email}>
                <a href={contact.email ? `mailto:${contact.email}` : '#'}
                  className={styles.locContactLink} hidden={!contact.email}
                  data-corevo-editor-field="contact.email"
                  data-corevo-editor-stable-field="contact.email">{contact.email ?? ''}</a>
              </p>
            </div>
          </Reveal>

          <Reveal delay={80} hidden={!mapEmbed} data-corevo-map-group>
            {/* OSM-embed på den geokodade adressen — frame-src tillåter openstreetmap.org.
                Iframen är latent så första sparade karta kan visas utan ny DOM. */}
            <iframe
              src={mapEmbed ?? undefined}
              title={`Karta till ${salonName}`}
              className={styles.locMap}
              loading="lazy"
              data-corevo-map-embed
              hidden={!mapEmbed}
            />
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
      <Parallax src={content.closingImage} alt="Välkomnande miljö redo att ta emot dig" editorField="closing_image">
        <p className={styles.closingEyebrow}>{content.closingEyebrow ?? 'Redo när du är'}</p>
        <h2 className={styles.closingTitle}>{content.closingTitle ?? 'Redo för en ny stil?'}</h2>
        <p className={styles.closingLead}>
          {content.closingLede ??
            'Hitta en tid som passar dig och boka online på under en minut — bekräftelse direkt.'}
        </p>
        <div className={styles.closingActions}>
          <BookCta />
        </div>
      </Parallax>
    </section>
  )
}
