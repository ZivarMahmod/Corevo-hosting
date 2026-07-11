import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './calytrix.module.css'

/**
 * CALYTRIX — plommon/vinröd e-handelsflorist (florist-sviten, goal-58). E-handel
 * FÖRST: butiken är hjälten, inte hantverket. EGEN sektionsordning (ingen annan
 * mall i sviten har den): (1) smal vinröd annonsrad, (2) fullbredds foto-hero med
 * jättestor centrerad serif-rubrik + liten guld-CTA, (3) mörkt band med en rad
 * marknadsföringscopy, (4) "Mest sålda" — horisontell scroll-rad med flytande
 * "Populär"-pill, (5) tjänster/priser, (6) om, (7) blogg, (8) galleri, (9) plats,
 * (10) closing. Webshop/blogg/presentkort vävs in via `modules`-propen (S10) —
 * samma modulkontrakt som övriga florist-mallar.
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
      {/* 1 — ANNONSRAD: smal vinröd rad högst upp */}
      <div className={styles.calAnnounce}>
        {shopReachable ? (
          <Link href="/shop" className={styles.calAnnounceText}>
            {content.utility}
          </Link>
        ) : (
          <span className={styles.calAnnounceText}>{content.utility}</span>
        )}
      </div>

      {/* 2 — FULLBREDDS FOTO-HERO: jättestor centrerad serif-rubrik + guld-CTA */}
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

      {/* 3 — MÖRKT MARKNADSFÖRINGS-BAND */}
      <section className={styles.calBand}>
        <p className={styles.calBandText}>{content.tagline}</p>
      </section>

      {/* 4 — MEST SÅLDA: webshop-modulen invävd som horisontell scroll-rad med
          flytande "Populär"-pill. Bara ett smakprov; hela sortimentet på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.shopEyebrow ?? '— Mest sålda'}</p>
              <h2 className="sf-h2" style={{ marginTop: 12 }}>
                {content.shopTitle ?? 'Beställ det alla vill ha'}
              </h2>
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

      {/* 5 — TJÄNSTER & PRISER — numrerade rader, bara när det finns aktiva tjänster. */}
      {rows.length > 0 ? (
        <section className={shared.sfServices}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                {content.servicesTitle}
              </h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Boka — ${s.name}`}>
                    <span className={shared.sfRowNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={shared.sfRowMain}>
                      <span className={shared.sfRowName}>{s.name}</span>
                      <span className={shared.sfRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={shared.sfRowMeta}>
                      <span className={shared.sfRowPrice}>{formatPrice(s)}</span>
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

      {/* 6 — OM */}
      <section className={styles.calSection}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div className={shared.sfAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {content.aboutTitle}
            </h2>
            <p className="sf-body" style={{ marginTop: 20 }}>
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

      {/* 7 — FRÅN BLOGGEN — blogg-modulen invävd (samma kort-formspråk som butiken). */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className="sf-h2" style={{ marginTop: 12 }}>
                {content.blogTitle ?? 'Nytt från floristen'}
              </h2>
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

      {/* PRESENTKORT — smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <div className={styles.calGiftRow}>
          <Reveal className={styles.calGiftInner} as="div">
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className="sf-body" style={{ margin: 0 }}>
              {content.giftLede ?? 'Ge bort något som blommar.'}
            </p>
            <Link href="/presentkort" className={styles.calGiftCta}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 8 — GALLERI. Wrappern (.calGallery) drar in galleriet i mallens ENDA
          bildratio (4:5) och raka hörn — Gallery.tsx stylas av den delade
          storefront.module.css (1:1 + hover-scale) som mallen inte äger. */}
      <section className={shared.sfGalleryBand}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal className={styles.calGallery} as="div">
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* 9 — PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className="sf-body" style={{ marginTop: 20 }}>
                {location.address}
              </p>
            ) : (
              <p className="sf-body" style={{ marginTop: 20 }}>
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

      {/* 10 — CLOSING */}
      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto' }}>
            {content.closingTitle ?? 'Redo att beställa?'}
          </h2>
          <p className={shared.sfClosingLead}>
            {content.closingLede ?? 'Handla i butiken, boka en tjänst eller hör av dig — vi finns här.'}
          </p>
          <div style={{ marginTop: 32 }}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
