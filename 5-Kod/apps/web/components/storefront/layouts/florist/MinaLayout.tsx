import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './mina.module.css'

/**
 * MINA — klarrosa & vitt, minimal och ung florist-e-handel (florist-sviten,
 * goal-58). EGEN sektionsordning (ingen annan mall i sviten har den):
 *   1. HERO — ingen bild. En klarrosa färgplatta bär enorm sans-typografi;
 *      texten är hjälten, bilden kommer först i nästa sektion.
 *   2. BILD-BANNER — fullbredd foto direkt under heron, andrummet efter
 *      typografin. Ingen text ovanpå.
 *   3. SHOP-TEASERS — ett tätt fyr-kolumners grid, de minsta korten i hela
 *      sviten (kvadratiska bilder, versal mikro-typografi).
 *   4. TJÄNSTER — täta, ONUMRERADE rader (versalt namn + hårfin linje) —
 *      ingen serif-numrerad radlista som resten av sviten.
 *   5. OM — en smal, centrerad textspalt utan sidobild (alla andra mallar i
 *      sviten kör två-kolumners om+foto; Mina håller det rent typografiskt).
 *   6. PRESENTKORT — en smal rad, aldrig en egen sektion.
 *   7. BLOGG — samma täta grid-språk som butiken (portrait-bilder).
 *   8. PLATS & ÖPPETTIDER.
 *   9. CLOSING — en klarrosa färgplatta som speglar heron (bookend).
 * Sans-only typografi (Jost display + Inter body) — enda mallen i sviten utan
 * serif-rubriker. Webshop/blogg/presentkort vävs in via `modules`-propen
 * (S10) — samma modulkontrakt som övriga florist-mallar.
 */
export function MinaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // MINA ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // egna, täta grid-språk istället för den generiska sektions-stapeln —
  // page.tsx hoppar över StorefrontModuleSections för mina och förladdar
  // teasers (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir
  // SYNKRON (onboarding-studions klient-preview renderar samma komponent).
  // Modulernas EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort).
  // Ingen fristående /shop- eller /offert-länk finns utanför teaser-
  // sektionerna nedan (de gatas redan av att teasers bara finns när modulen
  // faktiskt är nåbar) — därför behövs shopReachable/offertReachable inte här.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  const bannerImg = content.heroImages[0] ?? ''

  return (
    <>
      {/* 1 — HERO: ingen bild, klarrosa färgplatta bär den stora typografin */}
      <section className={styles.miHero}>
        <div className={styles.miHeroInner}>
          <Reveal>
            {content.heroEyebrow ? <span className={styles.miHeroEyebrow}>{content.heroEyebrow}</span> : null}
            <h1 className={styles.miHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.miHeroLede}>{content.heroLede}</p>
            <div className={styles.miHeroActions}>
              <BookCta className={styles.miHeroCta} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2 — BILD-BANNER: fullbredd, andrummet efter typografin */}
      <Reveal className={styles.miBanner} style={{ backgroundImage: `url(${bannerImg})` }}>
        <span />
      </Reveal>

      {/* 3 — UR BUTIKEN: webshop-modulen invävd i ett tätt fyr-kolumners grid.
          Bara ett smakprov — hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.miShopSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.miSecHead}>
              <div>
                <p className="sf-eyebrow">{content.shopEyebrow ?? '— Handla nu'}</p>
                <h2 className="sf-h2" style={{ marginTop: 6 }}>
                  {content.shopTitle ?? 'Beställ något fint'}
                </h2>
              </div>
              <Link href="/shop" className={shared.sfMoreLink}>
                {content.shopCta ?? 'Visa hela sortimentet'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
            <div className={styles.miShopGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <Link href={`/shop/${p.id}`} className={styles.miCard}>
                    <div
                      className={styles.miCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <h3 className={styles.miCardName}>{p.name}</h3>
                    <p className={styles.miCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 4 — TJÄNSTER: täta, onumrerade rader. Hela sektionen visas bara när
          det finns aktiva tjänster (ingen tom-text på hemmet). */}
      {rows.length > 0 ? (
        <section className={styles.miServices}>
          <div className={shared.sfNarrow}>
            <Reveal className={styles.miSvcHead}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 10 }}>
                {content.servicesTitle}
              </h2>
            </Reveal>
            <div className={styles.miSvcList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 55}>
                  <Bookable className={styles.miSvcRow} label={`Boka — ${s.name}`}>
                    <span className={styles.miSvcMain}>
                      <span className={styles.miSvcName}>{s.name}</span>
                      <span className={styles.miSvcDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.miSvcPrice}>{formatPrice(s)}</span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <a href="/tjanster" className={shared.sfMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 5 — OM: smal centrerad spalt, ingen sidobild */}
      <section className={styles.miAbout}>
        <div className={styles.miAboutInner}>
          <Reveal>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h1" style={{ marginTop: 10 }}>
              {content.aboutTitle}
            </h2>
            <p className={`sf-body ${styles.miAboutCopy}`}>{content.aboutCopyHome}</p>
            <ul className={styles.miStatRow}>
              {content.stats.map(([n, l]) => (
                <li key={l} className={styles.miStatItem}>
                  <span className={styles.miStatValue}>{n}</span>
                  <span className={styles.miStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 6 — PRESENTKORT: en smal rad, aldrig en egen sektion */}
      {presentkortLive ? (
        <div className={styles.miGift}>
          <Reveal className={styles.miGiftInner}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.miGiftText}>{content.giftLede ?? 'Ge bort blommor, när som helst.'}</p>
            <Link href="/presentkort" className={shared.sfMoreLink}>
              {content.giftCta ?? 'Köp presentkort'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 7 — FRÅN BLOGGEN: blogg-modulen invävd i samma täta grid-språk som
          butiken (3 senaste). */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.miBlogSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.miSecHead}>
              <div>
                <p className="sf-eyebrow">{content.blogEyebrow ?? '— Inspiration'}</p>
                <h2 className="sf-h2" style={{ marginTop: 6 }}>
                  {content.blogTitle ?? 'Tips, säsong & idéer'}
                </h2>
              </div>
              <Link href="/blogg" className={shared.sfMoreLink}>
                {content.blogCta ?? 'Läs mer'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
            <div className={styles.miBlogGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.miCard}>
                    <div
                      className={styles.miBlogImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <h3 className={styles.miBlogName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.miBlogExcerpt}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 8 — PLATS & ÖPPETTIDER */}
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

      {/* 9 — CLOSING: klarrosa färgplatta, speglar heron (bookend) */}
      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '38rem', margin: '0 auto' }}>
            {content.closingTitle ?? 'Redo att beställa?'}
          </h2>
          <p className={shared.sfClosingLead}>
            {content.closingLede ?? 'Välj din bukett, hämta i butiken eller få den levererad hem.'}
          </p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
