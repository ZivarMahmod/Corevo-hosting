import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
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
 *
 * SKÄRPE-PASS: all typografi/rytm/radie/bildratio kommer ur mallens EGNA tokens
 * i seraphina.module.css (sex typnivåer med ×2.0-steg, binär radie, EN bildratio
 * 4:5). Därför använder layouten inga globala sf-*-klasser och inga inline-mått
 * längre — ett mått som inte finns i tokenblocket finns inte i mallen.
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
          <span className={styles.seraEyebrow}>{content.heroEyebrow}</span>
          <h1 className={styles.seraHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.seraHeroLede}>{content.heroLede}</p>
          <div className={styles.seraHeroActions}>
            <BookCta />
          </div>
        </Reveal>
      </section>

      {/* 2. BRÖLLOP FÖRST — offerten är hjälten, inte butiken. Sektionen är
          evergreen editorial text och visas alltid; bara CTA-länken till
          /offert gatas (S9 — ingen 404-fälla mot en avstängd modul). */}
      <section className={styles.seraWedding}>
        <div className={styles.seraWeddingGrid}>
          <Reveal className={styles.seraMat}>
            <div
              className={styles.seraImg}
              style={{ backgroundImage: `url(${content.heroImages[1] ?? content.heroImages[0] ?? ''})` }}
            />
          </Reveal>
          <Reveal delay={120}>
            <span className={styles.seraEyebrow}>— Bröllop &amp; fest</span>
            <h2 className={styles.seraH2}>Er dag, i champagne och guld</h2>
            <p className={styles.seraBody}>
              Brudbukett, borddekorationer och blomsterbågar — vi skapar en helhet som känns som er. Berätta om
              er dag så sätter vi ihop ett förslag.
            </p>
            {offertReachable ? (
              <a href="/offert" className={styles.seraCta}>
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
          <div className={styles.seraContainer}>
            <Reveal className={styles.seraHead}>
              <p className={styles.seraEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.seraH2}>{content.servicesTitle}</h2>
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
              <Reveal className={styles.seraFoot}>
                <a href="/tjanster" className={styles.seraMore}>
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
          <Reveal className={styles.seraHead}>
            <p className={styles.seraEyebrow}>{content.shopEyebrow ?? '— Ur kollektionen'}</p>
            <h2 className={styles.seraH2}>{content.shopTitle ?? 'Färdiga favoriter'}</h2>
          </Reveal>
          <div className={styles.seraGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.seraCard}>
                  <div
                    className={styles.seraImg}
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
            <Reveal className={styles.seraFoot}>
              <Link href="/shop" className={styles.seraMore}>
                {content.shopCta ?? 'Se hela butiken'} <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 5. OM — foto + guld-statistik-trio. */}
      <section className={styles.seraAbout}>
        <div className={styles.seraAboutGrid}>
          <Reveal className={styles.seraMat}>
            <div className={styles.seraImg} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.seraEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.seraH2}>{content.aboutTitle}</h2>
            <p className={styles.seraBody}>{content.aboutCopyHome}</p>
            <ul className={styles.seraStats}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.seraStatValue}>{n}</span>
                  <span className={styles.seraStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 6. GALLERI — tre kolumner (delad Gallery-komponent, omskuren till
          mallens enda bildratio 4:5 via .seraGallery). */}
      <section className={styles.seraGalleryBand}>
        <div className={styles.seraContainer}>
          <Reveal>
            <p className={styles.seraEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal className={styles.seraGallery}>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Blomsterarrangemang' }))} />
          </Reveal>
        </div>
      </section>

      {/* 7. FRÅN JOURNALEN — blogg-modulen invävd. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.seraBlog}>
          <Reveal className={styles.seraHead}>
            <p className={styles.seraEyebrow}>{content.blogEyebrow ?? '— Journalen'}</p>
            <h2 className={styles.seraH2}>{content.blogTitle ?? 'Inspiration & bröllopstips'}</h2>
          </Reveal>
          <div className={styles.seraGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.seraCard}>
                  <div
                    className={styles.seraImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.seraBlogName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.seraBlogMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.seraFoot}>
            <Link href="/blogg" className={styles.seraMore}>
              {content.blogCta ?? 'Läs fler inlägg'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 8. PRESENTKORT — en smal rad, aldrig en hel sektion. */}
      {presentkortLive ? (
        <section className={styles.seraGift}>
          <Reveal className={styles.seraGiftInner}>
            <p className={styles.seraEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.seraGiftLede}>{content.giftLede ?? 'Ge bort finess, i valfri summa.'}</p>
            <a href="/presentkort" className={styles.seraMore}>
              {content.giftCta ?? 'Till presentkorten'} <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </section>
      ) : null}

      {/* 9. PLATS & ÖPPETTIDER */}
      <section className={styles.seraLoc}>
        <div className={styles.seraLocGrid}>
          <Reveal>
            <p className={styles.seraEyebrow}>{content.findEyebrow ?? '— Besök oss'}</p>
            <h2 className={styles.seraH2}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            <p className={styles.seraBody}>{location?.address ?? 'Adress visas snart.'}</p>
            {location?.hours ? (
              <div className={styles.seraHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.seraHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <div className={styles.seraMap}>
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.seraMore}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={styles.seraMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 10. CLOSING */}
      <section className={styles.seraClosing}>
        <Reveal>
          <h2 className={styles.seraClosingTitle}>{content.closingTitle ?? 'Redo att planera er dag?'}</h2>
          <p className={styles.seraClosingLede}>
            {content.closingLede ?? 'Begär en offert eller boka en konsultation — vi hjälper er gärna vidare.'}
          </p>
          <div className={styles.seraClosingActions}>
            <BookCta className={styles.seraClosingCta} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
