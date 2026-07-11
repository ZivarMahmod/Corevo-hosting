import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './paisley.module.css'

/**
 * PAISLEY — tegelröd REDAKTIONELL TIDNING (florist-sviten). Goal-59: mallen är nu
 * ett HELT TEMA-PAKET (paisley.chrome.tsx = tryckt sidhuvud + kolofon-sidfot,
 * paisley.pages.tsx = reportage/prislista/kolofon) och hemmet äger ALLA sina
 * sektioner — NOLL delade .sf*-klasser. Det var de delade sektionerna som gjorde
 * varje mall till samma sida i en ny färg.
 *
 * Hemmets uppslag, i ordning:
 *   1  HERO — fullbredds foto, enorm versal-serif i bilden, fyrkantig CTA
 *   2  LEVERANSBAND — mörkt tegelband, dekorativa tidsrutor
 *   3  UPPSLAG — tidningens mittuppslag: bildkollage + text i två spalter
 *   4  BUTIKEN — redaktionellt rutnät med BILDTEXTER (shop-teasers)
 *   5  PRISER — tidningskolumner med punktlinje-rader (varje rad en Bookable)
 *   6  OM — inramad plansch + spaltad brödtext + faktaruta
 *   7  BLOGGEN — samma redaktionella rutnät (blogg-teasers)
 *   8  PRESENTKORT — en smal rad, aldrig en egen sektion
 *   9  PLATS — adress + öppettider som en tryckt notis
 *  10  CLOSING — eget fullbredds-foto
 *
 * SYNKRON server-komponent (ingen async, ingen 'use client'). Modul-gatingen är
 * helig: shopReachable/offertReachable gatar varje länk, teasers-sektioner finns
 * bara när teasers finns.
 */
export function PaisleyLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Utan modules-prop (studions statiska preview) visas allt.
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  const heroImg = content.heroImages[0] ?? ''
  const spreadMain = content.heroImages[1] ?? content.heroImages[0] ?? ''
  const spreadInset = content.heroImages[2] ?? content.heroImages[0] ?? ''

  return (
    <div className={styles.paRoot}>
      {/* 1 — HERO */}
      <section className={styles.paHero} style={{ backgroundImage: `url(${heroImg})` }}>
        <div className={styles.paHeroOverlay} aria-hidden="true" />
        <div className={styles.paHeroInner}>
          {content.heroEyebrow ? <span className={styles.paHeroEyebrow}>{content.heroEyebrow}</span> : null}
          <h1 className={styles.paHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.paHeroLede}>{content.heroLede}</p>
          <div className={styles.paHeroActions}>
            <BookCta className={styles.paSquareCta} />
          </div>
        </div>
      </section>

      {/* 2 — LEVERANSBAND. Tidsrutorna är REN DEKOR (aria-hidden, inga riktiga
          sekunder — layouten är och förblir synkron). Textraden bär budskapet. */}
      <section className={styles.paDelivery}>
        <div className={`${styles.paWrap} ${styles.paDeliveryInner}`}>
          <div className={styles.paDeliveryText}>
            <p className={styles.paDeliveryTag}>Samma dag</p>
            <p className={styles.paDeliveryLine}>Beställ före 15:00 för leverans idag.</p>
          </div>
          <div className={styles.paDeliveryRight}>
            <div className={styles.paTimer} aria-hidden="true">
              <div className={styles.paTimerBox}>
                <span className={styles.paTimerNum}>04</span>
                <span className={styles.paTimerLabel}>Timmar</span>
              </div>
              <div className={styles.paTimerBox}>
                <span className={styles.paTimerNum}>32</span>
                <span className={styles.paTimerLabel}>Minuter</span>
              </div>
              <div className={styles.paTimerBox}>
                <span className={styles.paTimerNum}>18</span>
                <span className={styles.paTimerLabel}>Sekunder</span>
              </div>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={`btn-accent ${styles.paSquareCta}`}>
                Beställ nu
              </Link>
            ) : (
              <BookCta className={styles.paSquareCta} />
            )}
          </div>
        </div>
      </section>

      {/* 3 — MITTUPPSLAGET */}
      <section className={styles.paSpread}>
        <div className={`${styles.paWrap} ${styles.paSpreadGrid}`}>
          <Reveal className={styles.paSpreadMedia}>
            <div className={styles.paSpreadImgMain} style={{ backgroundImage: `url(${spreadMain})` }} />
            <div className={styles.paSpreadImgInset} style={{ backgroundImage: `url(${spreadInset})` }} />
          </Reveal>
          <Reveal delay={120} className={styles.paSpreadText}>
            <p className={styles.paKicker}>— Fira med blommor</p>
            <h2 className={styles.paSecTitle}>En bukett för varje anledning</h2>
            <div className={styles.paSpreadCols}>
              <p>
                Födelsedagar, jubileum eller bara en vanlig tisdag som förtjänar något extra — vi väljer
                säsongens finaste snitt och binder det för hand.
              </p>
              <p>{content.aboutCopyHome}</p>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={styles.paTextCta}>
                Beställ blommor
              </Link>
            ) : null}
            {offertReachable ? (
              <p className={styles.paSpreadNote}>
                Planerar du bröllop eller ett event? <Link href="/offert">Begär en offert</Link>.
              </p>
            ) : null}
          </Reveal>
        </div>
      </section>

      {/* 4 — UR BUTIKEN: redaktionellt rutnät med bildtexter */}
      {shopTeasers.length > 0 ? (
        <section className={styles.paGridSection}>
          <div className={styles.paWrap}>
            <Reveal className={styles.paSecHead}>
              <div>
                <p className={styles.paKicker}>{content.shopEyebrow ?? '— Ur butiken'}</p>
                <h2 className={styles.paSecTitle}>{content.shopTitle ?? 'Beställ något vackert'}</h2>
              </div>
              {shopReachable ? (
                <Link href="/shop" className={styles.paTextCta}>
                  {content.shopCta ?? 'Handla i butiken'} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </Reveal>
            <div className={styles.paPlateGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <Link href={`/shop/${p.id}`} className={styles.paPlateCard}>
                    <div
                      className={styles.paPlateImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <p className={styles.paPlateCaption}>
                      <span className={styles.paPlateNum}>{serviceNum(i)}</span>
                      <span className={styles.paPlateName}>{p.name}</span>
                      <span className={styles.paPlatePrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5 — PRISER i tidningskolumner (punktlinje-rader, varje rad en Bookable) */}
      {rows.length > 0 ? (
        <section className={styles.paPrices}>
          <div className={styles.paWrap}>
            <Reveal className={styles.paSecHeadCentered}>
              <p className={styles.paKicker}>{content.servicesEyebrow}</p>
              <h2 className={styles.paSecTitle}>{content.servicesTitle}</h2>
            </Reveal>
            <ol className={styles.paPriceList}>
              {rows.map((s, i) => (
                <li key={s.id}>
                  <Bookable className={styles.paPriceRow} label={`Boka — ${s.name}`}>
                    <span className={styles.paPriceNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={styles.paPriceBody}>
                      <span className={styles.paPriceName}>{s.name}</span>
                      <span className={styles.paPriceDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.paPriceDots} aria-hidden="true" />
                    <span className={styles.paPriceMeta}>
                      <span className={styles.paPriceKr}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </li>
              ))}
            </ol>
            {hasMore ? (
              <div className={styles.paSecHeadCentered}>
                <Link href="/tjanster" className={styles.paTextCta}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 6 — OM: inramad plansch + spaltad brödtext + faktaruta */}
      <section className={styles.paAbout}>
        <div className={`${styles.paWrap} ${styles.paAboutGrid}`}>
          <Reveal>
            <div className={styles.paFrame} style={{ backgroundImage: `url(${content.aboutImage})` }} />
            <p className={styles.paCaption}>{content.italic}</p>
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.paKicker}>— Om {tenant.name}</p>
            <h2 className={styles.paSecTitle}>{content.aboutTitle}</h2>
            <p className={styles.paIngress}>{content.aboutCopyHome}</p>
            {content.stats.length > 0 ? (
              <dl className={styles.paFactList}>
                {content.stats.map(([n, l]) => (
                  <div key={l} className={styles.paFactRow}>
                    <dt>{n}</dt>
                    <dd>{l}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Reveal>
        </div>
      </section>

      {/* 7 — FRÅN REDAKTIONEN (blogg) */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.paGridSection}>
          <div className={styles.paWrap}>
            <Reveal className={styles.paSecHead}>
              <div>
                <p className={styles.paKicker}>{content.blogEyebrow ?? '— Från redaktionen'}</p>
                <h2 className={styles.paSecTitle}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
              </div>
              <Link href="/blogg" className={styles.paTextCta}>
                {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
            <div className={styles.paPlateGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.paPlateCard}>
                    <div
                      className={styles.paPlateImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <p className={styles.paPlateCaption}>
                      <span className={styles.paPlateNum}>{serviceNum(i)}</span>
                      <span className={styles.paPlateName}>{p.title}</span>
                    </p>
                    {p.excerpt ? <p className={styles.paPlateExcerpt}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — smal rad */}
      {presentkortLive ? (
        <div className={styles.paGift}>
          <div className={`${styles.paWrap} ${styles.paGiftInner}`}>
            <p className={styles.paKicker}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.paGiftText}>{content.giftLede ?? 'Ge bort en bukett, när som helst.'}</p>
            <Link href="/presentkort" className={styles.paTextCta}>
              {content.giftCta ?? 'Till presentkorten'} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : null}

      {/* 9 — PLATS: tryckt notis (adress/tider), render-on-present */}
      <section className={styles.paNotice}>
        <div className={`${styles.paWrap} ${styles.paNoticeGrid}`}>
          <Reveal>
            <p className={styles.paKicker}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.paSecTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.paNoticeAddr}>{location.address}</p>
            ) : (
              <p className={styles.paNoticeAddr}>Adress visas snart.</p>
            )}
            {location?.address ? (
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.paTextCta}
              >
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </Reveal>
          {location?.hours && location.hours.length > 0 ? (
            <Reveal delay={120} className={styles.paNoticeHours}>
              <p className={styles.paNoticeHead}>Öppettider</p>
              {location.hours.map((h) => (
                <p key={h.day} className={styles.paNoticeRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </p>
              ))}
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* 10 — CLOSING */}
      <section className={styles.paClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
        <div className={styles.paClosingOverlay} aria-hidden="true" />
        <div className={styles.paClosingInner}>
          <Reveal>
            <h2 className={styles.paClosingTitle}>{content.closingTitle ?? 'Redo för din beställning?'}</h2>
            <p className={styles.paClosingLead}>
              {content.closingLede ?? 'Beställ ett arrangemang, boka en tid eller kom förbi butiken.'}
            </p>
            <div className={styles.paClosingActions}>
              <BookCta className={styles.paSquareCta} />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
