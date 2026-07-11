import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './calytrix.module.css'

/**
 * CALYTRIX — plommon/vinröd e-handelsflorist (tema-paket, goal-59). NOLL delade
 * .sf*-sektioner: hemmet är mallens EGET från hero till closing (det var i den
 * delade nedre halvan alla 20 mallar blev samma sida).
 *
 * Ordning: (1) fullbredds foto-hero med rubriken I bilden → (2) mörkt marknadsband
 * → (3) produkt-karusell (horisontell scroll + "Populär"-pill) → (4) priser som
 * RUTNÄT av kort (varje kort = <Bookable>) → (5) blogg-rad → (6) presentkort-rad
 * → (7) galleri → (8) OM som brett bildband med texten i overlay → (9) plats-rad
 * → (10) closing. Annonsraden bor numera i navet (calytrix.chrome.tsx) så den
 * finns på varje sida, som i en riktig butik.
 *
 * Modul-gatingen är oförändrad: shopReachable gatar butikslänkar, teasers-sektioner
 * ritas bara när teasers finns, presentkort = smal rad. Layouten är SYNKRON.
 */
export function CalytrixLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  const shopReachable = modules ? modules.shopReachable : true

  const heroImg = content.heroImages[0] ?? ''

  return (
    <div className={styles.calRoot}>
      {/* 1 — FULLBREDDS FOTO-HERO: rubriken ligger I bilden */}
      <section className={styles.calHero} style={{ backgroundImage: `url(${heroImg})` }}>
        <div className={styles.calHeroScrim} aria-hidden="true" />
        <div className={styles.calHeroInner}>
          <h1 className={styles.calHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.calHeroLede}>{content.heroLede}</p>
          <div className={styles.calHeroCtaRow}>
            <BookCta className={styles.calHeroCta} />
          </div>
        </div>
      </section>

      {/* 2 — MÖRKT MARKNADSFÖRINGS-BAND */}
      <section className={styles.calBand}>
        <p className={styles.calBandText}>{content.tagline}</p>
      </section>

      {/* 3 — PRODUKT-KARUSELL (webshop-modulen invävd) */}
      {shopTeasers.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.shopEyebrow ?? '— Mest sålda'}</p>
              <h2 className={styles.calSecTitle}>{content.shopTitle ?? 'Beställ det alla vill ha'}</h2>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={styles.calSecCta}>
                {content.shopCta ?? 'Visa hela butiken'}
              </Link>
            ) : null}
          </Reveal>
          <div className={styles.calScrollRow}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} as="div" delay={i * 70} className={styles.calCardSlot}>
                <Link href={`/shop/${p.id}`} className={styles.calCard}>
                  <div className={styles.calCardImgWrap}>
                    <span className={styles.calBadge}>Populär</span>
                    <div
                      className={styles.calCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                  </div>
                  <h3 className={styles.calCardName}>{p.name}</h3>
                  <p className={styles.calCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4 — PRISER SOM RUTNÄT AV KORT (mallens egna, inte den delade radlistan) */}
      {rows.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className={styles.calSecTitle}>{content.servicesTitle}</h2>
            </div>
            {hasMore ? (
              <Link href="/tjanster" className={styles.calSecCta}>
                Se allt vi gör
              </Link>
            ) : null}
          </Reveal>
          <div className={styles.calPriceGrid}>
            {rows.map((s, i) => (
              <Reveal key={s.id} as="div" delay={i * 60}>
                <Bookable className={styles.calPriceCard} label={`Boka — ${s.name}`}>
                  <span className={styles.calPriceName}>{s.name}</span>
                  <span className={styles.calPriceDesc}>{serviceDesc(s)}</span>
                  <span className={styles.calPriceFoot}>
                    <span className={styles.calPriceValue}>{formatPrice(s)}</span>
                    <span className={styles.calPriceDur}>{formatDuration(s)}</span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5 — FRÅN BLOGGEN (samma kort-formspråk som butiken) */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className={styles.calSecTitle}>{content.blogTitle ?? 'Nytt från floristen'}</h2>
            </div>
            <Link href="/blogg" className={styles.calSecCta}>
              {content.blogCta ?? 'Läs hela bloggen'}
            </Link>
          </Reveal>
          <div className={styles.calScrollRow}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} as="div" delay={i * 70} className={styles.calCardSlot}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.calCard}>
                  <div className={styles.calCardImgWrap}>
                    <div
                      className={styles.calCardImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                  </div>
                  <h3 className={styles.calCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.calCardMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6 — PRESENTKORT: smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <div className={styles.calGiftRow}>
          <Reveal className={styles.calGiftInner} as="div">
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.calGiftText}>{content.giftLede ?? 'Ge bort något som blommar.'}</p>
            <Link href="/presentkort" className={styles.calGiftCta}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 7 — GALLERI (mallens 4:5-ratio + raka hörn via .calGallery-wrappern) */}
      {content.galleryImages.length > 0 ? (
        <section className={styles.calSection}>
          <div className={styles.calSecHead}>
            <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Galleri'}</p>
          </div>
          <Reveal className={`${styles.calGallery} ${styles.calGalleryWrap}`} as="div">
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </section>
      ) : null}

      {/* 8 — OM: brett bildband, texten ligger som overlay-platta i bilden */}
      <section className={styles.calAboutBand} style={{ backgroundImage: `url(${content.aboutImage})` }}>
        <div className={styles.calAboutScrim} aria-hidden="true" />
        <Reveal className={styles.calAboutPanel} as="div">
          <p className="sf-eyebrow">— Om {tenant.name}</p>
          <h2 className={styles.calAboutTitle}>{content.aboutTitle}</h2>
          <p className={styles.calAboutText}>{content.aboutCopyHome}</p>
          <ul className={styles.calAboutStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.calStatValue}>{n}</span>
                <span className={styles.calStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* 9 — PLATS: en rad med adress · tider · karta-länk (butikens fot, inte en split) */}
      <section className={styles.calLocRow}>
        <div className={styles.calLocInner}>
          <div>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta hit'}</p>
            <p className={styles.calLocAddr}>{location?.address ?? 'Adress visas snart.'}</p>
          </div>
          {location?.hours ? (
            <div className={styles.calLocHours}>
              {location.hours.map((h) => (
                <div key={h.day} className={styles.calLocHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}
          {location?.address ? (
            <a
              className={styles.calSecCta}
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Visa på karta
            </a>
          ) : null}
        </div>
      </section>

      {/* 10 — CLOSING: mörk plommonplatta (ingen parallax, inget foto) */}
      <section className={styles.calClosing}>
        <Reveal>
          <h2 className={styles.calClosingTitle}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={styles.calClosingLede}>
            {content.closingLede ?? 'Handla i butiken, boka en tjänst eller hör av dig — vi finns här.'}
          </p>
          <div className={styles.calClosingActions}>
            <BookCta className={styles.calHeroCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
