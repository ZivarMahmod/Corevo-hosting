import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './calytrix.module.css'
import card from './calytrix-modules.module.css'

/**
 * CALYTRIX — E-HANDEL (goal-64, Claude Design-paketet "Calytrix - E-handel.dc.html").
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i filen, sektion för sektion, i filens
 * ordning:
 *
 *   (1) SPLIT-HERO 5fr/7fr — eyebrow, 64px serif-rubrik med det plommonfärgade ordet,
 *       lede, två CTA:er och tre siffror över en hårlinje. Fotot går kant i kant, 600px.
 *   (2) MEST SÅLDA        — fyra produktkort ur webshop-modulen (filens `homeProducts`
 *       = products.slice(0, 4)) med "Visa hela butiken →" i sektionshuvudet.
 *   (3) MÖRKT MARKNADSBAND — löftet + tre numrerade steg (välj · betala · hämta).
 *   (4) LEVERANSKOLL      — vit kantad platta: foto, rubrik, handling.
 *   (5) BUTIKEN, ALLTID ÖPPEN — 5:4-foto + om-texten + "Mer om oss".
 *   (6) CLOSING           — helbilds-band med slöja: "Någon blir glad idag."
 *
 * Filen har varken galleri-band eller blogg-band på hemmet — och då har inte mallen det
 * heller. Att lägga till en sektion "för att de andra mallarna har en" ÄR att improvisera
 * bort mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * MODUL-GATINGEN ÄR HELIG: är webshopen av finns inga köpknappar, inga produktkort och
 * ingen enda länk till /shop — heron faller då tillbaka på tjänstesidan. Saknad
 * module-prop failar stängt; onboarding-previewns modulytor renderas separat.
 *
 * SYNKRON komponent (ingen async, ingen 'use client') — onboarding-studions preview
 * renderar samma komponent.
 */
export function CalytrixLayout({ content, modules }: StorefrontLayoutProps) {
  // Filens hem visar FYRA produkter (`homeProducts = all.slice(0, 4)`).
  const products = (modules?.shopTeasers ?? []).slice(0, 4)
  const shopReachable = modules?.shopReachable ?? false

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const deliveryPhoto = content.galleryImages[0] ?? content.heroImages[1] ?? ''
  const [titleLine1, titleLine2] = content.heroTitle.split('\n')

  // Filens tre steg i marknadsbandet. Fetstilen sitter på handlingen, resten är löftet.
  const steps = [
    { strong: 'Välj bukett', rest: ' — priset syns direkt, inga överraskningar.' },
    { strong: 'Betala på ett par klick', rest: ' — kort eller Swish.' },
    { strong: 'Hämta eller få levererat', rest: ' — samma dag före kl 14.' },
  ]

  return (
    <div className={styles.cxHome}>
      {/* ══ (1) SPLIT-HERO ══ */}
      <section className={styles.cxHero}>
        <Reveal className={styles.cxHeroText}>
          <p className={styles.cxEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.cxHeroTitle}>
            {titleLine1}
            {titleLine2 ? (
              <>
                {' '}
                <em className={styles.cxHeroEm}>{titleLine2}</em>
              </>
            ) : null}
          </h1>
          <p className={styles.cxHeroLede}>{content.heroLede}</p>
          <div className={styles.cxHeroCtas}>
            {/* Butiken av → CTA:n leder ALDRIG till en sida kunden inte har. */}
            <Link href={shopReachable ? '/shop' : '/tjanster'} className={styles.cxBtn}>
              {shopReachable ? 'Handla nu' : 'Se sortimentet'}
            </Link>
            <Link href="#leverans" className={styles.cxBtnLine}>
              Så funkar leveransen
            </Link>
          </div>
          {content.stats.length > 0 ? (
            <div className={styles.cxHeroStats}>
              {content.stats.map(([value, label]) => (
                <div key={label}>
                  <p className={styles.cxStatValue}>{value}</p>
                  <p className={styles.cxStatLabel}>{label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>
        <div className={styles.cxHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }} />
      </section>

      {/* ══ (2) MEST SÅLDA — modulens data, mallens form ══ */}
      {products.length > 0 ? (
        <section className={styles.cxSection} data-module="shop">
          <Reveal className={styles.cxSecHead} as="div">
            <div>
              <p className={styles.cxSecEyebrow}>{content.shopEyebrow ?? 'Mest sålda'}</p>
              <h2 className={styles.cxSecTitle}>
                {content.shopTitle ?? 'Beställ det alla vill ha'}
              </h2>
            </div>
            <Link href="/shop" className={styles.cxSecLink}>
              {content.shopCta ?? 'Visa hela butiken →'}
            </Link>
          </Reveal>
          <ul className={styles.cxGrid4}>
            {products.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 90}>
                  <article className={card.cxCard}>
                    <Link
                      href={`/shop/${p.id}`}
                      className={card.cxCardMedia}
                      aria-label={`${p.name} — visa produkt`}
                    >
                      <span
                        className={card.cxCardImg}
                        role="img"
                        aria-label={p.imageAlt ?? p.name}
                        style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                      />
                    </Link>
                    <div className={card.cxCardBody}>
                      <div className={card.cxCardHead}>
                        <h3 className={card.cxCardName}>
                          <Link href={`/shop/${p.id}`}>{p.name}</Link>
                        </h3>
                        <p className={card.cxCardPrice}>
                          {formatProductPrice(p)}
                        </p>
                      </div>
                      {/* Filens "LÄGG I KORG" i mallens form. Teaser-propen bär INTE
                          shop-configen (LayoutModuleTeasers = produkter + reachable), och
                          köp-knappens text ÄR fulfilment-beroende (shopCtaLabel: "Lägg i
                          kundvagn" / "Reservera för upphämtning" / "Beställ till butik").
                          Att gissa en fulfilment här hade satt fel löfte på hemmet — så
                          knappen bär till produktsidan, där modulens riktiga <AddToCart>
                          med rätt config sitter. Formen är filens, löftet är sant. */}
                      <div className={card.cxCardBuy}>
                        <Link href={`/shop/${p.id}`}>Köp</Link>
                      </div>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ══ (3) MÖRKT MARKNADSBAND — heroens "Så funkar leveransen" landar här ══ */}
      <section className={styles.cxBand} id="leverans">
        <div className={styles.cxBandInner}>
          <Reveal>
            <h2 className={styles.cxBandTitle}>{content.tagline}</h2>
            <p className={styles.cxBandLede}>
              Vi binder din beställning samma dag som den går ut. Beställer du innan kl 14 en
              vardag står budet utanför dörren innan kvällen.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <ol className={styles.cxSteps}>
              {steps.map((s, i) => (
                <li key={s.strong} className={styles.cxStep}>
                  <span className={styles.cxStepNo} aria-hidden="true">
                    {i + 1}.
                  </span>
                  <p className={styles.cxStepText}>
                    <strong>{s.strong}</strong>
                    {s.rest}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ══ (4) LEVERANSKOLL ══
          Filens tredje spalt är ett adressfält + "Kolla →" — fältet har ingen handler ens
          i .dc.html, och motorn har ingen leveranszons-tjänst. Ett fält som inte gör något
          ljuger (goal-62, sidfotens nyhetsbrev). Kroppen är filens; handlingen är ärlig. */}
      <section className={styles.cxSection}>
        <Reveal className={styles.cxDelivery} as="div">
          <span
            className={styles.cxDeliveryPhoto}
            style={deliveryPhoto ? { backgroundImage: `url(${deliveryPhoto})` } : undefined}
            aria-hidden="true"
          />
          <div>
            <p className={styles.cxSecEyebrow}>{content.findEyebrow ?? 'Leveranskoll'}</p>
            <h2 className={styles.cxDeliveryTitle}>Levererar vi till dig?</h2>
            <p className={styles.cxDeliveryText}>
              Hämta i butiken eller få buketten hemlevererad — leveranssätten står i butiken,
              och du väljer i kassan.
            </p>
          </div>
          <div className={styles.cxDeliveryAction}>
            <Link href="/kontakt" className={styles.cxDeliveryBtn}>
              Kolla med oss →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ══ (5) BUTIKEN, ALLTID ÖPPEN ══ */}
      <section className={styles.cxSection}>
        <div className={styles.cxAbout}>
          <Reveal>
            <div
              className={styles.cxAboutPhoto}
              style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.cxSecEyebrow}>{content.teamEyebrow ?? 'Om butiken'}</p>
            <h2 className={styles.cxAboutTitle}>{content.aboutTitle}</h2>
            <p className={styles.cxAboutCopy}>{content.aboutCopyHome ?? content.aboutCopy}</p>
            <Link href="/om" className={styles.cxBtnOutline}>
              Mer om oss
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ══ (6) CLOSING ══ */}
      <section
        className={styles.cxClosing}
        style={content.closingImage ? { backgroundImage: `url(${content.closingImage})` } : undefined}
      >
        <div className={styles.cxClosingVeil} aria-hidden="true" />
        <div className={styles.cxClosingInner}>
          <h2 className={styles.cxClosingTitle}>{content.closingTitle ?? 'Någon blir glad idag.'}</h2>
          <p className={styles.cxClosingLede}>
            {content.closingLede ?? 'Beställ före kl 14 så levererar vi innan kvällen.'}
          </p>
          <Link href={shopReachable ? '/shop' : '/tjanster'} className={styles.cxBtnLight}>
            {shopReachable ? 'Handla nu' : 'Se sortimentet'}
          </Link>
        </div>
      </section>
    </div>
  )
}
