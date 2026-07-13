import { Bookable } from '../../Bookable'
import { formatPrice, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import styles from './solsalt.module.css'

/**
 * SOL & SALT — undersidorna (goal-64, exakt kopia ur .dc.html).
 *
 *   /om       → filens `showOm`: "Sol i, salt ut, blommor på hörnet" — prosa till vänster,
 *               foto i 4:5 till höger, sedan de tre färgplattorna (solgul · terrakotta · kobolt).
 *   /tjanster → filens `showBoka`-panel: "Boka oss" + lede, sedan uppdragen som rader i ett
 *               papperskort. Varje rad är en <Bookable> (funktionen är plattformens — mallen
 *               bygger ALDRIG egen boknings-logik).
 *   /kontakt  → filens `showKontakt`: koboltplattan (Boden · Nås på · Öppet) till vänster,
 *               papperskortet till höger.
 *
 * SYNKRONA server-komponenter. Render-on-present: saknas adress/kontakt/tider ritas raden inte
 * alls — mallen hittar aldrig på en adress.
 */

export function SolSaltOm({ content, tenant }: ThemePageProps) {
  return (
    <section className={styles.slPage}>
      <div className={styles.slOmSplit}>
        <div>
          <p className={styles.slEyebrow}>{content.teamEyebrow}</p>
          <h1 className={styles.slOmTitle}>{content.aboutTitle}</h1>
          <p className={styles.slOmBody}>{content.aboutCopy}</p>
          <p className={styles.slOmBody}>{content.italic}</p>
        </div>
        <div
          className={styles.slOmPhoto}
          style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
          role="img"
          aria-label={tenant.name}
        />
      </div>

      {/* Filens tre plattor. Texterna är designens egna — de är en del av mallen, inte data. */}
      <div className={styles.slFacts}>
        <div className={styles.slFactSun}>
          <p className={`${styles.slFactBig} ${styles.slFactInk}`}>06:00</p>
          <p className={`${styles.slFactSmall} ${styles.slFactInkSoft}`}>plockar på grossisten</p>
        </div>
        <div className={styles.slFactClay}>
          <p className={`${styles.slFactBig} ${styles.slFactPaper}`}>Alla</p>
          <p className={`${styles.slFactSmall} ${styles.slFactPaper}`}>dagar öppet</p>
        </div>
        <div className={styles.slFactBlue}>
          <p className={`${styles.slFactBig} ${styles.slFactPaper}`}>400 kr</p>
          <p className={`${styles.slFactSmall} ${styles.slFactPaperSoft}`}>fri hemkörning över</p>
        </div>
      </div>
    </section>
  )
}

export function SolSaltTjanster({ content, services }: ThemePageProps) {
  return (
    <section className={styles.slPageNarrow}>
      <p className={styles.slEyebrow}>{content.servicesEyebrow}</p>
      <h1 className={styles.slPageTitle}>{content.servicesTitle}</h1>
      <p className={styles.slPageLede}>
        {content.servicesIntro ??
          'Bröllop, fest eller ett grönt lyft till kontoret? Boka en tid så pratar vi färg och form.'}
      </p>

      <div className={styles.slPanel}>
        <p className={styles.slPanelLabel}>Vad gäller det?</p>
        {services.length === 0 ? (
          <p className={styles.slEmpty}>Uppdragen visas snart.</p>
        ) : (
          <div className={styles.slList}>
            {services.map((s) => (
              <Bookable key={s.id} className={styles.slListRow} label={`Boka — ${s.name}`}>
                <span>
                  <span className={styles.slListName}>{s.name}</span>
                  <span className={styles.slListDesc}>{serviceDesc(s)}</span>
                </span>
                <span className={styles.slListPrice}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function SolSaltKontakt({ content, location, contact }: ThemePageProps) {
  const hours = location?.hours ?? null

  return (
    <section className={styles.slPage}>
      <h1 className={styles.slPageTitle}>Hör av dig</h1>

      <div className={styles.slKontakt}>
        <div className={styles.slKontaktCard}>
          {location?.address ? (
            <>
              <p className={styles.slKontaktLabel}>Boden</p>
              <p className={styles.slKontaktValue}>{location.address}</p>
            </>
          ) : null}

          {contact.email || contact.phone ? (
            <>
              <p className={styles.slKontaktLabel}>Nås på</p>
              <p className={styles.slKontaktValue}>
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

          {hours ? (
            <>
              <p className={styles.slKontaktLabel}>Öppet</p>
              <p className={styles.slKontaktValue}>
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

        {/* Filens högra kort är ett kontaktformulär. Plattformen har ingen kontakt-endpoint
            (offert-modulen äger formuläret), så kortet bär mallens form med en ÄRLIG handling:
            mejl-CTA:n. Ett formulär som inte skickar någonstans är sämre än ingen ruta alls. */}
        <div className={styles.slKontaktForm}>
          <p className={styles.slKontaktIntro}>{content.closingLede ?? content.aboutCopy}</p>
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className={styles.slKontaktCta}>
              Skicka
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}
