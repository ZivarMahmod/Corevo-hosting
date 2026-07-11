import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './eloria.module.css'

/**
 * ELORIA — blush, mörkgrön och guld, klassisk premium (florist-sviten, goal-58).
 * Motsatsen till Mina. EGET formspråk, signaturordning:
 *   1. Hero i TVÅ LAGER — en foto-diptyk bakom, en mörkgrön guldramad "platta"
 *      med centrerad display-serif ovanpå.
 *   2. "Tre löften"-rad med tunna guldikoner (Färska blommor / Egen leverans /
 *      Handbundet).
 *   3. Shop-teasers som eleganta höga kort (4:5).
 *   4. Tjänster i en klassisk prislista med guld-dotterade linjer.
 *   5. Om — två-kolumns porträtt + text (delad sfAboutGrid).
 *   6. Offert/bröllop-CTA — gatad mörkgrön guldramad banner, ekar heroplattan.
 *   7. Blogg — samma eleganta kort-språk som butiken.
 *   8. Galleri.
 *   9. Presentkort — en smal rad, aldrig en hel sektion.
 *  10. Plats & öppettider.
 *  11. Closing — foto + mörkgrön scrim, bokstavligen en bracket kring sidan
 *      tillsammans med hero-plattan.
 * Webshop/blogg/presentkort/offert vävs in via `modules`-propen (S10).
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): identiteten (färgfamilj, struktur-signatur,
 * sektionsordning) är orörd — utförandet är skärpt. Mallen använder sina EGNA typroller
 * (styles.elEyebrow/elH2/elBody/elMoreLink) istället för de globala .sf-*-rollerna, som
 * ligger på en slapp ×1.2–1.3-skala. Skalan, radien, bildratiot (4:5 överallt), rytmen
 * och kontrasten bor i eloria.module.css / eloria.theme.ts.
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

  // ELORIA ÄGER SINA MODULER (S10): butik/blogg/presentkort/offert vävs in i
  // temats guldlinje-språk istället för den generiska sektions-stapeln —
  // page.tsx hoppar över StorefrontModuleSections för eloria och förladdar
  // teasers (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir
  // SYNKRON (onboarding-studions klient-preview renderar samma komponent).
  // Modulernas EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort,
  // /offert).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Utan modules-prop (studions statiska preview) visas allt som går att visa
  // utan riktig data — reachable-flaggorna gatar bara LÄNKAR mot moduler, inte
  // teaser-sektionerna själva (de kräver ändå riktiga teasers för att synas).
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
          <h3 className={styles.elVowTitle}>Färska blommor</h3>
          <p className={styles.elVowText}>Snittade i säsong, aldrig äldre än nödvändigt.</p>
        </Reveal>
        <Reveal delay={90} className={styles.elVow}>
          <DeliveryIcon />
          <h3 className={styles.elVowTitle}>Egen leverans</h3>
          <p className={styles.elVowText}>Vårt eget bud, varsamt hela vägen fram.</p>
        </Reveal>
        <Reveal delay={180} className={styles.elVow}>
          <RibbonIcon />
          <h3 className={styles.elVowTitle}>Handbundet</h3>
          <p className={styles.elVowText}>Varje bukett bunden för hand, aldrig maskinellt.</p>
        </Reveal>
      </section>

      {/* 3 — UR BUTIKEN — webshop-modulen invävd som eleganta höga kort (4:5).
          Bara ett smakprov; hela sortimentet bor på /shop. Tom modul → ingen
          sektion. */}
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

      {/* 4 — TJÄNSTER: klassisk prislista med guld-dotterade linjer. Bara när
          det finns aktiva tjänster — ingen tom-text på hemmet (goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={styles.elPriceSection}>
          <div className={shared.sfNarrow}>
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

      {/* 5 — OM: två-kolumns porträtt + text */}
      <section className={styles.elAboutSection}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div className={shared.sfAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.elEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.elH2}>{content.aboutTitle}</h2>
            <p className={styles.elBody}>{content.aboutCopyHome}</p>
            <ul className={shared.sfStatTrio}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={`${shared.sfStatValue} ${styles.elStatValue}`}>{n}</span>
                  <span className={`${shared.sfStatLabel} ${styles.elStatLabel}`}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 6 — OFFERT/BRÖLLOP — gatad mörkgrön guldramad banner, ekar
          heroplattan. Ingen offertReachable → ingen sektion (S9). */}
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

      {/* 7 — FRÅN BLOGGEN — blogg-modulen invävd i samma eleganta kort-språk
          som butiken (3 senaste → /blogg). Tom modul → ingen sektion. */}
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

      {/* 8 — GALLERI — masonry + lightbox, tvingat till mallens ENDA ratio (4:5) */}
      <section className={`${shared.sfGalleryBand} ${styles.elGallery}`}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className={styles.elEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* 9 — PRESENTKORT — en smal rad i temats ton, aldrig en hel sektion */}
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

      {/* 10 — PLATS & ÖPPETTIDER */}
      <section className={`${shared.sfLocBand} ${styles.elLoc}`}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className={styles.elEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.elH2}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.elBody}>{location.address}</p>
            ) : (
              <p className={styles.elBody}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={`${shared.sfHoursRow} ${styles.elHoursRow}`}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={shared.sfMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.elMapLink}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={styles.elMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 11 — CLOSING: foto + mörkgrön scrim — ekar heroplattan, bracketar sidan */}
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
