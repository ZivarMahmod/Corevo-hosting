import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './lunaria.module.css'

/**
 * LUNARIA — nattblå + silvergrå + torkat vete, stillsam florist-mall
 * (florist-sviten, goal-58). SIGNATUR-ORDNING (unik i sviten):
 *   (1) hero — bild med en ÖVERLAPPANDE textplatta som skjuter ut över
 *       bildens nedre kant (offset-kort, .lnHeroCard)
 *   (2) tre "stämningskort" (Säsong / Prenumeration / Kurser) — Prenumeration
 *       länkar till /shop när shopReachable, Kurser till /kurser (ogated
 *       bas-rutt, samma antagande som Floras tredje pelare), Säsong är rent
 *       informativ utan länk
 *   (3) tjänster · (4) shop-teasers · (5) om med cirkulärt porträtt ·
 *   (6) galleri · (7) blogg · (8) presentkort (smal rad) · (9) plats ·
 *   (10) closing (helbild med mörk gradient)
 * Modulerna (shop/blogg/presentkort/offert) vävs in via `modules`-propen
 * (S10) — se MODUL-INVÄVNING nedan. SYNKRON komponent (ingen async/await):
 * onboarding-studions klienta preview renderar samma komponent.
 */

/** Tunn måne — sektionsdelaren som ersätter Floras stjälk-ornament. */
function MoonOrnament() {
  return (
    <div className={styles.lnOrnament} aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <path
          d="M17 3a14 14 0 1 0 0 28c-5-2.6-8.4-8-8.4-14S12 5.6 17 3Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </div>
  )
}

export function LunariaLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // LUNARIA ÄGER SINA MODULER (S10): shop/blogg/presentkort/offert vävs in i
  // temats eget formspråk (stämningskort, lnCard-grid, smal presentkortsrad)
  // istället för den generiska sektions-stapeln.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // modules === undefined (studions statiska preview) → visa allt, precis som
  // Flora: previewn ska se en hel sida även om länkarna inte är klickbara på
  // riktigt där.
  const shopReachable = modules ? modules.shopReachable : true

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''

  return (
    <>
      {/* HERO — inset foto + offset textplatta som bryter dess nedre kant */}
      <section className={styles.lnHero}>
        <div className={styles.lnHeroFrame}>
          <Reveal className={styles.lnHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }}>
            <span />
          </Reveal>
          <Reveal delay={140} className={styles.lnHeroCard}>
            <span className={styles.lnHeroEyebrow}>{content.heroEyebrow}</span>
            <h1 className={styles.lnHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.lnHeroLede}>{content.heroLede}</p>
            <div className={styles.lnHeroActions}>
              <BookCta className={styles.lnHeroCta} />
            </div>
          </Reveal>
        </div>
      </section>

      <MoonOrnament />

      {/* STÄMNINGSKORT — Säsong (info) / Prenumeration (→ /shop) / Kurser (→ /kurser) */}
      <section className={styles.lnMoodSection}>
        <div className={styles.lnMoodGrid}>
          <Reveal>
            <div className={styles.lnMoodCard}>
              <div
                className={styles.lnMoodImg}
                style={{ backgroundImage: `url(${content.galleryImages[0] ?? heroPhoto})` }}
              />
              <div className={styles.lnMoodBody}>
                <h3 className={styles.lnMoodTitle}>{content.pillar1Title ?? 'Säsongens blommor'}</h3>
                <p className={styles.lnMoodText}>
                  {content.pillar1Body ??
                    'Vi följer årstiderna — från vårens första lökar till vinterns torkade grenar. Fråga oss vad som är vackrast just nu.'}
                </p>
              </div>
            </div>
          </Reveal>

          {shopReachable ? (
            <Reveal delay={100}>
              <Link href="/shop" className={styles.lnMoodCard}>
                <div
                  className={styles.lnMoodImg}
                  style={{ backgroundImage: `url(${content.galleryImages[1] ?? heroPhoto})` }}
                />
                <div className={styles.lnMoodBody}>
                  <h3 className={styles.lnMoodTitle}>{content.pillar2Title ?? 'Blomprenumeration'}</h3>
                  <p className={styles.lnMoodText}>
                    {content.pillar2Body ??
                      'Nya, säsongsbundna kompositioner — levererade eller redo att hämta varje vecka, varannan vecka eller en gång i månaden.'}
                  </p>
                  <span className={styles.lnMoodLink}>{content.pillar2Link ?? 'Bli prenumerant'}</span>
                </div>
              </Link>
            </Reveal>
          ) : (
            <Reveal delay={100}>
              <div className={styles.lnMoodCard}>
                <div
                  className={styles.lnMoodImg}
                  style={{ backgroundImage: `url(${content.galleryImages[1] ?? heroPhoto})` }}
                />
                <div className={styles.lnMoodBody}>
                  <h3 className={styles.lnMoodTitle}>{content.pillar2Title ?? 'Blomprenumeration'}</h3>
                  <p className={styles.lnMoodText}>
                    {content.pillar2Body ??
                      'Nya, säsongsbundna kompositioner — levererade eller redo att hämta varje vecka, varannan vecka eller en gång i månaden.'}
                  </p>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal delay={200}>
            <Link href="/kurser" className={styles.lnMoodCard}>
              <div
                className={styles.lnMoodImg}
                style={{ backgroundImage: `url(${content.galleryImages[2] ?? heroPhoto})` }}
              />
              <div className={styles.lnMoodBody}>
                <h3 className={styles.lnMoodTitle}>{content.pillar3Title ?? 'Kurser & kvällar'}</h3>
                <p className={styles.lnMoodText}>
                  {content.pillar3Body ??
                    'Lär dig binda din egen komposition tillsammans med oss — en stilla kväll med blommor, bubbel och nya bekantskaper.'}
                </p>
                <span className={styles.lnMoodLink}>{content.pillar3Link ?? 'Se kurser'}</span>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* TJÄNSTER — bara när det finns aktiva tjänster (goal-55 8B: ingen tom-text) */}
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
                  <Bookable className={shared.sfRow} label={`Beställ — ${s.name}`}>
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

      {/* UR BUTIKEN — webshop-modulen invävd i lnCard-formspråket */}
      {shopTeasers.length > 0 ? (
        <section className={styles.lnCardSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.lnSecHead}>
              <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
              <h2 className={styles.lnSecTitle}>{content.shopTitle ?? 'Nytt i butiken'}</h2>
            </Reveal>
            <div className={styles.lnCardGrid}>
              {shopTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 90}>
                  <Link href={`/shop/${p.id}`} className={styles.lnCard}>
                    <div
                      className={styles.lnCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <div className={styles.lnCardBody}>
                      <h3 className={styles.lnCardName}>{p.name}</h3>
                      <p className={styles.lnCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
            <Reveal className={styles.lnSecHead}>
              <Link href="/shop" className={styles.lnBandCta}>
                {content.shopCta ?? 'Till butiken'}
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* OM — cirkulärt porträtt + berättelsen */}
      <section className={styles.lnAboutBand}>
        <div className={`${shared.sfWide} ${styles.lnAboutGrid}`}>
          <Reveal className={styles.lnAboutMedia}>
            <div className={styles.lnPortrait} style={{ backgroundImage: `url(${content.aboutImage})` }} />
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

      {/* GALLERI — masonry + lightbox */}
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

      <MoonOrnament />

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste som lnCard → /blogg) */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.lnCardSection}>
          <div className={shared.sfWide}>
            <Reveal className={styles.lnSecHead}>
              <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className={styles.lnSecTitle}>{content.blogTitle ?? 'Tankar & säsong'}</h2>
            </Reveal>
            <div className={styles.lnCardGrid}>
              {bloggTeasers.map((p, i) => (
                <Reveal key={p.id} delay={i * 90}>
                  <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.lnCard}>
                    <div
                      className={styles.lnCardImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                    <div className={styles.lnCardBody}>
                      <h3 className={styles.lnCardName}>{p.title}</h3>
                      {p.excerpt ? <p className={styles.lnCardMeta}>{p.excerpt}</p> : null}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
            <Reveal className={styles.lnSecHead}>
              <Link href="/blogg" className={styles.lnBandCta}>
                {content.blogCta ?? 'Läs hela bloggen'}
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* PRESENTKORT — en smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <section className={styles.lnGiftRow}>
          <Reveal className={styles.lnGiftInner}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.lnGiftLede}>{content.giftLede ?? 'Ge bort en stilla, blommande stund.'}</p>
            <Link href="/presentkort" className={styles.lnBandCta} style={{ margin: 0 }}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PLATS & ÖPPETTIDER */}
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

      {/* CLOSING — helbild med mörk gradient, ljus text ovanpå */}
      <section className={styles.lnClosing} style={{ backgroundImage: `url(${content.closingImage})` }}>
        <div className={styles.lnClosingOverlay} />
        <Reveal className={styles.lnClosingInner}>
          <h2 className={styles.lnClosingTitle}>{content.closingTitle ?? 'Blommor för din stilla stund?'}</h2>
          <p className={styles.lnClosingLede}>
            {content.closingLede ?? 'Beställ, boka en kurs eller hör av dig — vi finns här för dig.'}
          </p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={styles.lnClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
