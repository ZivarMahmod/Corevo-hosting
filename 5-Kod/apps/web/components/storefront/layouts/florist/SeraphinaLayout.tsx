import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './seraphina.module.css'

/**
 * SERAPHINA — champagne/guld bröllopslyx (florist-sviten, goal-58). EGEN
 * sektionsordning (ingen annan mall i sviten har den): (1) fullskärms-hero med
 * en centrerad kort-ram (tunn guldram runt rubriken), (2) BRÖLLOP FÖRST — stor
 * bild + text + "Begär offert" direkt efter heron (offerten är hjälten, inte
 * butiken — gatad på offertReachable), (3) tjänste-priser i en elegant
 * TVÅSPALT, (4) shop-teasers, (5) om med guld-statistik-trio, (6) galleri i
 * tre kolumner, (7) blogg, (8) presentkort (smal rad), (9) plats, (10)
 * closing. Webshop/blogg/presentkort/offert vävs in via `modules`-propen
 * (S10) — samma modulkontrakt som övriga florist-mallar.
 */
export function SeraphinaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6
  const half = Math.ceil(rows.length / 2)
  const colA = rows.slice(0, half)
  const colB = rows.slice(half)

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  const shopReachable = modules ? modules.shopReachable : true
  const offertReachable = modules ? modules.offertReachable : true

  return (
    <div className={styles.seraRoot}>
      {/* 1. HERO — fullskärmsbild + centrerad kort-ram (tunn guldram) */}
      <section className={styles.seraHero}>
        <div className={styles.seraHeroImg} style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }} />
        <div className={styles.seraHeroScrim} aria-hidden="true" />
        <Reveal className={styles.seraHeroFrame}>
          <span className={styles.seraHeroEyebrow}>{content.heroEyebrow}</span>
          <h1 className={styles.seraHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.seraHeroLede}>{content.heroLede}</p>
          <div className={styles.seraHeroActions}>
            <BookCta className={styles.seraHeroCta} />
          </div>
        </Reveal>
      </section>

      {/* 2. BRÖLLOP FÖRST — offerten är hjälten, inte butiken. Sektionen är
          evergreen editorial text och visas alltid; bara CTA-länken till
          /offert gatas (S9 — ingen 404-fälla mot en avstängd modul). */}
      <section className={styles.seraWedding}>
        <div className={styles.seraWeddingGrid}>
          <Reveal className={styles.seraWeddingImgWrap}>
            <div
              className={styles.seraWeddingImg}
              style={{ backgroundImage: `url(${content.heroImages[1] ?? content.heroImages[0] ?? ''})` }}
            />
          </Reveal>
          <Reveal delay={120}>
            <span className={styles.seraWeddingEyebrow}>— Bröllop &amp; fest</span>
            <h2 className={styles.seraWeddingTitle}>Er dag, i champagne och guld</h2>
            <p className={styles.seraWeddingBody}>
              Brudbukett, borddekorationer och blomsterbågar — vi skapar en helhet som känns som er. Berätta om
              er dag så sätter vi ihop ett förslag.
            </p>
            {offertReachable ? (
              <a href="/offert" className={styles.seraWeddingCta}>
                Begär offert <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </Reveal>
        </div>
      </section>

      {/* 3. TJÄNSTE-PRISER — elegant tvåspalt (S8: bara när det finns aktiva
          tjänster, ingen tom-text på hemmet). */}
      {rows.length > 0 ? (
        <section className={styles.seraServices}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>
                {content.servicesTitle}
              </h2>
            </Reveal>
            <div className={styles.seraPriceCols}>
              {[colA, colB].map((col, colIdx) => (
                <div key={colIdx} className={styles.seraPriceCol}>
                  {col.map((s, i) => (
                    <Reveal key={s.id} delay={i * 60}>
                      <Bookable className={styles.seraPriceRow} label={`Boka — ${s.name}`}>
                        <span className={styles.seraPriceNum} aria-hidden="true">
                          {serviceNum(colIdx * half + i)}
                        </span>
                        <span className={styles.seraPriceMain}>
                          <span className={styles.seraPriceName}>{s.name}</span>
                          <span className={styles.seraPriceDesc}>{serviceDesc(s)}</span>
                        </span>
                        <span className={styles.seraPriceMeta}>
                          <span className={styles.seraPricePrice}>{formatPrice(s)}</span>
                        </span>
                      </Bookable>
                    </Reveal>
                  ))}
                </div>
              ))}
            </div>
            {hasMore ? (
              <Reveal style={{ textAlign: 'center', marginTop: 24 }}>
                <a href="/tjanster" className={shared.sfMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 4. UR KOLLEKTIONEN — webshop-modulen invävd. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.seraShop}>
          <Reveal className={styles.seraShopHead}>
            <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur kollektionen'}</p>
            <h2 className="sf-h2" style={{ marginTop: 10 }}>
              {content.shopTitle ?? 'Färdiga favoriter'}
            </h2>
          </Reveal>
          <div className={styles.seraShopGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.seraShopCard}>
                  <div
                    className={styles.seraShopImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <div className={styles.seraShopInfo}>
                    <span className={styles.seraShopName}>{p.name}</span>
                    <span className={styles.seraShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          {shopReachable ? (
            <Reveal className={styles.seraShopFoot}>
              <Link href="/shop" className={shared.sfMoreLink}>
                {content.shopCta ?? 'Se hela butiken'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 5. OM — foto + guld-statistik-trio. */}
      <section className={styles.seraAbout}>
        <div className={styles.seraAboutGrid}>
          <Reveal className={styles.seraAboutPhotoWrap}>
            <div className={styles.seraAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
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

      {/* 6. GALLERI — tre kolumner (delad Gallery-komponent). */}
      <section className={shared.sfGalleryBand}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Blomsterarrangemang' }))} />
          </Reveal>
        </div>
      </section>

      {/* 7. FRÅN JOURNALEN — blogg-modulen invävd. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.seraBlog}>
          <Reveal className={styles.seraBlogHead}>
            <p className="sf-eyebrow">{content.blogEyebrow ?? '— Journalen'}</p>
            <h2 className="sf-h2" style={{ marginTop: 10 }}>
              {content.blogTitle ?? 'Inspiration & bröllopstips'}
            </h2>
          </Reveal>
          <div className={styles.seraBlogGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.seraBlogCard}>
                  <div
                    className={styles.seraBlogImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.seraBlogName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.seraBlogMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.seraBlogFoot}>
            <Link href="/blogg" className={shared.sfMoreLink}>
              {content.blogCta ?? 'Läs fler inlägg'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 8. PRESENTKORT — en smal rad, aldrig en hel sektion. */}
      {presentkortLive ? (
        <section className={styles.seraGift}>
          <Reveal className={styles.seraGiftInner}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className="sf-italic" style={{ fontSize: 'clamp(17px, 1.8vw, 20px)', margin: 0, color: 'var(--color-primary)' }}>
              {content.giftLede ?? 'Ge bort finess, i valfri summa.'}
            </p>
            <a href="/presentkort" className={shared.sfMoreLink} style={{ marginTop: 0 }}>
              {content.giftCta ?? 'Till presentkorten'} <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </section>
      ) : null}

      {/* 9. PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Besök oss'}</p>
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

      {/* 10. CLOSING */}
      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto', fontStyle: 'italic' }}>
            {content.closingTitle ?? 'Redo att planera er dag?'}
          </h2>
          <p className={shared.sfClosingLead}>
            {content.closingLede ?? 'Begär en offert eller boka en konsultation — vi hjälper er gärna vidare.'}
          </p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
