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
        <Reveal className={styles.otWelcomeInner}>
          <span className={shared.sfPillEyebrow}>{content.heroEyebrow}</span>
          <h1 className={styles.otWelcomeTitle}>{content.heroTitle}</h1>
          <p className="sf-lede" style={{ marginTop: 14 }}>
            {content.heroLede}
          </p>
          <div className={styles.otWelcomeActions}>
            <BookCta />
            {offertReachable ? (
              <a href="/offert" className={styles.otSecondaryLink}>
                Blommor till bröllop eller fest? <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </Reveal>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd som butikens eget skyltfönster:
          intro + fyrkantig brun CTA, sedan två stora produktbilder (en med
          stjärn-badge). Hela bandet visas bara när det finns riktiga teasers. */}
      {showcase.length > 0 ? (
        <>
          <section className={styles.otShopIntro}>
            <Reveal className={styles.otShopIntroInner}>
              <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
              <h2 className="sf-h1" style={{ marginTop: 10 }}>
                {content.shopTitle ?? 'Butikens favoriter'}
              </h2>
              <p className={`sf-body ${styles.otShopIntroBody}`}>
                Från vardagsbuketter till stora högtidsarrangemang — det här är blommorna vi är mest stolta över just nu.
              </p>
              <div className={styles.otShopActions}>
                {shopReachable ? (
                  <Link href="/shop" className={styles.otSquareCta}>
                    {content.shopCta ?? 'Se hela sortimentet'}
                  </Link>
                ) : null}
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
                      <span className={styles.otShowcaseName}>{p.name}</span>
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
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                {content.servicesTitle}
              </h2>
            </Reveal>
            <div className={styles.otServiceList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={styles.otServiceRow} label={`Beställ — ${s.name}`}>
                    <span className={styles.otServiceNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.otServiceMain}>
                      <span className={styles.otServiceName}>{s.name}</span>
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
              <Reveal style={{ textAlign: 'center' }}>
                <a href="/tjanster" className={shared.sfMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* OM — foto i kraftpapper-ram + berättelsen + stat-trion. */}
      <section className={styles.otAbout}>
        <div className={`${shared.sfWide} ${styles.otAboutGrid}`}>
          <Reveal>
            <div className={styles.otAboutPhotoWrap}>
              <div className={styles.otAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {content.aboutTitle}
            </h2>
            <p className="sf-body" style={{ fontSize: 17, marginTop: 16 }}>
              {content.aboutCopyHome}
            </p>
            <ul className={shared.sfStatTrio}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={shared.sfStatValue}>{n}</span>
                  <span className={shared.sfStatLabel}>{l}</span>
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
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className="sf-italic" style={{ fontSize: 'clamp(17px, 1.8vw, 20px)', margin: 0, color: 'var(--color-primary)' }}>
              {content.giftLede ?? 'Ge bort en blomstrande stund, när som helst på året.'}
            </p>
            <a href="/presentkort" className={shared.sfMoreLink} style={{ marginTop: 0 }}>
              {content.giftCta ?? 'Till presentkorten'} <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </section>
      ) : null}

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste). */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.otBlog}>
          <Reveal className={styles.otBlogHead}>
            <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className="sf-h2" style={{ marginTop: 10 }}>
              {content.blogTitle ?? 'Tips, säsong & inspiration'}
            </h2>
          </Reveal>
          <div className={styles.otBlogGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.otBlogCard}>
                  <div
                    className={styles.otBlogImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.otBlogName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.otBlogMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.otBlogCtaWrap}>
            <Link href="/blogg" className={shared.sfMoreLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* GALLERI */}
      <section className={shared.sfGalleryBand}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Från butiken'}</p>
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
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>
                {location.address}
              </p>
            ) : (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>
                Adress visas snart.
              </p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={shared.sfHoursRow}>
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
                  className={shared.sfMapLink}
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
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto' }}>
            {content.closingTitle ?? 'Redo för din nästa bukett?'}
          </h2>
          <p className={shared.sfClosingLead}>
            {content.closingLede ?? 'Boka, beställ eller kom förbi butiken — vi hjälper dig gärna hitta rätt.'}
          </p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
