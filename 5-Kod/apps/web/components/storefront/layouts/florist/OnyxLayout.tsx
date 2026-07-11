import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './onyx.module.css'

/**
 * ONYX — mörk, dramatisk lyxflorist (Zivar: "ska kännas som ett svärd, inte en
 * mjuk morot"). Sedan goal-59 ett HELT TEMA-PAKET: mallen äger sitt sidhuvud och
 * sin sidfot (onyx.chrome.tsx) och sina undersidor (onyx.pages.tsx) — hemmet
 * nedan använder NOLL delade .sf*-sektioner. Det var där alla mallar blev lika:
 * variationen satt i heron, sedan föll alla ner i samma skelett.
 *
 * HEMMETS EGET SKELETT:
 *   1. HERO — full-bleed mörk bild som möter viewportens topp (`.hero`-sentinelen
 *      → naven blir transparent över fotot), texten VÄNSTERSTÄLLD i nederkant.
 *   2. LEVERANS-BAND — hård ljus (bone) invertering mot den svarta sidan.
 *   3. TRIO — tre 4/5-bilder mot svart.
 *   4. BUTIK — mörka kort med korall-pris (webshop-modulen invävd).
 *   5. PRISLISTA — ljus text på svart, hårlinjer, löpnummer i korall.
 *   6. OM — surface-panel: 4/5-porträtt mot en kort textspalt + statistik.
 *   7. BLOGG — samma mörka kort (blogg-modulen invävd).
 *   8. PRESENTKORT — en SMAL rad, aldrig en hel sektion.
 *   9. GALLERI · 10. PLATS (mallens egen tids-tabell + kartlänk) · 11. CLOSING.
 *
 * Modul-gatingen är plattformens och HELIG: teasers-sektionerna finns bara när
 * modulen levererat något, leverans-bandets shop-knapp bara när butiken går att
 * nå. Layouten är SYNKRON (inga await, ingen 'use client').
 */
export function OnyxLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Utan modules-prop (studions statiska preview) visas shop-vägen — previewn ska
  // se en hel sida; med prop styr modulens verkliga tillstånd.
  const shopReachable = modules ? modules.shopReachable : true

  const trioImages = [
    content.galleryImages[0] ?? content.heroImages[0] ?? '',
    content.galleryImages[1] ?? content.heroImages[0] ?? '',
    content.galleryImages[2] ?? content.heroImages[0] ?? '',
  ]

  return (
    <>
      {/* 1 — HERO. `hero` (global sentinel) → NavShell går transparent över fotot;
          .onxHero drar upp sektionen med -(--nav-h) så bilden möter toppen. */}
      <section
        className={`hero ${styles.onxHero}`}
        style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
      >
        <div className={styles.onxHeroScrim} aria-hidden="true" />
        <div className={styles.onxHeroInner}>
          <Reveal>
            <span className={styles.onxEyebrow}>{content.heroEyebrow}</span>
            <h1 className={styles.onxHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.onxHeroLede}>{content.heroLede}</p>
            <div className={styles.onxHeroActions}>
              <BookCta className={styles.onxBtn} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2 — LJUST LEVERANS-BAND (bone) — hård invertering mot den svarta sidan */}
      <div className={styles.onxDeliveryBand}>
        <Reveal className={styles.onxDeliveryInner}>
          <p className={styles.onxDeliveryText}>
            Fräscha snitt, bundna för hand — och ute på väg samma dag.
          </p>
          {shopReachable ? (
            <Link href="/shop" className={styles.onxBtnInk}>
              Beställ blommor
            </Link>
          ) : (
            <BookCta className={styles.onxBtnInk} label="Boka tid" />
          )}
        </Reveal>
      </div>

      {/* 3 — MÖRK PRODUKTTRIO MOT SVART */}
      <section className={styles.onxTrioSection}>
        <Reveal className={styles.onxTrioHead}>
          <p className={styles.onxEyebrow}>{content.galleryEyebrow ?? '— I säsong'}</p>
        </Reveal>
        <div className={styles.onxTrio}>
          <Reveal>
            <div className={styles.onxTrioImg} style={{ backgroundImage: `url(${trioImages[0]})` }} />
          </Reveal>
          <Reveal delay={90}>
            <div className={styles.onxTrioImg} style={{ backgroundImage: `url(${trioImages[1]})` }} />
          </Reveal>
          <Reveal delay={180}>
            <div className={styles.onxTrioImg} style={{ backgroundImage: `url(${trioImages[2]})` }} />
          </Reveal>
        </div>
      </section>

      {/* 4 — UR BUTIKEN (webshop-modulen). Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.onxCardSection}>
          <Reveal className={styles.onxSecHead}>
            <p className={styles.onxEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.onxTitle}>{content.shopTitle ?? 'Beställ något dramatiskt'}</h2>
          </Reveal>
          <div className={styles.onxCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.onxCard}>
                  <div
                    className={styles.onxCardImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <h3 className={styles.onxCardName}>{p.name}</h3>
                  <p className={styles.onxCardMeta}>{formatShopPrice(p.priceCents, p.currency)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.onxSecFoot}>
            <Link href="/shop" className={styles.onxMoreLink}>
              {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 5 — PRISLISTA på svart (mallens EGEN rad-grid, inte den delade sfRowList) */}
      {rows.length > 0 ? (
        <section className={styles.onxServices}>
          <Reveal className={styles.onxServicesHead}>
            <p className={styles.onxEyebrow}>{content.servicesEyebrow}</p>
            <h2 className={styles.onxTitle}>{content.servicesTitle}</h2>
          </Reveal>
          <div className={styles.onxPriceList}>
            {rows.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Bookable className={styles.onxPriceRow} label={`Boka — ${s.name}`}>
                  <span className={styles.onxRowNum} aria-hidden="true">
                    {serviceNum(i)}
                  </span>
                  <span className={styles.onxPriceMain}>
                    <span className={styles.onxRowName}>{s.name}</span>
                    <span className={styles.onxRowDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.onxPriceMeta}>
                    <span className={styles.onxRowPrice}>{formatPrice(s)}</span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          {hasMore ? (
            <Reveal className={styles.onxSecFoot}>
              <Link href="/tjanster" className={styles.onxMoreLink}>
                Se allt vi gör <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 6 — OM (mallens egen split-grid) */}
      <section className={styles.onxAboutSection}>
        <div className={styles.onxAboutGrid}>
          <Reveal>
            <div
              className={styles.onxAboutPhoto}
              style={{ backgroundImage: `url(${content.aboutImage})` }}
            />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.onxEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.onxTitle}>{content.aboutTitle}</h2>
            <p className={styles.onxBody}>{content.aboutCopyHome}</p>
            <ul className={styles.onxStats}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.onxStatValue}>{n}</span>
                  <span className={styles.onxStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 7 — FRÅN BLOGGEN (blogg-modulen). Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.onxCardSection}>
          <Reveal className={styles.onxSecHead}>
            <p className={styles.onxEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.onxTitle}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
          </Reveal>
          <div className={styles.onxCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.onxCard}>
                  <div
                    className={styles.onxCardImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.onxCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.onxCardExcerpt}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.onxSecFoot}>
            <Link href="/blogg" className={styles.onxMoreLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 8 — PRESENTKORT: en smal rad i temats ton, aldrig en hel sektion. */}
      {presentkortLive ? (
        <div className={styles.onxGiftRow}>
          <Reveal className={styles.onxGiftInner}>
            <p className={`${styles.onxEyebrow} ${styles.onxGiftEyebrow}`}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.onxGiftLede}>{content.giftLede ?? 'Ge bort något som sticker ut.'}</p>
            <Link href="/presentkort" className={`${styles.onxMoreLink} ${styles.onxGiftLink}`}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 9 — GALLERI */}
      <section className={styles.onxGallery}>
        <Reveal className={styles.onxGalleryHead}>
          <p className={styles.onxEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
        </Reveal>
        <Reveal>
          <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
        </Reveal>
      </section>

      {/* 10 — PLATS & ÖPPETTIDER (mallens egen tids-tabell + kartlänk) */}
      <section className={styles.onxLocBand}>
        <div className={styles.onxLocGrid}>
          <Reveal>
            <p className={styles.onxEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.onxTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.onxBody}>{location.address}</p>
            ) : (
              <p className={styles.onxBody}>Adress visas snart.</p>
            )}
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.onxMoreLink}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </Reveal>
          {location?.hours ? (
            <Reveal delay={120}>
              <div className={styles.onxHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.onxHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* 11 — CLOSING — mörk yta, EN korall-pill (accenten stannar på små ytor) */}
      <section className={styles.onxClosing}>
        <Reveal className={styles.onxClosingInner}>
          <h2 className={styles.onxTitle}>
            {content.closingTitle ?? 'Redo för något som sticker ut?'}
          </h2>
          <p className={styles.onxClosingLede}>
            {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.onxClosingActions}>
            <BookCta className={styles.onxBtn} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
