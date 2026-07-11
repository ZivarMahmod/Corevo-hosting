import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './sage.module.css'

/**
 * SAGE — GALLERI-STUDIO i greige (florist-sviten, goal-58 → tema-paket goal-59).
 *
 * Mallen äger nu HELA sajten: sitt sidhuvud (sage.chrome.tsx: centrerat wordmark,
 * transparent över heron), sin sidfot (galleri-plakett, en centrerad kolumn av
 * hårlinjer) och sina undersidor (sage.pages.tsx: museal /om, tabell-/tjanster,
 * luftig /kontakt). Hemmet nedan använder NOLL delade .sf*-sektioner — det var
 * där alla 13 syskon föll ner i samma skelett.
 *
 * HEMMETS EGNA SEKTIONER (i ordning):
 *   1 HERO        full-bleed foto, spärrade versaler centrerat, två pill-knappar
 *   2 VÄLKOMST    centrerad rad på vit platta mellan två hårlinjer
 *   3 KATEGORI    trio i INRAMADE rutor (passepartout: 12px vit ram runt 4/5-fotot)
 *   4 BUTIK       3-kolumns GALLERI-GRID: tunn ram, ingen skugga, ingen radie
 *   5 PRISER      stram TABELL med hårlinjer (ej kort, ej pris-pillar) — klickbar rad
 *   6 CITAT       band i accentSoft
 *   7 OM          foto + text + hårlinje-fakta
 *   8 GALLERI     samma tunna ram-grid som butiken, EN bildratio (4/5)
 *   9 BLOGG       galleri-grid igen (mallens enda kort-form)
 *  10 PRESENTKORT smal rad, aldrig en hel sektion
 *  11 PLATS       adress + öppettider som hårlinje-tabell
 *  12 CLOSING     mörk primär-platta, versal-rubrik, en knapp
 *
 * Modul-gatingen är oförändrad: shopReachable gatar kategori-trion + hero-knappen,
 * teasers-sektionerna renderas bara när teasers finns, presentkortsraden bara när
 * modulen är live. Layouten är SYNKRON (studions klient-preview renderar samma
 * komponent) och THEME_OWNS_MODULES gäller: page.tsx förladdar teasers som prop.
 */
export function SageLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  const shopReachable = modules ? modules.shopReachable : true

  const heroFallback = content.heroImages[0] ?? ''
  const cat1 = content.galleryImages[0] ?? heroFallback
  const cat2 = content.galleryImages[1] ?? heroFallback
  const cat3 = content.galleryImages[2] ?? heroFallback

  return (
    <>
      {/* 1 — HERO. `.hero`-sentinelen läses av NavShell → transparent nav ovanpå. */}
      <section className={`hero ${styles.sgHero}`} aria-label="Välkommen">
        <div className={styles.sgHeroBg} style={{ backgroundImage: `url(${content.heroImages[0]})` }} />
        <div className={styles.sgHeroOverlay} />
        <div className={styles.sgHeroInner}>
          <p className={styles.sgHeroEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.sgHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.sgHeroLede}>{content.heroLede}</p>
          <div className={styles.sgHeroActions}>
            <BookCta className={styles.sgPillCta} />
            {shopReachable ? (
              <Link href="/shop" className={styles.sgHeroBtnOutline}>
                Till butiken
              </Link>
            ) : (
              <Link href="/om" className={styles.sgHeroBtnOutline}>
                Om oss
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2 — VÄLKOMST */}
      <section className={styles.sgWelcome}>
        <Reveal className={styles.sgWelcomeInner}>
          <h2 className={styles.sgSectionTitle}>Välkommen till {tenant.name}</h2>
          <p className={styles.sgLede}>{content.aboutCopy}</p>
          <Link href="/om" className={`btn-accent ${styles.sgPillCta} ${styles.sgWelcomeCta}`}>
            Läs mer om oss
          </Link>
        </Reveal>
      </section>

      {/* 3 — KATEGORI-TRIO (passepartout-ramar) */}
      {shopReachable ? (
        <section className={styles.sgSectionTight}>
          <div className={styles.sgCategoryGrid}>
            <Reveal>
              <Link href="/shop" className={styles.sgCategoryCard}>
                <div className={styles.sgCategoryFrame}>
                  <div className={styles.sgCategoryImg} style={{ backgroundImage: `url(${cat1})` }} />
                </div>
                <span className={styles.sgCategoryLabel}>Mest sålda</span>
              </Link>
            </Reveal>
            <Reveal delay={100}>
              <Link href="/shop" className={styles.sgCategoryCard}>
                <div className={styles.sgCategoryFrame}>
                  <div className={styles.sgCategoryImg} style={{ backgroundImage: `url(${cat2})` }} />
                </div>
                <span className={styles.sgCategoryLabel}>Födelsedag</span>
              </Link>
            </Reveal>
            <Reveal delay={200}>
              <Link href="/shop" className={styles.sgCategoryCard}>
                <div className={styles.sgCategoryFrame}>
                  <div className={styles.sgCategoryImg} style={{ backgroundImage: `url(${cat3})` }} />
                </div>
                <span className={styles.sgCategoryLabel}>Bröllop</span>
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* 4 — UR BUTIKEN (galleri-grid) */}
      {shopTeasers.length > 0 ? (
        <section className={styles.sgSection}>
          <Reveal className={styles.sgSectionHead}>
            <p className={styles.sgEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.sgSectionTitle}>{content.shopTitle ?? 'Nyheter från butiken'}</h2>
          </Reveal>
          <div className={styles.sgCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.sgCard}>
                  <div className={styles.sgCardImg} style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined} />
                  <div className={styles.sgCardBody}>
                    <h3 className={styles.sgCardName}>{p.name}</h3>
                    <span className={styles.sgCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.sgCenter}>
            <Link href="/shop" className={styles.sgBandCta}>
              {content.shopCta ?? 'Till hela butiken'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 5 — PRISER som stram tabell (mallens EGNA rader, inga delade .sfRow) */}
      {rows.length > 0 ? (
        <section className={styles.sgSection}>
          <Reveal className={styles.sgSectionHead}>
            <p className={styles.sgEyebrow}>{content.servicesEyebrow}</p>
            <h2 className={styles.sgSectionTitle}>{content.servicesTitle}</h2>
          </Reveal>
          <div className={styles.sgTable}>
            <div className={styles.sgTableHead} aria-hidden="true">
              <span>Tjänst</span>
              <span>Tid</span>
              <span>Pris</span>
            </div>
            {rows.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Bookable className={styles.sgTableRow} label={`Beställ — ${s.name}`}>
                  <span className={styles.sgTableMain}>
                    <span className={styles.sgTableName}>{s.name}</span>
                    <span className={styles.sgTableDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.sgTableTime}>{formatDuration(s)}</span>
                  <span className={styles.sgTablePrice}>{formatPrice(s)}</span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          {hasMore ? (
            <Reveal className={styles.sgCenter}>
              <Link href="/tjanster" className={styles.sgBandCta}>
                Se allt vi gör
              </Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 6 — CITAT */}
      <section className={styles.sgQuoteBand}>
        <Reveal>
          <p className={styles.sgQuote}>&rdquo;{content.italic}&rdquo;</p>
        </Reveal>
      </section>

      {/* 7 — OM (foto + text + hårlinje-fakta) */}
      <section className={styles.sgAboutGrid}>
        <Reveal>
          <div className={styles.sgAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sgEyebrow}>— Om {tenant.name}</p>
          <h2 className={styles.sgSectionTitle}>{content.aboutTitle}</h2>
          <p className={styles.sgLede}>{content.aboutCopyHome}</p>
          <ul className={styles.sgFacts}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.sgFactValue}>{n}</span>
                <span className={styles.sgFactLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* 8 — GALLERI (samma tunna ram-grid, EN ratio 4/5) */}
      <section className={styles.sgGalleryBand}>
        <Reveal className={styles.sgSectionHead}>
          <p className={styles.sgEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
        </Reveal>
        <Reveal className={styles.sgGallery}>
          <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
        </Reveal>
      </section>

      {/* 9 — FRÅN BLOGGEN */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.sgSection}>
          <Reveal className={styles.sgSectionHead}>
            <p className={styles.sgEyebrow}>{content.blogEyebrow ?? '— Inspiration'}</p>
            <h2 className={styles.sgSectionTitle}>{content.blogTitle ?? 'Från bloggen'}</h2>
          </Reveal>
          <div className={styles.sgCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.sgCard}>
                  <div className={styles.sgCardImg} style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined} />
                  <div className={styles.sgCardBody}>
                    <h3 className={styles.sgCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.sgCardMeta}>{p.excerpt}</p> : null}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.sgCenter}>
            <Link href="/blogg" className={styles.sgBandCta}>
              {content.blogCta ?? 'Läs fler inlägg'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 10 — PRESENTKORT (smal rad) */}
      {presentkortLive ? (
        <section className={styles.sgGiftRow}>
          <Reveal className={styles.sgGiftInner}>
            <p className={styles.sgEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.sgGiftLede}>{content.giftLede ?? 'Ge bort blommor, när som helst.'}</p>
            <Link href="/presentkort" className={styles.sgBandCta} style={{ margin: 0 }}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 11 — PLATS & ÖPPETTIDER (mallens egen hårlinje-tabell) */}
      <section className={styles.sgLocBand}>
        <Reveal className={styles.sgLocInner}>
          <p className={styles.sgEyebrow}>{content.findEyebrow ?? '— Hitta hit'}</p>
          <h2 className={styles.sgSectionTitle}>
            {location?.address ? location.address.split(',')[0] : tenant.name}
          </h2>
          {location?.address ? (
            <p className={styles.sgLede}>{location.address}</p>
          ) : (
            <p className={styles.sgLede}>Adress visas snart.</p>
          )}
          {location?.hours ? (
            <div className={styles.sgColHours}>
              {location.hours.map((h) => (
                <div key={h.day} className={styles.sgColHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}
          {location?.address ? (
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.sgBandCta}
            >
              Visa på karta
            </a>
          ) : null}
        </Reveal>
      </section>

      {/* 12 — CLOSING */}
      <section className={styles.sgClosing}>
        <Reveal>
          <h2 className={styles.sgClosingTitle}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={styles.sgClosingLede}>
            {content.closingLede ??
              'Handla i butiken, boka en kurs eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.sgClosingActions}>
            <BookCta className={styles.sgPillCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
