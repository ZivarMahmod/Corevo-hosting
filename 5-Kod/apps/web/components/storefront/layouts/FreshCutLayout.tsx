import { BookCta } from '@/components/brand/BookCta'
import { Bookable } from '@/components/storefront/Bookable'
import type { Service } from '@/lib/tenant-data'
import type { StorefrontLayoutProps } from './types'
import fc from './freshcut.module.css'

const SOURCE_HERO = 'Klippt. Format. Klart.'

const SERVICE_DESCRIPTIONS: Array<[RegExp, string]> = [
  [/student/i, 'Samma noggranna resultat till studentpris.'],
  [/långt skägg/i, 'Komplett formning med varm handduk.'],
  [/kort skägg/i, 'Klippning, skäggtrim och varm handduk.'],
  [/pensionär/i, 'En noggrann, klassisk herrklippning.'],
  [/barn/i, 'Trygg och smidig klippning för de yngre.'],
  [/skäggtrim/i, 'Form, rena linjer och välvårdad finish.'],
  [/herrklippning/i, 'Klippning, styling och en finish som håller.'],
]

function serviceDescription(service: Service): string {
  const authored = service.description?.trim()
  if (authored) return authored
  return SERVICE_DESCRIPTIONS.find(([pattern]) => pattern.test(service.name))?.[1] ?? 'Noggrant utfört med fokus på din stil.'
}

function servicePrice(service: Service): string {
  return `${Math.round(service.price_cents / 100).toLocaleString('sv-SE')} kr`
}

function featuredServices(services: Service[]) {
  const pick = (match: (name: string) => boolean) =>
    services
      .filter((service) => match(service.name.toLocaleLowerCase('sv-SE')))
      .sort((a, b) => a.price_cents - b.price_cents)[0]

  return [
    {
      label: 'Klippning',
      service: pick((name) => name.includes('klipp') && !name.includes('skägg')),
    },
    {
      label: 'Hår + skägg',
      service: pick((name) => name.includes('klipp') && name.includes('skägg')),
    },
    {
      label: 'Skäggtrim',
      service: pick((name) => name.includes('skäggtrim')),
    },
  ].filter((item): item is { label: string; service: Service } => Boolean(item.service))
}

function heroTitle(title: string) {
  const lines = title === SOURCE_HERO ? ['Klippt.', 'Format.', 'Klart.'] : title.split('\n').filter(Boolean)
  return lines.map((line, index) => (
    <span key={`${line}-${index}`} className={index === lines.length - 1 ? fc.heroTitleLast : undefined}>
      {line}
    </span>
  ))
}

function addressParts(address: string | null | undefined): string[] {
  return address?.split(',').map((part) => part.trim()).filter(Boolean) ?? []
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function instagramLabel(url: string): string {
  try {
    const handle = new URL(url).pathname.split('/').filter(Boolean)[0]
    return handle ? `@${handle}` : 'Instagram'
  } catch {
    return 'Instagram'
  }
}

/**
 * FreshCuts customer-locked website.
 *
 * The approved source owns the visual structure. Corevo still owns every live
 * function: services/prices come from the tenant, copy/media can be overridden
 * in Sida, and every booking surface goes through BookCta/Bookable.
 */
export function FreshCutLayout({
  content,
  services,
  location,
  contact,
  social,
  modules,
}: StorefrontLayoutProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  const popular = featuredServices(services)
  const address = addressParts(location?.address)
  const phone = contact?.phone?.trim() || null
  const email = contact?.email?.trim() || null
  const instagram = social?.instagram?.trim() || null
  const heroImage = content.heroImages[0]
  const gallery = content.galleryImages.slice(0, 3)
  const studioImage = content.aboutImage

  return (
    <div className={fc.page}>
      <section className={fc.hero} aria-labelledby="freshcut-hero-title">
        <div className={fc.heroMedia} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt=""
            width={1600}
            height={900}
            fetchPriority="high"
            data-corevo-editor-field="hero_images.0"
            data-corevo-editor-stable-field="hero_images.0"
          />
        </div>
        <div className={fc.heroGrid}>
          <p className={fc.heroKicker}>
            Hår <span>/</span> Skägg <span>/</span> Finish
          </p>
          <div className={fc.heroTitleWrap}>
            <h1 id="freshcut-hero-title">{heroTitle(content.heroTitle)}</h1>
          </div>
          <div className={fc.heroSidecopy}>
            <p>{content.heroLede}</p>
            <div className={fc.heroActions}>
              <BookCta
                enabled={bookingReachable}
                className={`${fc.button} ${fc.buttonSignal}`}
                label="Boka på Bokadirekt ↗"
              />
              <a className={`${fc.button} ${fc.buttonGhost}`} href="#tjanster">
                Se behandlingar
              </a>
            </div>
          </div>
          <p className={fc.heroCoordinate}>58.4108° N · 15.6214° E</p>
          <p className={fc.heroIndex}>FC / 01</p>
        </div>
      </section>

      {popular.length > 0 ? (
        <section className={fc.bookingStrip} aria-label="Populära behandlingar">
          {popular.map(({ label, service }, index) => (
            <Bookable
              key={service.id}
              enabled={bookingReachable}
              className={fc.featuredService}
              label={`Boka ${service.name}`}
            >
              <span className={fc.featuredIndex}>0{index + 1}</span>
              <span className={fc.featuredName}>
                <strong>{label}</strong>
                <small>{service.duration_min} minuter</small>
              </span>
              <span className={fc.featuredPrice}>
                {index < 2 ? 'från ' : ''}
                {Math.round(service.price_cents / 100)} <small>kr</small>
              </span>
              <i aria-hidden="true">↗</i>
            </Bookable>
          ))}
        </section>
      ) : null}

      <section className={fc.servicesSection} id="tjanster" aria-labelledby="freshcut-services-title">
        <div className={`${fc.sectionLabel} ${fc.sectionLabelLight}`}>
          <span>01</span>
          <p>{content.servicesEyebrow.replace(/^—\s*/, '')}</p>
        </div>
        <div className={fc.servicesHeading}>
          <h2 id="freshcut-services-title">{content.servicesTitle}</h2>
          <p>Tydliga priser. Rätt tid för jobbet. Boka online när det passar dig.</p>
        </div>

        {services.length > 0 ? (
          <div className={fc.servicesList}>
            {services.map((service, index) => (
              <Bookable
                key={service.id}
                enabled={bookingReachable}
                className={fc.serviceRow}
                label={`Boka ${service.name}, ${service.duration_min} min, ${servicePrice(service)}`}
              >
                <span className={fc.serviceIndex}>{String(index + 1).padStart(2, '0')}</span>
                <span className={fc.serviceName}>
                  <h3>{service.name}</h3>
                  <p>{serviceDescription(service)}</p>
                </span>
                <span className={fc.serviceTime}>{service.duration_min} min</span>
                <strong className={fc.servicePrice}>{servicePrice(service)}</strong>
                <span className={fc.serviceAction}>
                  Boka <i aria-hidden="true">↗</i>
                </span>
              </Bookable>
            ))}
          </div>
        ) : (
          <p className={fc.emptyServices}>Behandlingarna publiceras snart.</p>
        )}

        <div className={fc.servicesFooter}>
          <p>Vet du inte vad du ska välja? Ring så hjälper vi dig.</p>
          <div>
            {phone ? (
              <a className={`${fc.button} ${fc.buttonOutlineLight}`} href={phoneHref(phone)}>
                Ring salongen
              </a>
            ) : null}
            <BookCta
              enabled={bookingReachable}
              className={`${fc.button} ${fc.buttonSignal}`}
              label="Se alla tider ↗"
            />
          </div>
        </div>
      </section>

      <section className={fc.resultsSection} id="resultat" aria-labelledby="freshcut-results-title">
        <div className={fc.resultsIntro}>
          <div className={fc.sectionLabel}>
            <span>02</span>
            <p>Resultatet</p>
          </div>
          <h2 id="freshcut-results-title">
            {content.homeSecondTitle ?? 'Detaljerna gör skillnaden.'}
          </h2>
          <p>Fade, sax eller skarpa skägglinjer. Uttrycket varierar, nivån ska vara densamma.</p>
          <BookCta
            enabled={bookingReachable}
            className={`${fc.button} ${fc.buttonBlack}`}
            label="Gör din bokning ↗"
          />
        </div>
        <div className={fc.resultsGallery}>
          {gallery.map((src, index) => (
            <figure
              key={src}
              className={`${fc.resultImage} ${index === 0 ? fc.resultImagePrimary : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={[
                  'Detaljarbete på en ren fade',
                  'Noggrann klippning med sax',
                  'Skägglinje som formas med rakkniv',
                ][index]}
                width={1080}
                height={1080}
                loading="lazy"
                data-corevo-editor-field={`gallery_images.${index}`}
                data-corevo-editor-stable-field={`gallery_images.${index}`}
              />
              <figcaption>{['01 / Fade', '02 / Sax', '03 / Skägg'][index]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={fc.studioSection} id="salongen" aria-labelledby="freshcut-studio-title">
        <div className={fc.studioImage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={studioImage}
            alt="Barberare som arbetar noggrant med sax"
            width={1500}
            height={1999}
            loading="lazy"
            data-corevo-editor-field="about_image"
            data-corevo-editor-stable-field="about_image"
          />
          <p>Hantverk / Precision / Personligt</p>
        </div>
        <div className={fc.studioCopy}>
          <div className={`${fc.sectionLabel} ${fc.sectionLabelLight}`}>
            <span>03</span>
            <p>FreshCut Linköping</p>
          </div>
          <h2 id="freshcut-studio-title">{content.aboutTitle}</h2>
          <p className={fc.studioLede}>{content.aboutCopyHome}</p>
          <div className={fc.studioPoints}>
            {[
              'Erfarenhet av herrhår, fade och skägg.',
              'Vi lyssnar först och klipper sedan.',
              `Mitt i city${address[0] ? ` på ${address[0]}` : '.'}`,
            ].map((point, index) => (
              <div key={point}>
                <span>0{index + 1}</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
          <div className={fc.studioActions}>
            <BookCta
              enabled={bookingReachable}
              className={`${fc.button} ${fc.buttonSignal}`}
              label="Boka besök ↗"
            />
            <a className={`${fc.lineLink} ${fc.lineLinkLight}`} href="#kontakt">
              Hitta hit <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </section>

      <section className={fc.finalCta} aria-labelledby="freshcut-final-title">
        <div className={fc.finalCtaTop}>
          <p>{content.whySub ?? 'Nästa lediga tid är bara några klick bort.'}</p>
          <span>FC / BOOK</span>
        </div>
        <h2 id="freshcut-final-title">{content.whyTitle ?? 'Redo för en skarpare look?'}</h2>
        <BookCta
          enabled={bookingReachable}
          className={fc.finalCtaLink}
          label="Boka på Bokadirekt ↗"
        />
      </section>

      <section className={fc.contactSection} id="kontakt" aria-labelledby="freshcut-contact-title">
        <div className={fc.sectionLabel}>
          <span>04</span>
          <p>Kontakt</p>
        </div>
        <div className={fc.contactMain}>
          <div className={fc.contactCopy}>
            <h2 id="freshcut-contact-title">Vi ses i stolen.</h2>
            <p>Aktuella öppettider och alla lediga tider ser du alltid i bokningen.</p>
            <BookCta
              enabled={bookingReachable}
              className={`${fc.button} ${fc.buttonBlack}`}
              label="Boka en tid ↗"
            />
          </div>
          <div className={fc.contactLinks}>
            {address.length > 0 ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location?.address ?? '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Besök</span>
                <strong>{address.join(', ')}</strong>
                <i aria-hidden="true">↗</i>
              </a>
            ) : null}
            {phone ? (
              <a href={phoneHref(phone)}>
                <span>Ring</span>
                <strong>{phone}</strong>
                <i aria-hidden="true">↗</i>
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`}>
                <span>Mejl</span>
                <strong>{email}</strong>
                <i aria-hidden="true">↗</i>
              </a>
            ) : null}
            {instagram ? (
              <a href={instagram} target="_blank" rel="noopener noreferrer">
                <span>Följ</span>
                <strong>{instagramLabel(instagram)}</strong>
                <i aria-hidden="true">↗</i>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <BookCta
        enabled={bookingReachable}
        className={fc.mobileBooking}
        label="Boka på Bokadirekt ↗"
      />
    </div>
  )
}
