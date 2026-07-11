import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './mina.module.css'

/**
 * MINA — klarrosa & vitt, minimal och ung florist-e-handel (florist-sviten,
 * goal-58 → TEMA-PAKET goal-59). Mallen äger nu NAV (mina.chrome.tsx), FOOTER
 * och undersidorna (mina.pages.tsx) — och hemmet nedan använder NOLL delade
 * .sf-klasser: varje sektion är Minas egen (miWide, miNarrow, miLoc, miClosing).
 * Det var de delade sektionerna som gjorde alla mallar till samma sida.
 *
 * SEKTIONSORDNING (ingen annan mall i sviten har den):
 *   1. HERO — ingen bild. En färgplatta bär enorm sans-typografi.
 *   2. BILD-BANNER — fullbredd foto direkt under heron. Ingen text ovanpå.
 *   3. SHOP-TEASERS — tätt fyr-kolumners grid, de minsta korten i sviten.
 *   4. TJÄNSTER — täta, ONUMRERADE rader (versalt namn + hårfin linje).
 *   5. OM — smal, centrerad textspalt utan sidobild.
 *   6. PRESENTKORT — en smal rad, aldrig en egen sektion.
 *   7. BLOGG — samma täta grid-språk som butiken.
 *   8. PLATS & ÖPPETTIDER — Minas egen två-spalt (fakta + karta-platta).
 *   9. CLOSING — färgplatta som speglar heron (bookend).
 * Sans-only typografi (Jost display + Inter body) — enda mallen i sviten utan
 * serif-rubriker. Webshop/blogg/presentkort vävs in via `modules`-propen (S10).
 *
 * INGA inline-styles för typografi/rytm (bakgrundsbilder undantagna) — allt bor
 * i mina.module.css. Layouten är SYNKRON.
 */
export function MinaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // MINA ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats egna,
  // täta grid-språk istället för den generiska sektions-stapeln. page.tsx förladdar
  // teasers (loadLayoutModuleTeasers) som `modules`-prop → layouten förblir synkron.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false

  const bannerImg = content.heroImages[0] ?? ''

  return (
    <div className={styles.miRoot}>
      {/* 1 — HERO: ingen bild, färgplattan bär den stora typografin. */}
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

      {/* 2 — BILD-BANNER: fullbredd, ingen text ovanpå */}
      <Reveal className={styles.miBanner} style={{ backgroundImage: `url(${bannerImg})` }}>
        <span />
      </Reveal>

      {/* 3 — UR BUTIKEN: webshop-modulen i ett tätt fyr-kolumners grid. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.miShopSection}>
          <div className={styles.miWide}>
            <Reveal className={styles.miSecHead}>
              <div>
                <p className={styles.miEyebrow}>{content.shopEyebrow ?? '— Handla nu'}</p>
                <h2 className={styles.miSecTitle}>{content.shopTitle ?? 'Beställ något fint'}</h2>
              </div>
              <Link href="/shop" className={styles.miMore}>
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

      {/* 4 — TJÄNSTER: täta, onumrerade rader. Bara när det finns tjänster. */}
      {rows.length > 0 ? (
        <section className={styles.miServices}>
          <div className={styles.miNarrow}>
            <Reveal className={styles.miSvcHead}>
              <p className={styles.miEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.miSecTitle}>{content.servicesTitle}</h2>
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
              <Reveal className={styles.miSvcMore}>
                <a href="/tjanster" className={styles.miMore}>
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
            <p className={styles.miEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.miSecTitle}>{content.aboutTitle}</h2>
            <p className={styles.miAboutCopy}>{content.aboutCopyHome}</p>
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
            <p className={styles.miEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.miGiftText}>{content.giftLede ?? 'Ge bort blommor, när som helst.'}</p>
            <Link href="/presentkort" className={styles.miMore}>
              {content.giftCta ?? 'Köp presentkort'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 7 — FRÅN BLOGGEN: samma täta grid-språk som butiken, SAMMA bildratio. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.miBlogSection}>
          <div className={styles.miWide}>
            <Reveal className={styles.miSecHead}>
              <div>
                <p className={styles.miEyebrow}>{content.blogEyebrow ?? '— Inspiration'}</p>
                <h2 className={styles.miSecTitle}>{content.blogTitle ?? 'Tips, säsong & idéer'}</h2>
              </div>
              <Link href="/blogg" className={styles.miMore}>
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

      {/* 8 — PLATS & ÖPPETTIDER: Minas egen två-spalt (fakta + rosa karta-platta) */}
      <section className={styles.miLoc}>
        <div className={styles.miLocGrid}>
          <Reveal>
            <p className={styles.miEyebrow}>{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className={styles.miSecTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            <p className={styles.miLocAddress}>{location?.address ?? 'Adress visas snart.'}</p>
            {location?.hours ? (
              <div className={styles.miHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.miHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={styles.miMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.miMore}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={styles.miMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 9 — CLOSING: färgplatta, speglar heron (bookend). */}
      <section className={styles.miClosing}>
        <Reveal>
          <h2 className={styles.miClosingTitle}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={styles.miClosingLede}>
            {content.closingLede ?? 'Välj din bukett, hämta i butiken eller få den levererad hem.'}
          </p>
          <div className={styles.miClosingActions}>
            <BookCta className={styles.miHeroCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
