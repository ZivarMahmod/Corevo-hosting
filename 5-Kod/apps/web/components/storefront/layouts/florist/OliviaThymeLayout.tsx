import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './oliviathyme.module.css'

/**
 * OLIVIA & THYME — puderrosa + varm brun, KVARTERSBUTIK (goal-58 → goal-59 tema-paket).
 *
 * goal-59: mallen är inte längre "en hem-layout ovanpå plattformens skelett" utan ett
 * HELT PAKET — eget sidhuvud (oliviathyme.chrome.tsx), egen sidfot och egna undersidor
 * (oliviathyme.pages.tsx). Den här filen är hemmet, och den använder NOLL delade
 * .sf*-klasser: galleri-bandet, plats-bandet och closing-bandet — de tre sektioner som
 * gjorde alla mallar till samma sida i nedre halvan — är nu butikens egna
 * (.otGalleryBand / .otFind / .otClosing).
 *
 * Sektionsordningen (butikens skyltfönster, inte en mood board):
 *   butiksfasad fullbleed (ingen rubrik-overlay, bara namnskylten)
 *   → beige remsa med den riktiga rubriken + fyrkantig CTA
 *   → "Ur butiken" → TVÅ stora produktbilder, den första med stjärn-badge
 *   → tjänster som handskriven meny-lista
 *   → om + stat-trio → presentkort (smal rad) → blogg → galleri → hitta hit → closing.
 *
 * Modul-gatingen är oförändrad: shopReachable gatar HELA butiksbandet (varje bricka
 * länkar till /shop/:id), teasers-sektionerna renderas bara när teasers finns,
 * presentkort är en smal rad. Layouten är SYNKRON.
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

      {/* UR BUTIKEN — webshop-modulen invävd som butikens eget skyltfönster.
          Gatat på shopReachable OCH riktiga teasers: brickorna länkar till
          /shop/:id, så en oåtkomlig butik får aldrig rendera bandet (S9). */}
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

      {/* TJÄNSTER — handskriven meny-lista. Bara när det finns aktiva tjänster. */}
      {rows.length > 0 ? (
        <section className={styles.otServices}>
          <div className={styles.otNarrow}>
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

      {/* OM — foto i creme passepartout + berättelsen + stat-trion. */}
      <section className={styles.otAbout}>
        <div className={`${styles.otWide} ${styles.otAboutGrid}`}>
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

      {/* GALLERI — mallens EGET band (var det delade galleri-bandet). Brickorna tvingas
          in i butikens ratio (4:5) via .otGalleryBand. */}
      {content.galleryImages.length > 0 ? (
        <section className={styles.otGalleryBand}>
          <div className={styles.otWide}>
            <Reveal>
              <p className={styles.otEyebrow}>{content.galleryEyebrow ?? '— Från butiken'}</p>
            </Reveal>
            <Reveal>
              <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Bild från butiken' }))} />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* HITTA HIT — mallens EGET plats-band (var det delade plats-bandet + tim-tabellen):
          adressen som skylt-rubrik, öppettiderna som prickad butikslista. */}
      <section className={styles.otFind}>
        <div className={`${styles.otWide} ${styles.otFindGrid}`}>
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
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.otMoreLink}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            {location?.hours ? (
              <dl className={styles.otHoursBig}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.otHoursBigRow}>
                    <dt>{h.day}</dt>
                    <dd>{h.time}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.otBody}>Öppettider visas snart.</p>
            )}
          </Reveal>
        </div>
      </section>

      {/* CLOSING — mallens EGEN bruna platta (var det delade closing-bandet). */}
      <section className={styles.otClosing}>
        <Reveal>
          <h2 className={`${styles.otSectionTitle} ${styles.otClosingTitle}`}>
            {content.closingTitle ?? 'Redo för din nästa bukett?'}
          </h2>
          <p className={styles.otClosingLede}>
            {content.closingLede ?? 'Boka, beställ eller kom förbi butiken — vi hjälper dig gärna hitta rätt.'}
          </p>
          <div className={styles.otClosingActions}>
            <BookCta className={`${styles.otBtn} ${styles.otClosingCta}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
