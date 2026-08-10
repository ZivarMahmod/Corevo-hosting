import { BookCta } from '@/components/brand/BookCta'
import { Bookable } from '@/components/storefront/Bookable'
import type { Service } from '@/lib/tenant-data'
import { resolveMotiontestView } from '@/lib/storefront/motiontest-content'
import { FreshCutWordmark } from './FreshCutChrome'
import type { StorefrontLayoutProps } from './types'
import motion from './freshcut-motion.module.css'

function formatPrice(priceCents: number): string {
  return `${Math.round(priceCents / 100)} kr`
}

function serviceSlot(service: Service): `service:${string}` {
  return `service:${service.id}`
}

export function FreshCutMotionLayout({
  tenant,
  services,
  location,
  contact,
  modules,
}: StorefrontLayoutProps) {
  const view = resolveMotiontestView(services, location)
  const bookingReachable = modules?.bookingReachable ?? false
  const featured = view.verifiedServices.slice(0, 3)
  const primaryLocation = view.locations[0]
  const prototypeLocation = view.locations[1]

  return (
    <div className={motion.page} data-storefront-experience="freshcut-motiontest">
      <section
        className={`${motion.poster} ${motion.threshold}`}
        id="upplevelsen"
        aria-labelledby="motion-threshold-title"
        data-poster-composition="threshold"
      >
        <div className={motion.thresholdImage} aria-hidden="true" data-media-status="previsualization" />
        <div className={motion.thresholdContent}>
          <p className={motion.wordmark}><FreshCutWordmark name={tenant.name} /></p>
          <p className={motion.kicker}>Linköping · Klippning och skägg</p>
          <h1 id="motion-threshold-title">Rent snitt. Ingen krångel.</h1>
          <p className={motion.lede}>
            Lokalt hantverk, tydliga priser och en bokning som inte står i vägen.
          </p>

          <div className={motion.primaryActions} aria-label="Genvägar">
            <BookCta
              slotId="hero"
              enabled={bookingReachable}
              className={motion.primaryButton}
              label="Boka via Bokadirekt · Bokhållaregatan"
            />
            <a href="#tjanster">Se tjänster &amp; priser</a>
            <a href="#salongen">Välj salong</a>
            <a href="#hantverket">Upplev FreshCut</a>
          </div>

          <div className={motion.priceRail} aria-label="Populära tjänster">
            {featured.map(({ service }) => (
              <div key={service.id} className={motion.priceRailRow}>
                <span>{service.name}</span>
                <strong>{formatPrice(service.price_cents)}</strong>
              </div>
            ))}
          </div>

          <div className={motion.twoSalons}>
            <strong>Två salonger i Linköping</strong>
            <span>{primaryLocation?.address || 'Primär adress publiceras snart'} — boka via Bokadirekt</span>
            <span>{prototypeLocation?.address} — bokningslänk kommer</span>
          </div>
        </div>
      </section>

      <section
        className={`${motion.poster} ${motion.craft}`}
        id="hantverket"
        aria-labelledby="motion-craft-title"
        data-poster-composition="craft"
      >
        <div className={motion.craftImage} aria-hidden="true" data-media-status="previsualization" />
        <div className={motion.craftCopy}>
          <p className={motion.posterIndex}>02 / Hantverket</p>
          <h2 id="motion-craft-title">Händerna gör skillnaden.</h2>
          <p>
            Vi lyssnar först och klipper sedan. Sax, maskin, kam och varm handduk —
            alltid med fokus på formen som passar dig.
          </p>
          <nav aria-label="Upplevelsens delar" className={motion.checkpoints}>
            <a href="#upplevelsen">Entré</a>
            <a href="#hantverket" aria-current="step">Hantverket</a>
            <a href="#spegeln">Resultatet</a>
          </nav>
          <div className={motion.posterActions}>
            <a href="#resultat">Hoppa till resultat</a>
            <a href="#tjanster">Se tjänster</a>
            <BookCta
              slotId="results"
              enabled={bookingReachable}
              className={motion.textBooking}
              label="Boka nu"
            />
          </div>
        </div>
      </section>

      <section
        className={`${motion.poster} ${motion.mirror}`}
        id="spegeln"
        aria-labelledby="motion-mirror-title"
        data-poster-composition="mirror"
      >
        <div className={motion.mirrorResult}>
          <div className={motion.mirrorFrame}>
            <div className={motion.mirrorImage} aria-hidden="true" data-media-status="previsualization" />
          </div>
          <p>Ett rent avslut, en skarp linje och en form som håller efter besöket.</p>
        </div>
        <div className={motion.mirrorBooking}>
          <p className={motion.posterIndex}>03 / Spegeln</p>
          <h2 id="motion-mirror-title">Resultatet är ditt.</h2>
          <p>Välj en tjänst och boka tryggt vidare via Bokadirekt.</p>
          <div className={motion.mirrorServices}>
            {featured.map(({ service }) => (
              <div key={service.id}>
                <span>{service.name}<small>{service.duration_min} min</small></span>
                <strong>{formatPrice(service.price_cents)}</strong>
              </div>
            ))}
          </div>
          <BookCta
            slotId="services-footer"
            enabled={bookingReachable}
            className={motion.primaryButton}
            label="Boka via Bokadirekt"
          />
          <a className={motion.lineLink} href="#tjanster">Visa alla tjänster</a>
        </div>
      </section>

      <div className={motion.normalPage}>
        <section className={motion.services} id="tjanster" aria-labelledby="motion-services-title">
          <header className={motion.sectionHeader}>
            <p>Priser / tjänster</p>
            <h2 id="motion-services-title">Välj ditt snitt.</h2>
            <span>Klippning och skäggvård med tydlig tid och tydligt pris.</span>
          </header>

          <div className={motion.serviceList}>
            {view.verifiedServices.map(({ service, provenance }, index) => {
              const slotId = serviceSlot(service)
              return (
                <article
                  key={service.id}
                  data-service-id={service.id}
                  data-provenance={provenance}
                  className={motion.serviceRow}
                >
                  <Bookable
                    slotId={slotId}
                    enabled={bookingReachable}
                    className={motion.serviceBooking}
                    label={`Boka ${service.name}, ${formatPrice(service.price_cents)}`}
                  >
                    <span className={motion.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={motion.rowName}>{service.name}</span>
                    <span className={motion.rowDuration}>{service.duration_min} min</span>
                    <strong>{formatPrice(service.price_cents)}</strong>
                    <span data-booking-slot={slotId} className={motion.rowAction}>Boka ↗</span>
                  </Bookable>
                </article>
              )
            })}
          </div>

          <details className={motion.prototypeServices}>
            <summary>Preliminära priser för damklippning</summary>
            <p>Priserna är preliminära och kan inte bokas ännu.</p>
            <ul>
              {view.prototypeServices.map((service) => (
                <li
                  key={service.name}
                  data-prototype-service={service.name}
                  data-provenance={service.provenance}
                >
                  <span>{service.name}</span>
                  <strong>{formatPrice(service.priceCents)}</strong>
                  <small>Preliminärt</small>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className={motion.salons} id="salongen" aria-labelledby="motion-salons-title">
          <header className={motion.sectionHeader}>
            <p>Två adresser / en tydlig gräns</p>
            <h2 id="motion-salons-title">Salongerna.</h2>
          </header>
          <div className={motion.locationList}>
            <article
              data-location-key="bokhallaregatan"
              data-provenance={primaryLocation?.provenance}
              className={motion.location}
            >
              <p>Bokhållaregatan</p>
              <h3>{primaryLocation?.name}</h3>
              <address>{primaryLocation?.address || 'Adress publiceras snart'}</address>
              <BookCta
                slotId="contact"
                enabled={bookingReachable && Boolean(primaryLocation?.bookable)}
                className={motion.locationBooking}
                label="Boka via Bokadirekt"
              />
            </article>
            <article
              data-location-key="sankt-larsgatan"
              data-provenance={prototypeLocation?.provenance}
              className={motion.location}
            >
              <p>Sankt Larsgatan · bokning öppnar senare</p>
              <h3>{prototypeLocation?.name}</h3>
              <address>{prototypeLocation?.address}</address>
              <strong className={motion.bookingPending}>Bokningslänk kommer</strong>
            </article>
          </div>
        </section>

        <section className={motion.results} id="resultat" aria-labelledby="motion-results-title">
          <div>
            <p>Resultat / bredd</p>
            <h2 id="motion-results-title">Olika hår. Samma noggrannhet.</h2>
          </div>
          <ul aria-label="FreshCuts tjänstebredd">
            <li>Ung</li><li>Barn</li><li>Dam</li><li>Senior</li><li>Skägg</li>
          </ul>
          <BookCta
            slotId="results"
            enabled={bookingReachable}
            className={motion.darkBooking}
            label="Boka ditt resultat"
          />
        </section>

        <section className={motion.about} id="om" aria-labelledby="motion-about-title">
          <p>Om FreshCut</p>
          <h2 id="motion-about-title">Rakt, lokalt och noggrant.</h2>
          <p>
            Hörnsalongen där frisör möter barberare. Vi håller det enkelt, vasst och
            prisvärt — och vi minns hur du gillar din fade.
          </p>
          <BookCta
            slotId="studio"
            enabled={bookingReachable}
            className={motion.textBooking}
            label="Boka via Bokadirekt"
          />
        </section>

        <section className={motion.contact} id="kontakt" aria-labelledby="motion-contact-title">
          <div>
            <p>Kontakt</p>
            <h2 id="motion-contact-title">Vi ses i stolen.</h2>
          </div>
          <div className={motion.contactFacts}>
            {primaryLocation?.address ? <address>{primaryLocation.address}</address> : null}
            {contact?.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a> : null}
            {contact?.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
          </div>
          <BookCta
            slotId="contact"
            enabled={bookingReachable}
            className={motion.primaryButton}
            label="Boka via Bokadirekt"
          />
        </section>
      </div>

      <div className={motion.mobileBooking}>
        <BookCta
          slotId="nav"
          enabled={bookingReachable}
          className={motion.primaryButton}
          label="Boka via Bokadirekt"
        />
      </div>
    </div>
  )
}
