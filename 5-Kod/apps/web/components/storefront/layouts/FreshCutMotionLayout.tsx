import type { CSSProperties } from 'react'
import { BookCta } from '@/components/brand/BookCta'
import { Bookable } from '@/components/storefront/Bookable'
import type { Service } from '@/lib/tenant-data'
import { resolveMotiontestView } from '@/lib/storefront/motiontest-content'
import { FreshCutWordmark } from './FreshCutChrome'
import { FRESHCUT_MOTION_PREPAINT_SCRIPT } from './freshcut-motion-capability'
import { FreshCutMotionExperience } from './FreshCutMotionExperience'
import {
  FRESHCUT_MOTION_SCENES,
  type FreshCutMotionScene,
  type FreshCutMotionSceneId,
} from './freshcut-motion-scenes'
import type { StorefrontLayoutProps } from './types'
import motion from './freshcut-motion.module.css'

function formatPrice(priceCents: number): string {
  return `${Math.round(priceCents / 100)} kr`
}

function serviceSlot(service: Service): `service:${string}` {
  return `service:${service.id}`
}

function requiredMotionScene(id: FreshCutMotionSceneId): FreshCutMotionScene {
  const scene = FRESHCUT_MOTION_SCENES.find((candidate) => candidate.id === id)
  if (!scene) throw new Error(`FreshCut motion scene ${id} is missing`)
  return scene
}

const MOTION_SCENE: Record<FreshCutMotionSceneId, FreshCutMotionScene> = {
  hero: requiredMotionScene('hero'),
  entrance: requiredMotionScene('entrance'),
  chair: requiredMotionScene('chair'),
  craft: requiredMotionScene('craft'),
  range: requiredMotionScene('range'),
  return: requiredMotionScene('return'),
  mirror: requiredMotionScene('mirror'),
  team: requiredMotionScene('team'),
}

type MotionSceneStyle = CSSProperties & {
  '--motion-scene-crop': string
  '--motion-scene-mobile-crop': string
}

function motionSceneStyle(scene: FreshCutMotionScene): MotionSceneStyle {
  return {
    '--motion-scene-crop': scene.media.desktopCrop,
    '--motion-scene-mobile-crop': scene.media.mobileCrop,
  }
}

function motionLayerClass(layer: FreshCutMotionScene['layers'][number]): string {
  if (layer.kind === 'media') return `${motion.sceneLayer} ${motion.sceneMediaLayer}`
  if (layer.kind === 'side-scrim') return `${motion.sceneLayer} ${motion.sceneSideScrim}`
  if (layer.kind === 'bottom-scrim') return `${motion.sceneLayer} ${motion.sceneBottomScrim}`
  return `${motion.sceneLayer} ${motion.sceneMirrorFrame}`
}

export function FreshCutMotionSceneVisual({ scene }: { scene: FreshCutMotionScene }) {
  const heroPoster = scene.id === 'hero'

  return (
    <div className={motion.sceneVisual} aria-hidden="true">
      {scene.layers.map((layer) => (
        <div
          key={layer.token}
          className={motionLayerClass(layer)}
          data-motion-layer={layer.token}
          data-motion-layer-kind={layer.kind}
          data-motion-depth-factor={layer.depthFactor}
          data-motion-media-host={layer.kind === 'media' ? scene.id : undefined}
          data-motion-media-class={layer.kind === 'media' ? motion.sceneVideo : undefined}
        >
          {layer.kind === 'media' ? (
            <picture
              className={motion.scenePosterPicture}
              data-motion-poster-scene={scene.id}
              data-motion-poster-owner={scene.media.posterOwner}
            >
              <source media="(max-width: 1023px)" srcSet={scene.media.mobilePoster} />
              <source media="(min-width: 1024px)" srcSet={scene.media.desktopPoster} />
              <img
                className={motion.scenePoster}
                data-motion-poster-image={scene.id}
                src={scene.media.desktopPoster}
                alt=""
                loading={heroPoster ? 'eager' : 'lazy'}
                fetchPriority={heroPoster ? 'high' : 'auto'}
                decoding="async"
                width={1920}
                height={1080}
              />
            </picture>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function FreshCutMotionLayout({
  tenant,
  content,
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
  const prototypeCopy = view.prototypeCopy

  return (
    <div className={motion.page} data-storefront-experience="freshcut-motiontest">
      <script
        data-freshcut-motion-prepaint=""
        dangerouslySetInnerHTML={{ __html: FRESHCUT_MOTION_PREPAINT_SCRIPT }}
      />
      <section
        className={motion.cinematic}
        id="upplevelsen"
        aria-labelledby={MOTION_SCENE.hero.headingId}
      >
        <FreshCutMotionExperience
          bookingControl={
            <BookCta
              slotId="hero"
              enabled={bookingReachable}
              className={motion.primaryButton}
              label="Boka nu"
            />
          }
        >
          <div className={motion.businessPanel} data-motion-business-panel>
            <p className={motion.wordmark}>
              <FreshCutWordmark name={tenant.name} />
            </p>
            <p
              className={motion.kicker}
              data-corevo-editor-field="heroEyebrow"
              data-corevo-editor-stable-field="heroEyebrow"
            >
              {content.heroEyebrow}
            </p>
            <h1
              id={MOTION_SCENE.hero.headingId}
              tabIndex={-1}
              data-corevo-editor-field="heroTitle"
              data-corevo-editor-stable-field="heroTitle"
            >
              {content.heroTitle}
            </h1>
            <p
              className={motion.lede}
              data-corevo-editor-field="heroLede"
              data-corevo-editor-stable-field="heroLede"
            >
              {content.heroLede}
            </p>

            <div className={motion.primaryActions} aria-label="Genvägar">
              <a href="#tjanster">Se tjänster &amp; priser</a>
              <a href="#salongen">Välj salong</a>
              <a href={`#${MOTION_SCENE.entrance.anchorId}`}>Upplev FreshCut</a>
            </div>

            <div
              className={motion.priceRail}
              aria-label="Populära tjänster"
              data-motion-popular-services
            >
              {featured.map(({ service }) => (
                <div key={service.id} className={motion.priceRailRow}>
                  <span>{service.name}</span>
                  <strong>{formatPrice(service.price_cents)}</strong>
                </div>
              ))}
            </div>

            <div className={motion.twoSalons} data-motion-salon-selector>
              <strong>Två salonger i Linköping</strong>
              <span>
                {primaryLocation?.address || 'Primär adress publiceras snart'} — boka via Bokadirekt
              </span>
              <span>{prototypeLocation?.address} — bokningslänk kommer</span>
            </div>
          </div>

          <section
            className={`${motion.motionScene} ${motion.heroScene}`}
            id={MOTION_SCENE.hero.anchorId}
            aria-labelledby={MOTION_SCENE.hero.headingId}
            data-motion-scene="hero"
            data-motion-copy-placement={MOTION_SCENE.hero.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.hero)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.hero} />
          </section>

          <section
            className={motion.motionScene}
            id={MOTION_SCENE.entrance.anchorId}
            aria-labelledby={MOTION_SCENE.entrance.headingId}
            data-motion-scene="entrance"
            data-motion-copy-placement={MOTION_SCENE.entrance.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.entrance)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.entrance} />
            <div className={motion.sceneCopy} data-provenance={prototypeCopy.provenance}>
              <p className={motion.posterIndex}>{prototypeCopy.scenes.entrance.eyebrow}</p>
              <h2 id={MOTION_SCENE.entrance.headingId} tabIndex={-1}>
                {prototypeCopy.scenes.entrance.title}
              </h2>
            </div>
          </section>

          <section
            className={motion.motionScene}
            id={MOTION_SCENE.chair.anchorId}
            aria-labelledby={MOTION_SCENE.chair.headingId}
            data-motion-scene="chair"
            data-motion-copy-placement={MOTION_SCENE.chair.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.chair)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.chair} />
            <div className={motion.sceneCopy} data-provenance={prototypeCopy.provenance}>
              <p className={motion.posterIndex}>{prototypeCopy.scenes.chair.eyebrow}</p>
              <h2 id={MOTION_SCENE.chair.headingId} tabIndex={-1}>
                {prototypeCopy.scenes.chair.title}
              </h2>
              <p>{prototypeCopy.scenes.chair.body}</p>
            </div>
          </section>

          <section
            className={motion.motionScene}
            id={MOTION_SCENE.craft.anchorId}
            aria-labelledby={MOTION_SCENE.craft.headingId}
            data-motion-scene="craft"
            data-motion-copy-placement={MOTION_SCENE.craft.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.craft)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.craft} />
            <div className={motion.sceneCopy} data-provenance={prototypeCopy.provenance}>
              <p className={motion.posterIndex}>{prototypeCopy.scenes.craft.eyebrow}</p>
              <h2 id={MOTION_SCENE.craft.headingId} tabIndex={-1}>
                {prototypeCopy.scenes.craft.title}
              </h2>
              <p>{prototypeCopy.scenes.craft.body}</p>
            </div>
          </section>

          <section
            className={motion.motionScene}
            id={MOTION_SCENE.range.anchorId}
            aria-labelledby={MOTION_SCENE.range.headingId}
            data-motion-scene="range"
            data-motion-copy-placement={MOTION_SCENE.range.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.range)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.range} />
            <div className={motion.sceneCopy} data-provenance={prototypeCopy.provenance}>
              <p className={motion.posterIndex}>{prototypeCopy.scenes.range.eyebrow}</p>
              <h2 id={MOTION_SCENE.range.headingId} tabIndex={-1}>
                {prototypeCopy.scenes.range.title}
              </h2>
              <ul className={motion.rangeLabels} aria-label="Tjänstebredd">
                {prototypeCopy.rangeLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          </section>

          <section
            className={motion.motionScene}
            id={MOTION_SCENE.return.anchorId}
            aria-labelledby={MOTION_SCENE.return.headingId}
            data-motion-scene="return"
            data-motion-copy-placement={MOTION_SCENE.return.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.return)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.return} />
            <div className={motion.sceneCopy} data-provenance={prototypeCopy.provenance}>
              <p className={motion.posterIndex}>{prototypeCopy.scenes.return.eyebrow}</p>
              <h2 id={MOTION_SCENE.return.headingId} tabIndex={-1}>
                {prototypeCopy.scenes.return.title}
              </h2>
            </div>
          </section>

          <section
            className={`${motion.motionScene} ${motion.mirrorScene}`}
            id={MOTION_SCENE.mirror.anchorId}
            aria-labelledby={MOTION_SCENE.mirror.headingId}
            data-motion-scene="mirror"
            data-motion-copy-placement={MOTION_SCENE.mirror.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.mirror)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.mirror} />
            <div className={motion.sceneCopy} data-provenance={prototypeCopy.provenance}>
              <p className={motion.posterIndex}>{prototypeCopy.scenes.mirror.eyebrow}</p>
              <h2 id={MOTION_SCENE.mirror.headingId} tabIndex={-1}>
                {prototypeCopy.scenes.mirror.title}
              </h2>
              <p>{prototypeCopy.scenes.mirror.body}</p>
            </div>
          </section>

          <section
            className={motion.motionScene}
            id={MOTION_SCENE.team.anchorId}
            aria-labelledby={MOTION_SCENE.team.headingId}
            data-motion-scene="team"
            data-motion-copy-placement={MOTION_SCENE.team.copyPlacement}
            style={motionSceneStyle(MOTION_SCENE.team)}
          >
            <FreshCutMotionSceneVisual scene={MOTION_SCENE.team} />
            <div className={motion.sceneCopy}>
              <p
                className={motion.posterIndex}
                data-corevo-editor-field="teamEyebrow"
                data-corevo-editor-stable-field="teamEyebrow"
              >
                {content.teamEyebrow}
              </p>
              <h2
                id={MOTION_SCENE.team.headingId}
                tabIndex={-1}
                data-corevo-editor-field="teamTitle"
                data-corevo-editor-stable-field="teamTitle"
              >
                {content.teamTitle}
              </h2>
              {content.teamLead ? (
                <p data-corevo-editor-field="teamLead" data-corevo-editor-stable-field="teamLead">
                  {content.teamLead}
                </p>
              ) : null}
              <a href="#om">Fortsätt till om oss</a>
            </div>
          </section>
        </FreshCutMotionExperience>
      </section>

      <div className={motion.normalPage}>
        <section className={motion.services} id="tjanster" aria-labelledby="motion-services-title">
          <header className={motion.sectionHeader}>
            <p
              data-corevo-editor-field="servicesEyebrow"
              data-corevo-editor-stable-field="servicesEyebrow"
            >
              {content.servicesEyebrow}
            </p>
            <h2
              id="motion-services-title"
              data-corevo-editor-field="servicesTitle"
              data-corevo-editor-stable-field="servicesTitle"
            >
              {content.servicesTitle}
            </h2>
            <span
              data-corevo-editor-field="servicesIntro"
              data-corevo-editor-stable-field="servicesIntro"
            >
              {content.servicesIntro}
            </span>
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
                    <span data-booking-slot={slotId} className={motion.rowAction}>
                      Boka ↗
                    </span>
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
            <p
              data-corevo-editor-field="resultsEyebrow"
              data-corevo-editor-stable-field="resultsEyebrow"
            >
              {content.resultsEyebrow}
            </p>
            <h2
              id="motion-results-title"
              data-corevo-editor-field="homeSecondTitle"
              data-corevo-editor-stable-field="homeSecondTitle"
            >
              {content.homeSecondTitle}
            </h2>
            <p data-corevo-editor-field="resultsLede" data-corevo-editor-stable-field="resultsLede">
              {content.resultsLede}
            </p>
          </div>
          <ul aria-label="FreshCuts tjänstebredd" data-provenance={prototypeCopy.provenance}>
            {prototypeCopy.resultLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <BookCta
            slotId="results"
            enabled={bookingReachable}
            className={motion.darkBooking}
            label="Boka ditt resultat"
          />
        </section>

        <section className={motion.about} id="om" aria-labelledby="motion-about-title">
          <p
            data-corevo-editor-field="studioEyebrow"
            data-corevo-editor-stable-field="studioEyebrow"
          >
            {content.studioEyebrow}
          </p>
          <h2
            id="motion-about-title"
            data-corevo-editor-field="aboutTitle"
            data-corevo-editor-stable-field="aboutTitle"
          >
            {content.aboutTitle}
          </h2>
          <p
            data-corevo-editor-field="aboutCopyHome"
            data-corevo-editor-stable-field="aboutCopyHome"
          >
            {content.aboutCopyHome}
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
            <p
              data-corevo-editor-field="contactEyebrow"
              data-corevo-editor-stable-field="contactEyebrow"
            >
              {content.contactEyebrow}
            </p>
            <h2
              id="motion-contact-title"
              data-corevo-editor-field="contactTitle"
              data-corevo-editor-stable-field="contactTitle"
            >
              {content.contactTitle}
            </h2>
            <p data-corevo-editor-field="contactLede" data-corevo-editor-stable-field="contactLede">
              {content.contactLede}
            </p>
          </div>
          <div className={motion.contactFacts}>
            {primaryLocation?.address ? <address>{primaryLocation.address}</address> : null}
            {contact?.phone ? (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
            ) : null}
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
