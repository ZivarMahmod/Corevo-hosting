import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './oliviathyme.module.css'

/**
 * OLIVIA & THYME — TEMA-PAKETETS UNDERSIDOR (goal-59).
 *
 * De delade sektionerna (AboutSplit + StylistSpotlights + ServiceMenu + LocationHours)
 * gav varenda mall samma /om, /tjanster och /kontakt. Här är butikens egna:
 *
 *   /om        BUTIKSBERÄTTELSE + POLAROIDER — en smal spalt text (butikens historia,
 *              inte en mood-board) och under den galleriets bilder som uppklistrade
 *              polaroider: creme ram, lätt lutning, handskriven bildtext.
 *   /tjanster  MENYKORT — ett enda uppslaget kort med prickade linjer mellan namn och
 *              pris, som butikens uppsatta beställningsmeny. Varje rad är en <Bookable>.
 *              Tomt sortiment → ärlig tom-rad, aldrig påhittade tjänster.
 *   /kontakt   "KOM FÖRBI"-KORT — öppettiderna STORT som sidans huvudsak, adress/telefon/
 *              mejl som en liten sidokolumn. Render-on-present hela vägen.
 *
 * Synkrona server-komponenter (ingen async, ingen 'use client'); interaktionen bor i
 * de delade klient-komponenterna Bookable/BookCta.
 */

/** Sidhuvud som ALLA tre undersidor delar: butikens beige remsa (inte SubpageHero). */
function OtPageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <header className={styles.otSubHead}>
      <Reveal className={styles.otCenter}>
        <p className={styles.otEyebrow}>{eyebrow}</p>
        <h1 className={styles.otSectionTitle}>{title}</h1>
        {lede ? <p className={styles.otBody}>{lede}</p> : null}
      </Reveal>
    </header>
  )
}

export function OliviaThymeOm({ tenant, content }: ThemePageProps) {
  const polaroids = content.galleryImages.slice(0, 6)
  return (
    <div className={styles.otPage}>
      <OtPageHead eyebrow={`— Om ${tenant.name}`} title={content.aboutTitle} />

      {/* BUTIKSBERÄTTELSEN — smal spalt, foto i creme passepartout intill. */}
      <section className={styles.otStory}>
        <Reveal className={styles.otStoryPhotoWrap}>
          <div className={styles.otStoryPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
        </Reveal>
        <Reveal delay={120} className={styles.otStoryText}>
          <p className={styles.otBody}>{content.aboutCopy}</p>
          <p className={styles.otStoryQuote}>{content.italic}</p>
          <ul className={styles.otStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.otStatValue}>{n}</span>
                <span className={styles.otStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* POLAROIDER — uppklistrade bilder ur butiken. */}
      {polaroids.length > 0 ? (
        <section className={styles.otPolaroids}>
          <Reveal className={styles.otCenter}>
            <p className={styles.otEyebrow}>{content.galleryEyebrow ?? '— Från butiken'}</p>
          </Reveal>
          <div className={styles.otPolaroidGrid}>
            {polaroids.map((src, i) => (
              <Reveal key={src} delay={i * 80} className={styles.otPolaroid}>
                <div className={styles.otPolaroidImg} style={{ backgroundImage: `url(${src})` }} />
                <p className={styles.otPolaroidCap}>{tenant.name}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.otVisitBand}>
        <Reveal className={styles.otCenter}>
          <h2 className={styles.otSectionTitle}>{content.closingTitle ?? 'Kom förbi butiken'}</h2>
          <p className={styles.otBody}>
            {content.closingLede ?? 'Vi står bakom disken varje dag — kom in, så binder vi något som passar dig.'}
          </p>
          <div className={styles.otVisitActions}>
            <BookCta className={styles.otBtn} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}

export function OliviaThymeTjanster({ tenant, content, services }: ThemePageProps) {
  return (
    <div className={styles.otPage}>
      <OtPageHead
        eyebrow={content.servicesEyebrow}
        title={content.servicesTitle}
        lede={content.servicesIntro ?? undefined}
      />

      {/* MENYKORTET — butikens uppsatta beställningsmeny. */}
      <section className={styles.otMenuWrap}>
        <Reveal className={styles.otMenuCard}>
          <p className={styles.otMenuHead}>{tenant.name}</p>
          {services.length > 0 ? (
            <ul className={styles.otMenuList}>
              {services.map((s) => (
                <Bookable
                  as="li"
                  key={s.id}
                  className={styles.otMenuRow}
                  label={`Beställ — ${s.name}`}
                >
                  <span className={styles.otMenuMain}>
                    <span className={styles.otMenuName}>{s.name}</span>
                    <span className={styles.otMenuDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.otMenuDots} aria-hidden="true" />
                  <span className={styles.otMenuPrice}>{formatPrice(s)}</span>
                </Bookable>
              ))}
            </ul>
          ) : (
            /* Ärlig tom-text — mallen hittar ALDRIG på ett sortiment. */
            <p className={styles.otMenuEmpty}>
              Menyn fylls på. Hör av dig så berättar vi vad vi kan binda åt dig just nu.
            </p>
          )}
        </Reveal>
      </section>

      <section className={styles.otVisitBand}>
        <Reveal className={styles.otCenter}>
          <h2 className={styles.otSectionTitle}>{content.closingTitle ?? 'Beställ din bukett'}</h2>
          <p className={styles.otBody}>
            {content.closingLede ?? 'Boka en tid eller kom förbi disken — vi hjälper dig hela vägen.'}
          </p>
          <div className={styles.otVisitActions}>
            <BookCta className={styles.otBtn} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}

export function OliviaThymeKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null
  return (
    <div className={styles.otPage}>
      <OtPageHead
        eyebrow={content.contactEyebrow ?? '— Kom förbi'}
        title={content.contactTitle ?? 'Kom förbi butiken'}
      />

      {/* "KOM FÖRBI"-KORTET — öppettiderna är sidans huvudsak, i STORT format. */}
      <section className={styles.otVisitWrap}>
        <Reveal className={styles.otVisitCard}>
          <div className={styles.otVisitHours}>
            <p className={styles.otEyebrow}>— Öppettider</p>
            {hours ? (
              <dl className={styles.otHoursBig}>
                {hours.map((h) => (
                  <div key={h.day} className={styles.otHoursBigRow}>
                    <dt>{h.day}</dt>
                    <dd>{h.time}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.otBody}>Öppettiderna visas snart.</p>
            )}
          </div>

          <div className={styles.otVisitSide}>
            <p className={styles.otEyebrow}>— Hitta hit</p>
            {location?.address ? (
              <p className={styles.otVisitAddr}>{location.address}</p>
            ) : (
              <p className={styles.otBody}>Adressen visas snart.</p>
            )}
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.otMoreLink}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
            {contact.phone || contact.email ? (
              <p className={styles.otVisitContact}>
                {contact.phone ? (
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                ) : null}
                {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
              </p>
            ) : null}
          </div>
        </Reveal>
      </section>

      <section className={styles.otVisitBand}>
        <Reveal className={styles.otCenter}>
          <h2 className={styles.otSectionTitle}>{content.closingTitle ?? `Välkommen in till ${tenant.name}`}</h2>
          <p className={styles.otBody}>
            {content.closingLede ?? 'Vill du vara säker på att vi hinner med? Boka en tid, så står buketten klar.'}
          </p>
          <div className={styles.otVisitActions}>
            <BookCta className={styles.otBtn} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
