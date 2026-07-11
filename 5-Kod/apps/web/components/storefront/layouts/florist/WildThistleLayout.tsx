import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './wildthistle.module.css'

/**
 * WILD THISTLE — mörk tistel-lila + mossgrön + råpapper, rustik/vild
 * (florist-sviten, goal-58). Zivar: "får inte kännas som en mjuk morot — ska
 * kännas som ett svärd". EGEN sektionsordning (ingen annan mall i sviten har
 * den): (1) hero — bild och text i ETT asymmetriskt block nere till vänster
 * (bruten grid, tre foton i ojämna rutor), (2) "Så jobbar vi" — numrerad
 * trio (01/02/03) i rå typografi, inga bilder, (3) shop-teasers med rakt
 * avskurna bilder (radius 0), (4) tjänster som en RÅ prislista (punkterad
 * linje mellan namn och pris), (5) om med ett stort citat, (6) en mossgrön
 * kurser-CTA-remsa, (7) blogg (samma raka kort som butiken), (8) galleri,
 * (9) plats, (10) closing i eget mörka fullbredds-foto. Presentkort vävs in
 * som en smal rad mellan blogg och galleri — aldrig en egen sektion.
 * Webshop/blogg/presentkort/offert vävs in via `modules`-propen (S10) —
 * samma modulkontrakt som övriga florist-mallar.
 */
export function WildThistleLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Utan modules-prop (studions statiska preview) visas allt — länkarna är ändå
  // inte klickbara på riktigt där, och previewn ska se en hel, riktig sida.
  const shopReachable = modules ? modules.shopReachable : true

  const [heroWide, heroSmall, heroTall] = [
    content.heroImages[0] ?? '',
    content.heroImages[1] ?? content.heroImages[0] ?? '',
    content.heroImages[2] ?? content.heroImages[0] ?? '',
  ]

  // "Så jobbar vi" — statisk, evergreen processkopia (ingen egen content-slot
  // för det här i ThemeContent-kontraktet; samma mönster som Paisleys
  // hårdkodade "Fira med blommor"-sektion).
  const steps = [
    {
      title: 'Vi plockar vilt',
      text: 'Tistlar, gräs och blommor i säsong — inget odlat bara för att se perfekt ut.',
    },
    {
      title: 'Vi binder för hand',
      text: 'Rakt, rustikt, utan krusiduller. Varje bukett blir sin egen.',
    },
    {
      title: 'Du hämtar eller får den',
      text: 'I butiken, som bud, eller levererad hem till dörren.',
    },
  ]

  return (
    <div className={styles.wtRoot}>
      {/* 1 — HERO: bild + text i ETT asymmetriskt block nere till vänster (bruten grid) */}
      <section className={styles.wtHero}>
        <div className={styles.wtHeroGrid}>
          <div className={`${styles.wtHeroImg} ${styles.wtHeroImgWide}`} style={{ backgroundImage: `url(${heroWide})` }} />
          <div className={`${styles.wtHeroImg} ${styles.wtHeroImgSmall}`} style={{ backgroundImage: `url(${heroSmall})` }} />
          <div className={`${styles.wtHeroImg} ${styles.wtHeroImgTall}`} style={{ backgroundImage: `url(${heroTall})` }} />
          <div className={styles.wtHeroTextCard}>
            {content.heroEyebrow ? <span className={styles.wtHeroEyebrow}>{content.heroEyebrow}</span> : null}
            <h1 className={styles.wtHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.wtHeroLede}>{content.heroLede}</p>
            <div className={styles.wtHeroActions}>
              <BookCta className={styles.wtSquareCta} />
            </div>
          </div>
        </div>
      </section>

      {/* 2 — SÅ JOBBAR VI: numrerad trio (01/02/03), rå typografi, inga bilder */}
      <section className={styles.wtSteps}>
        <div className={styles.wtStepsGrid}>
          {steps.map((s, i) => (
            <Reveal key={s.title} as="div" delay={i * 90} className={styles.wtStep}>
              <span className={styles.wtStepNum} aria-hidden="true">
                {serviceNum(i)}
              </span>
              <h3 className={styles.wtStepTitle}>{s.title}</h3>
              <p className={styles.wtStepText}>{s.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 3 — UR BUTIKEN: webshop-modulen invävd, rakt avskurna bilder (radius 0).
          Bara ett smakprov; hela sortimentet bor på /shop. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.wtCardSection}>
          <div className={styles.wtContain}>
            <Reveal className={styles.wtSecHead} as="div">
              <div>
                <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
                <h2 className="sf-h2" style={{ marginTop: 8 }}>
                  {content.shopTitle ?? 'Rakt från fältet'}
                </h2>
              </div>
              {shopReachable ? (
                <Link href="/shop" className={styles.wtSecCta}>
                  {content.shopCta ?? 'Handla i butiken'}
                </Link>
              ) : null}
            </Reveal>
            <div className={styles.wtCardGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal key={p.id} as="div" delay={i * 80}>
                  <Link href={`/shop/${p.id}`} className={styles.wtCard}>
                    <div
                      className={styles.wtCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <h3 className={styles.wtCardName}>{p.name}</h3>
                    <p className={styles.wtCardMeta}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 4 — TJÄNSTER: rå prislista, punkterad linje mellan namn och pris. Hela
          sektionen visas bara när det finns aktiva tjänster. */}
      {rows.length > 0 ? (
        <section className={shared.sfPriceBand}>
          <Reveal style={{ textAlign: 'center' }}>
            <p className="sf-eyebrow">{content.servicesEyebrow}</p>
            <h2 className="sf-h1" style={{ margin: '12px 0 44px' }}>
              {content.servicesTitle}
            </h2>
          </Reveal>
          <div className={shared.sfPriceGrid}>
            {rows.map((s) => (
              <Bookable key={s.id} className={shared.sfPriceRow} label={`Boka — ${s.name}`}>
                <span className={shared.sfPriceName}>{s.name}</span>
                <span className={shared.sfPriceDots} aria-hidden="true" />
                <span className={shared.sfPriceVal}>{formatPrice(s)}</span>
              </Bookable>
            ))}
          </div>
          {hasMore ? (
            <Reveal style={{ textAlign: 'center' }}>
              <a href="/tjanster" className={shared.sfMoreLink}>
                Se allt vi gör <span aria-hidden="true">→</span>
              </a>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 5 — OM: porträtt + stort citat */}
      <section className={styles.wtAbout}>
        <div className={`${styles.wtContain} ${styles.wtAboutGrid}`}>
          <Reveal>
            <div className={styles.wtAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <p
              className="sf-italic"
              style={{
                fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
                lineHeight: 1.25,
                color: 'var(--color-primary)',
                margin: '14px 0 20px',
              }}
            >
              ”{content.italic}”
            </p>
            <p className="sf-body" style={{ fontSize: 17 }}>
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

      {/* 6 — KURSER-CTA: mossgrön remsa. Kurser är en inbyggd sida (som hos
          övriga florist-mallar), aldrig gatad av modules-flaggor. */}
      <section className={styles.wtCourseBand}>
        <Reveal>
          <p className={styles.wtCourseEyebrow}>— Kurser & kvällar</p>
          <h2 className={styles.wtCourseTitle}>En kväll med blommor och bubbel</h2>
          <p className={styles.wtCourseLede}>
            Bind din egen vildvuxna bukett tillsammans med oss — inga förkunskaper krävs.
          </p>
          <div className={styles.wtCourseActions}>
            <Link href="/kurser" className={styles.wtCourseCta}>
              Boka en kurskväll
            </Link>
          </div>
        </Reveal>
      </section>

      {/* 7 — FRÅN BLOGGEN: blogg-modulen invävd, samma raka kort-formspråk som butiken. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.wtCardSection}>
          <div className={styles.wtContain}>
            <Reveal className={styles.wtSecHead} as="div">
              <div>
                <p className="sf-eyebrow">{content.blogEyebrow ?? '— Fältanteckningar'}</p>
                <h2 className="sf-h2" style={{ marginTop: 8 }}>
                  {content.blogTitle ?? 'Säsong, växtlighet & vildvuxet'}
                </h2>
              </div>
              <Link href="/blogg" className={styles.wtSecCta}>
                {content.blogCta ?? 'Läs mer'}
              </Link>
            </Reveal>
            <div className={styles.wtCardGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} as="div" delay={i * 80}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.wtCard}>
                    <div
                      className={styles.wtCardImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <h3 className={styles.wtCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.wtCardExcerpt}>{p.excerpt}</p> : null}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — smal rad mellan blogg och galleri, aldrig en egen sektion */}
      {presentkortLive ? (
        <div className={styles.wtGift}>
          <Reveal className={styles.wtGiftInner} as="div">
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className="sf-body" style={{ margin: 0 }}>
              {content.giftLede ?? 'Ge bort något som fått växa vilt.'}
            </p>
            <Link href="/presentkort" className={styles.wtGiftCta}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 8 — GALLERI */}
      <section className={shared.sfGalleryBand}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* 9 — PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta till butiken'}</p>
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

      {/* 10 — CLOSING: eget mörka fullbredds-foto, fyrkantig CTA */}
      <section className={styles.wtClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
        <div className={styles.wtClosingOverlay} aria-hidden="true" />
        <div className={styles.wtClosingInner}>
          <Reveal>
            <p className={styles.wtClosingEyebrow}>{content.tagline}</p>
            <h2 className={styles.wtClosingTitle}>{content.closingTitle ?? 'Redo för något vilt vackert?'}</h2>
            <p className={styles.wtClosingLede}>
              {content.closingLede ?? 'Beställ en bukett, boka en kurskväll eller kom förbi butiken.'}
            </p>
            <div className={styles.wtClosingActions}>
              <BookCta className={styles.wtSquareCta} />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
