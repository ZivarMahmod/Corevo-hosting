import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — POETISK NATTBLÅ (florist-sviten, tema-paket goal-59).
 *
 * Hemmet äger nu HELA sin komposition — inga delade storefront-klasser alls.
 * Det var där sviten blev lika: alla mallar lånade samma sfServices/sfRow/sfLocBand/
 * sfGalleryBand-skelett i undre halvan. Lunaria bär i stället sina egna:
 *
 *   (1) HERO      — inset panorama (16:10) med en ÖVERLAPPANDE textplatta som skjuter
 *                   ut över bildens nedre vänstra kant (.lnHeroCard)
 *   (2) STÄMNINGSKORT — Säsong (info) / Prenumeration (→ /shop när shopReachable) /
 *                   Kurser (→ /kurser)
 *   (3) TJÄNSTER  — LUGN LISTA med STORA siffror: en tvåspaltig hårlinje-rad där
 *                   numret är en display-siffra i vetefärg och priset är en stor
 *                   display-siffra till höger. Varje rad är en <Bookable>.
 *   (4) UR BUTIKEN — OFFSET-GRID: tre kort i olika höjd (kort 2 sänks, kort 3 höjs)
 *   (5) OM        — cirkulärt porträtt + statistik i vertikal rad
 *   (6) GALLERI · (7) BLOGG (samma offset-grid) · (8) PRESENTKORT (smal rad)
 *   (9) PLATS     — egen två-spalt med streckade tid-rader
 *  (10) CLOSING   — helbild med nattblå gradient
 *
 * Modul-gatingen är oförändrad och HELIG: shopReachable gatar prenumerationskortet,
 * teasers-sektionerna ritas bara när teasers finns, presentkort = smal rad.
 * SYNKRON komponent (ingen async/await, ingen 'use client') — onboarding-studions
 * klienta preview renderar samma komponent.
 */

/** Tunn måne — sektionsdelaren. */
function MoonOrnament() {
  return (
    <div className={styles.lnOrnament} aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <path
          d="M17 3a14 14 0 1 0 0 28c-5-2.6-8.4-8-8.4-14S12 5.6 17 3Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </div>
  )
}

export function LunariaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // modules === undefined (studions statiska preview) → visa allt.
  const shopReachable = modules ? modules.shopReachable : true

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''

  return (
    <div className={styles.lnRoot}>
      {/* HERO — inset foto + offset textplatta som bryter dess nedre kant */}
      <section className={styles.lnHero}>
        <div className={styles.lnHeroFrame}>
          <Reveal className={styles.lnHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }}>
            <span />
          </Reveal>
          <Reveal delay={140} className={styles.lnHeroCard}>
            <span className={styles.lnHeroEyebrow}>{content.heroEyebrow}</span>
            <h1 className={styles.lnHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.lnHeroLede}>{content.heroLede}</p>
            <div className={styles.lnHeroActions}>
              <BookCta className={styles.lnCta} />
            </div>
          </Reveal>
        </div>
      </section>

      <MoonOrnament />

      {/* STÄMNINGSKORT — Säsong (info) / Prenumeration (→ /shop) / Kurser (→ /kurser) */}
      <section className={styles.lnMoodSection}>
        <div className={styles.lnMoodGrid}>
          <Reveal>
            <div className={styles.lnMoodCard}>
              <div
                className={styles.lnMoodImg}
                style={{ backgroundImage: `url(${content.galleryImages[0] ?? heroPhoto})` }}
              />
              <div className={styles.lnMoodBody}>
                <h3 className={styles.lnMoodTitle}>{content.pillar1Title ?? 'Säsongens blommor'}</h3>
                <p className={styles.lnMoodText}>
                  {content.pillar1Body ??
                    'Vi följer årstiderna — från vårens första lökar till vinterns torkade grenar. Fråga oss vad som är vackrast just nu.'}
                </p>
              </div>
            </div>
          </Reveal>

          {shopReachable ? (
            <Reveal delay={100}>
              <Link href="/shop" className={styles.lnMoodCard}>
                <div
                  className={styles.lnMoodImg}
                  style={{ backgroundImage: `url(${content.galleryImages[1] ?? heroPhoto})` }}
                />
                <div className={styles.lnMoodBody}>
                  <h3 className={styles.lnMoodTitle}>{content.pillar2Title ?? 'Blomprenumeration'}</h3>
                  <p className={styles.lnMoodText}>
                    {content.pillar2Body ??
                      'Nya, säsongsbundna kompositioner — levererade eller redo att hämta varje vecka, varannan vecka eller en gång i månaden.'}
                  </p>
                  <span className={styles.lnMoodLink}>{content.pillar2Link ?? 'Bli prenumerant'}</span>
                </div>
              </Link>
            </Reveal>
          ) : (
            <Reveal delay={100}>
              <div className={styles.lnMoodCard}>
                <div
                  className={styles.lnMoodImg}
                  style={{ backgroundImage: `url(${content.galleryImages[1] ?? heroPhoto})` }}
                />
                <div className={styles.lnMoodBody}>
                  <h3 className={styles.lnMoodTitle}>{content.pillar2Title ?? 'Blomprenumeration'}</h3>
                  <p className={styles.lnMoodText}>
                    {content.pillar2Body ??
                      'Nya, säsongsbundna kompositioner — levererade eller redo att hämta varje vecka, varannan vecka eller en gång i månaden.'}
                  </p>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal delay={200}>
            <Link href="/kurser" className={styles.lnMoodCard}>
              <div
                className={styles.lnMoodImg}
                style={{ backgroundImage: `url(${content.galleryImages[2] ?? heroPhoto})` }}
              />
              <div className={styles.lnMoodBody}>
                <h3 className={styles.lnMoodTitle}>{content.pillar3Title ?? 'Kurser & kvällar'}</h3>
                <p className={styles.lnMoodText}>
                  {content.pillar3Body ??
                    'Lär dig binda din egen komposition tillsammans med oss — en stilla kväll med blommor, bubbel och nya bekantskaper.'}
                </p>
                <span className={styles.lnMoodLink}>{content.pillar3Link ?? 'Se kurser'}</span>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* TJÄNSTER — LUGN LISTA med stora siffror (mallens egen, inga delade sfRow) */}
      {rows.length > 0 ? (
        <section className={styles.lnPriceSection}>
          <div className={styles.lnNarrow}>
            <Reveal className={styles.lnSecHead}>
              <p className={styles.lnEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.lnSecTitle}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={styles.lnPriceList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.lnPriceRow} label={`Beställ — ${s.name}`}>
                    <span className={styles.lnPriceNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.lnPriceMain}>
                      <span className={styles.lnPriceName}>{s.name}</span>
                      <span className={styles.lnPriceDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.lnPriceValue}>{formatPrice(s)}</span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal>
                <Link href="/tjanster" className={styles.lnBandCta}>
                  Se allt vi gör
                </Link>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* UR BUTIKEN — offset-grid: tre kort i olika höjd */}
      {shopTeasers.length > 0 ? (
        <section className={styles.lnCardSection}>
          <Reveal className={styles.lnSecHead}>
            <p className={styles.lnEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.lnSecTitle}>{content.shopTitle ?? 'Nytt i butiken'}</h2>
          </Reveal>
          <div className={styles.lnOffsetGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90} className={styles.lnOffsetCell}>
                <Link href={`/shop/${p.id}`} className={styles.lnCard}>
                  <div
                    className={styles.lnCardImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <div className={styles.lnCardBody}>
                    <h3 className={styles.lnCardName}>{p.name}</h3>
                    <p className={styles.lnCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.lnSecHead}>
            <Link href="/shop" className={styles.lnBandCta}>
              {content.shopCta ?? 'Till butiken'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* OM — cirkulärt porträtt + berättelsen */}
      <section className={styles.lnAboutBand}>
        <div className={styles.lnAboutGrid}>
          <Reveal className={styles.lnAboutMedia}>
            <div className={styles.lnPortrait} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.lnEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.lnSecTitle}>{content.aboutTitle}</h2>
            <p className={styles.lnBody}>{content.aboutCopyHome}</p>
            <ul className={styles.lnStats}>
              {content.stats.map(([n, l]) => (
                <li key={l} className={styles.lnStat}>
                  <span className={styles.lnStatValue}>{n}</span>
                  <span className={styles.lnStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* GALLERI — masonry + lightbox */}
      <section className={styles.lnGalleryBand}>
        <div className={styles.lnWide}>
          <Reveal className={styles.lnGalleryHead}>
            <p className={styles.lnEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      <MoonOrnament />

      {/* FRÅN BLOGGEN — samma offset-grid */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.lnCardSection}>
          <Reveal className={styles.lnSecHead}>
            <p className={styles.lnEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.lnSecTitle}>{content.blogTitle ?? 'Tankar & säsong'}</h2>
          </Reveal>
          <div className={styles.lnOffsetGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90} className={styles.lnOffsetCell}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.lnCard}>
                  <div
                    className={styles.lnCardImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <div className={styles.lnCardBody}>
                    <h3 className={styles.lnCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.lnCardMeta}>{p.excerpt}</p> : null}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.lnSecHead}>
            <Link href="/blogg" className={styles.lnBandCta}>
              {content.blogCta ?? 'Läs hela bloggen'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — en smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <section className={styles.lnGiftRow}>
          <Reveal className={styles.lnGiftInner}>
            <p className={styles.lnEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.lnGiftLede}>{content.giftLede ?? 'Ge bort en stilla, blommande stund.'}</p>
            <Link href="/presentkort" className={styles.lnBandCta} style={{ margin: 0 }}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PLATS & ÖPPETTIDER — mallens egen två-spalt */}
      <section className={styles.lnLocBand}>
        <div className={styles.lnLocGrid}>
          <Reveal>
            <p className={styles.lnEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.lnSecTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.lnBody}>{location.address}</p>
            ) : (
              <p className={styles.lnBody}>Adress visas snart.</p>
            )}
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.lnBandCta}
                style={{ margin: '32px 0 0' }}
              >
                Visa på karta
              </a>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            {location?.hours ? (
              <div className={styles.lnHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.lnHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.lnBody}>Öppettider visas snart.</p>
            )}
          </Reveal>
        </div>
      </section>

      {/* CLOSING — helbild med mörk gradient, ljus text ovanpå */}
      <section className={styles.lnClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
        <div className={styles.lnClosingOverlay} />
        <Reveal className={styles.lnClosingInner}>
          <h2 className={styles.lnClosingTitle}>{content.closingTitle ?? 'Blommor för din stilla stund?'}</h2>
          <p className={styles.lnClosingLede}>
            {content.closingLede ?? 'Beställ, boka en kurs eller hör av dig — vi finns här för dig.'}
          </p>
          <div className={styles.lnClosingActions}>
            <BookCta className={`${styles.lnCta} ${styles.lnClosingCta}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
