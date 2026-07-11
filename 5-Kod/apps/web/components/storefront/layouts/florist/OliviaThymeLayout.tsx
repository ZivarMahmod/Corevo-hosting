import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './oliviathyme.module.css'

/**
 * OLIVIA & THYME — puderrosa + varm brun, butiks-charm (goal-58, florist-sviten).
 * EGET formspråk: en fullbredds butiksfasad-hero utan rubrik-overlay (bara ett
 * hängande namnskylt-"wordmark"), en beige välkomst-remsa som bär den riktiga
 * rubriken, en "Ur butiken"-remsa som mynnar ut i två stora produktbilder där
 * den ena bär en stjärn-badge ("Bäst säljare") — sedan tjänster, om, presentkort,
 * blogg, galleri, plats och closing. Kvarterbutikens skyltfönster, inte en mood
 * board. Webshop/blogg/presentkort vävs in via `modules`-propen (S10) precis som
 * övriga mallar i sviten.
 *
 * SKÄRPE-PASS: typografin går genom mallens EGNA roller (.otDisplay/.otSectionTitle/
 * .otCardTitle/.otBody/.otEyebrow) i stället för de globala .sf-*-rollerna. Skälet är
 * mätbart: .sf-h1 är 56px — större än mallens egen hero-rubrik var — och .sf-h2 34px,
 * vilket gav en platt skala (56/54/44/34/22/17/16) där allt vägde lika.
 * Rollerna i oliviathyme.module.css ger FEM nivåer — 96 → 48 → 28 → 18 → 12
 * (×2.00 / ×1.71 / ×1.56 / ×1.50) — och all spacing ur EN skala (12/20/24/32/48/96),
 * så rytmen är identisk i varje sektion. Inga inline font-size/margin kvar — allt bor
 * i CSS:en och går att mäta där.
 */
export function OliviaThymeLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  // Signaturen: två stora produktbilder, den första bär stjärn-badgen.
  const showcase = shopTeasers.slice(0, 2)

  return (
    <div className={styles.otRoot}>
      {/* HERO — fullbredds butiksfasad. Bilden är sidans ansikte; ingen rubrik
          ligger ovanpå den, bara ett hängande namnskylt-"wordmark". */}
      <section className={styles.otHero}>
        <div className={styles.otHeroImg} style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }} />
        <Reveal className={styles.otPlaque}>
          <p className={styles.otWordmark}>{tenant.name}</p>
        </Reveal>
      </section>

      {/* BEIGE REMSA — den riktiga rubriken, ledet och CTA:n. */}
      <section className={styles.otWelcome}>
        <Reveal className={`${styles.otWelcomeInner} ${styles.otCenter}`}>
          <span className={styles.otEyebrow}>{content.heroEyebrow}</span>
          <h1 className={`${styles.otDisplay} ${styles.otWelcomeTitle}`}>{content.heroTitle}</h1>
          <p className={styles.otBody}>{content.heroLede}</p>
          <div className={styles.otWelcomeActions}>
            <BookCta className={styles.otBtn} />
            {offertReachable ? (
              <a href="/offert" className={`${styles.otMoreLink} ${styles.otFlush}`}>
                Blommor till bröllop eller fest? <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </Reveal>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd som butikens eget skyltfönster:
          intro + fyrkantig brun CTA, sedan två stora produktbilder (en med
          stjärn-badge). Hela bandet är gatat på shopReachable OCH på riktiga
          teasers: produktbrickorna länkar till /shop/:id, så en oåtkomlig butik
          får inte rendera bandet alls — annars är varje bricka en 404-fälla (S9).
          Teasers laddas visserligen bara när shop är live, men gatingen ska vara
          explicit på VARJE /shop-länk, inte underförstådd via datat. */}
      {shopReachable && showcase.length > 0 ? (
        <>
          <section className={styles.otShopIntro}>
            <Reveal className={`${styles.otShopIntroInner} ${styles.otCenter}`}>
              <p className={styles.otEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
              <h2 className={styles.otSectionTitle}>{content.shopTitle ?? 'Butikens favoriter'}</h2>
              <p className={styles.otBody}>
                Från vardagsbuketter till stora högtidsarrangemang — det här är blommorna vi är mest stolta över just nu.
              </p>
              <div className={styles.otShopActions}>
                <Link href="/shop" className={styles.otBtn}>
                  {content.shopCta ?? 'Se hela sortimentet'}
                </Link>
              </div>
            </Reveal>
          </section>

          <section className={styles.otShowcase}>
            <div className={styles.otShowcaseGrid}>
              {showcase.map((p, i) => (
                <Reveal key={p.id} delay={i * 110}>
                  <Link href={`/shop/${p.id}`} className={styles.otShowcaseCard}>
                    {i === 0 ? (
                      <span className={styles.otShowcaseBadge}>
                        <span aria-hidden="true">★</span> Bäst säljare
                      </span>
                    ) : null}
                    <div
                      className={styles.otShowcaseImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <div className={styles.otShowcaseInfo}>
                      <span className={styles.otCardTitle}>{p.name}</span>
                      <span className={styles.otShowcasePrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {/* TJÄNSTER — bara när det finns aktiva tjänster (goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={styles.otServices}>
          <div className={shared.sfNarrow}>
            <Reveal className={styles.otCenter}>
              <p className={styles.otEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.otSectionTitle}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={styles.otServiceList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.otServiceRow} label={`Beställ — ${s.name}`}>
                    <span className={styles.otServiceNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.otServiceMain}>
                      <span className={styles.otCardTitle}>{s.name}</span>
                      <span className={styles.otServiceDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.otServiceMeta}>
                      <span className={styles.otServicePrice}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal className={styles.otCenter}>
                <a href="/tjanster" className={styles.otMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* OM — foto i rak vit ram + berättelsen + stat-trion. */}
      <section className={styles.otAbout}>
        <div className={`${shared.sfWide} ${styles.otAboutGrid}`}>
          <Reveal>
            <div className={styles.otAboutPhotoWrap}>
              <div className={styles.otAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.otEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.otSectionTitle}>{content.aboutTitle}</h2>
            <p className={styles.otBody}>{content.aboutCopyHome}</p>
            <ul className={styles.otStats}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.otStatValue}>{n}</span>
                  <span className={styles.otStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* PRESENTKORT — en smal rad, aldrig en hel sektion. */}
      {presentkortLive ? (
        <section className={styles.otGiftBand}>
          <Reveal className={styles.otGiftInner}>
            <p className={styles.otEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.otGiftLede}>
              {content.giftLede ?? 'Ge bort en blomstrande stund, när som helst på året.'}
            </p>
            <a href="/presentkort" className={`${styles.otMoreLink} ${styles.otFlush}`}>
              {content.giftCta ?? 'Till presentkorten'} <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </section>
      ) : null}

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste). */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.otBlog}>
          <Reveal className={`${styles.otBlogHead} ${styles.otCenter}`}>
            <p className={styles.otEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.otSectionTitle}>{content.blogTitle ?? 'Tips, säsong & inspiration'}</h2>
          </Reveal>
          <div className={styles.otBlogGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.otBlogCard}>
                  <div
                    className={styles.otBlogImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={`${styles.otCardTitle} ${styles.otBlogName}`}>{p.title}</h3>
                  {p.excerpt ? <p className={`${styles.otBody} ${styles.otBlogMeta}`}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.otBlogCtaWrap}>
            <Link href="/blogg" className={`${styles.otMoreLink} ${styles.otFlush}`}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* GALLERI — brickorna tvingas in i mallens ratio (4:5) via .otGallery. */}
      <section className={`${shared.sfGalleryBand} ${styles.otGallery}`}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className={styles.otEyebrow}>{content.galleryEyebrow ?? '— Från butiken'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Bild från butiken' }))} />
          </Reveal>
        </div>
      </section>

      {/* PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className={styles.otEyebrow}>{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className={styles.otSectionTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.otBody}>{location.address}</p>
            ) : (
              <p className={styles.otBody}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={`${shared.sfHoursRow} ${styles.otHoursRow}`}>
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
                  className={`${styles.otMoreLink} ${styles.otFlush}`}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={shared.sfMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className={`${styles.otSectionTitle} ${styles.otClosingTitle}`}>
            {content.closingTitle ?? 'Redo för din nästa bukett?'}
          </h2>
          <p className={styles.otClosingLede}>
            {content.closingLede ?? 'Boka, beställ eller kom förbi butiken — vi hjälper dig gärna hitta rätt.'}
          </p>
          {/* Inte shared.sfClosingCta: den inverterar knappen med hårdkodat #fff
              (background:#fff, specificitet 0,3,0) och smugglade in en tionde hex
              utifrån. .otClosingCta gör samma invertering i mallens egen creme. */}
          <div className={styles.otClosingActions}>
            <BookCta className={`${styles.otBtn} ${styles.otClosingCta}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
