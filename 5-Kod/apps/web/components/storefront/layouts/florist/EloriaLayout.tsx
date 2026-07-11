import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './eloria.module.css'

/**
 * ELORIA — blush, mörkgrön och guld, klassisk premium (florist-sviten).
 *
 * TEMA-PAKET (goal-59): hemmet äger nu HELA sin komposition. Tidigare lånade den nedre
 * halvan plattformens delade .sf*-sektioner (sfAboutGrid, sfGalleryBand, sfLocBand,
 * sfStatTrio, sfHours, sfMap) — exakt de sektioner som gjorde att elva mallar läste som
 * samma sida i olika färg. NOLL delade klasser återstår: om-uppslaget, galleribandet,
 * plats-sektionen och stat-trion är Elorias egna, i mallens klassiska språk.
 *
 * SIGNATURORDNING (ingen syskonmall har den):
 *   1. Hero i TVÅ LAGER — foto-diptyk bakom, mörkgrön guldramad platta ovanpå.
 *   2. Tre löften med tunna guldikoner.
 *   3. Butiken som höga 4:5-kort med guldlinje.
 *   4. Tjänster som klassisk prislista med guld-ledare (varje rad = <Bookable>).
 *   5. Om — guldramat uppslag (foto | text) med stat-lista i guld-ledare.
 *   6. Offert/bröllop — mörkgrön guldramad banner som ekar heroplattan.
 *   7. Bloggen i samma kort-språk som butiken.
 *   8. Galleri i mallens ENDA bildratio (4:5).
 *   9. Presentkort — en smal rad, aldrig en hel sektion.
 *  10. Plats & öppettider — öppettiderna som prislista med guld-ledare.
 *  11. Closing — foto + mörkgrön scrim; bracketar sidan mot heroplattan.
 *
 * Modul-gatingen är plattformens och HELIG: shopReachable/offertReachable gatar länkar,
 * teasers-sektionerna finns bara när teasers finns, presentkortet är en smal rad. Layouten
 * är SYNKRON (onboarding-studions klient-preview renderar samma komponent).
 */

/** Fyrkronblomma — löftesikon 1: Färska blommor. */
function BloomIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className={styles.elVowIcon} aria-hidden="true">
      <circle cx="16" cy="16" r="3.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 12.6c-1.6-3.3-1-6.5 1.4-8.5 2 2.6 1.8 5.7-1.4 8.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M19.4 16c3.3-1.6 6.5-1 8.5 1.4-2.6 2-5.7 1.8-8.5-1.4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 19.4c1.6 3.3 1 6.5-1.4 8.5-2-2.6-1.8-5.7 1.4-8.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12.6 16c-3.3 1.6-6.5 1-8.5-1.4 2.6-2 5.7-1.8 8.5 1.4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/** Leveransbil — löftesikon 2: Egen leverans. */
function DeliveryIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className={styles.elVowIcon} aria-hidden="true">
      <rect x="3.5" y="11" width="15" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M18.5 14h5l3 3.4V21h-8v-7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10.5" cy="23.2" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="22.5" cy="23.2" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

/** Rosett/band — löftesikon 3: Handbundet. */
function RibbonIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className={styles.elVowIcon} aria-hidden="true">
      <path d="M16 16 6.2 9.2c-1.9 1.4-1.9 6.2 0 7.6L16 16Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 16 25.8 9.2c1.9 1.4 1.9 6.2 0 7.6L16 16Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 18v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function EloriaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // ELORIA ÄGER SINA MODULER (S10): butik/blogg/presentkort/offert vävs in i temats
  // guldlinje-språk istället för den generiska sektions-stapeln. Modulernas EGNA sidor är
  // fortfarande deras hem (/shop, /blogg, /presentkort, /offert).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  const [heroL, heroR] = [
    content.heroImages[0] ?? '',
    content.heroImages[1] ?? content.heroImages[0] ?? '',
  ]

  return (
    <>
      {/* 1 — HERO: lager 1 = foto-diptyk, lager 2 = mörkgrön guldramad platta */}
      <section className={styles.elHero}>
        <div className={styles.elHeroBackdrop} aria-hidden="true">
          <div className={styles.elHeroPhoto} style={{ backgroundImage: `url(${heroL})` }} />
          <div className={styles.elHeroPhoto} style={{ backgroundImage: `url(${heroR})` }} />
        </div>
        <Reveal className={styles.elHeroPlate}>
          <span className={styles.elEyebrowDark}>{content.heroEyebrow}</span>
          <h1 className={styles.elHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.elHeroLede}>{content.heroLede}</p>
          <div className={styles.elHeroActions}>
            <BookCta className={styles.elHeroCta} />
          </div>
        </Reveal>
      </section>

      {/* 2 — TRE LÖFTEN: tunna guldikoner */}
      <section className={styles.elVows}>
        <Reveal className={styles.elVow}>
          <BloomIcon />
          <h2 className={styles.elVowTitle}>Färska blommor</h2>
          <p className={styles.elVowText}>Snittade i säsong, aldrig äldre än nödvändigt.</p>
        </Reveal>
        <Reveal delay={90} className={styles.elVow}>
          <DeliveryIcon />
          <h2 className={styles.elVowTitle}>Egen leverans</h2>
          <p className={styles.elVowText}>Vårt eget bud, varsamt hela vägen fram.</p>
        </Reveal>
        <Reveal delay={180} className={styles.elVow}>
          <RibbonIcon />
          <h2 className={styles.elVowTitle}>Handbundet</h2>
          <p className={styles.elVowText}>Varje bukett bunden för hand, aldrig maskinellt.</p>
        </Reveal>
      </section>

      {/* 3 — UR BUTIKEN: webshop-modulen som höga 4:5-kort med guldlinje. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.elShopSection}>
          <Reveal className={styles.elSecHead}>
            <p className={styles.elEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.elH2}>{content.shopTitle ?? 'Beställ något klassiskt'}</h2>
          </Reveal>
          <div className={styles.elCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.elCard}>
                  <div
                    className={styles.elCardImgTall}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <span className={styles.elCardRule} aria-hidden="true" />
                  <h3 className={styles.elCardName}>{p.name}</h3>
                  <p className={styles.elCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
          {shopReachable ? (
            <Reveal className={styles.elSecFoot}>
              <Link href="/shop" className={styles.elMoreLink}>
                {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 4 — TJÄNSTER: klassisk prislista med guld-ledare. Inga tjänster → ingen sektion
          (hemmet visar aldrig tom-text; /tjanster gör det). */}
      {rows.length > 0 ? (
        <section className={styles.elPriceSection}>
          <div className={styles.elNarrow}>
            <Reveal className={styles.elSecHead}>
              <p className={styles.elEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.elH2}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={styles.elPriceList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.elPriceRow} label={`Boka — ${s.name}`}>
                    <span className={styles.elPriceMain}>
                      <span className={styles.elPriceName}>{s.name}</span>
                      <span className={styles.elPriceDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.elPriceDots} aria-hidden="true" />
                    <span className={styles.elPriceVal}>{formatPrice(s)}</span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal className={styles.elSecFoot}>
                <Link href="/tjanster" className={styles.elMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </Link>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 5 — OM: Elorias EGNA guldramade uppslag (foto | text), stat-lista med guld-ledare.
          Var tidigare plattformens delade sfAboutGrid — samma bild-vänster/text-höger som
          alla andra mallar. */}
      <section className={styles.elAboutSection}>
        <Reveal className={styles.elSpread}>
          <div
            className={styles.elSpreadPhoto}
            style={{ backgroundImage: `url(${content.aboutImage})` }}
            role="img"
            aria-label={`Miljön hos ${tenant.name}`}
          />
          <div className={styles.elSpreadCopy}>
            <p className={styles.elEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.elH2}>{content.aboutTitle}</h2>
            <p className={styles.elBody}>{content.aboutCopyHome}</p>
            <ul className={styles.elFacts}>
              {content.stats.map(([n, l]) => (
                <li key={l} className={styles.elFactRow}>
                  <span className={styles.elFactLabel}>{l}</span>
                  <span className={styles.elPriceDots} aria-hidden="true" />
                  <span className={styles.elFactValue}>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* 6 — OFFERT/BRÖLLOP: gatad mörkgrön guldramad banner som ekar heroplattan. */}
      {offertReachable ? (
        <section className={styles.elOfferBand}>
          <Reveal className={styles.elOfferInner}>
            <p className={styles.elEyebrowDark}>— Bröllop &amp; tillställningar</p>
            <h2 className={styles.elOfferTitle}>Blommor för er stora dag</h2>
            <p className={styles.elOfferBody}>
              Handbundna brudbuketter, dekor och installationer i klassisk stil — vi tar fram ett
              förslag som passar just ert bröllop eller er tillställning.
            </p>
            <Link href="/offert" className={styles.elOfferCta}>
              Begär offert
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 7 — FRÅN BLOGGEN: samma kort-språk som butiken. Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.elCardSectionAlt}>
          <Reveal className={styles.elSecHead}>
            <p className={styles.elEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.elH2}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
          </Reveal>
          <div className={styles.elCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.elCard}>
                  <div
                    className={styles.elCardImgTall}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <span className={styles.elCardRule} aria-hidden="true" />
                  <h3 className={styles.elCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.elCardExcerpt}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.elSecFoot}>
            <Link href="/blogg" className={styles.elMoreLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 8 — GALLERI: mallens EGET band (var delad sfGalleryBand), brickorna tvingade till 4:5. */}
      <section className={styles.elGallery}>
        <div className={styles.elWide}>
          <Reveal>
            <p className={styles.elEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* 9 — PRESENTKORT: en smal rad i temats ton, aldrig en hel sektion. */}
      {presentkortLive ? (
        <div className={styles.elGiftRow}>
          <Reveal className={styles.elGiftInner}>
            <p className={styles.elEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.elGiftLede}>{content.giftLede ?? 'Ge bort något tidlöst.'}</p>
            <Link href="/presentkort" className={styles.elGiftCta}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 10 — PLATS & ÖPPETTIDER: Elorias egen två-spalt (var delad sfLocBand/sfHours/sfMap) —
          öppettiderna sätts som en prislista med guld-ledare, samma grepp som tjänsterna. */}
      <section className={styles.elLoc}>
        <div className={styles.elLocGrid}>
          <Reveal>
            <p className={styles.elEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.elH2}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.elBody}>{location.address}</p>
            ) : (
              <p className={styles.elBody}>Adressen visas så snart den är ifylld.</p>
            )}
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.elMoreLink}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </Reveal>
          <Reveal delay={120} className={styles.elHoursCard}>
            <p className={styles.elEyebrow}>— Öppettider</p>
            {location?.hours ? (
              <ul className={styles.elFacts}>
                {location.hours.map((h) => (
                  <li key={h.day} className={styles.elFactRow}>
                    <span className={styles.elFactLabel}>{h.day}</span>
                    <span className={styles.elPriceDots} aria-hidden="true" />
                    <span className={styles.elFactValue}>{h.time}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.elBody}>Öppettiderna visas så snart de är ifyllda.</p>
            )}
          </Reveal>
        </div>
      </section>

      {/* 11 — CLOSING: foto + mörkgrön scrim — ekar heroplattan, bracketar sidan. */}
      <section className={styles.elClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
        <div className={styles.elClosingScrim} aria-hidden="true" />
        <Reveal className={styles.elClosingInner}>
          <h2 className={styles.elClosingTitle}>{content.closingTitle ?? 'Redo att beställa något vackert?'}</h2>
          <p className={styles.elClosingLede}>
            {content.closingLede ?? 'Beställ, begär en offert eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.elClosingActions}>
            <BookCta className={styles.elClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
