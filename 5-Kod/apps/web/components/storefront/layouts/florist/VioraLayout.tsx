import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './viora.module.css'

/**
 * VIORA — djup violett + krämvit, modern boutique (Zivar: "ska kännas som ett
 * svärd, inte en mjuk morot"). EGET formspråk, signaturen är kompositionen:
 * (1) hero som 50/50 SPLIT — textplatta i temats primärfärg till vänster,
 * bild till höger utan text ovanpå, (2) en rad med fyra funktionella
 * ikonlänkar (Mest sålda/Växter → butiken, Floristens val → bokningsdrawern,
 * Leveransorter → ankarlänk till plats-bandet längre ner — aldrig en 404-fälla
 * mot en avstängd modul), (3) citat-band, (4) ETT STORT 2-kolumners
 * butikskort-grid med markant större bilder än resten av sviten, (5) tjänster,
 * (6) om, (7) presentkort, (8) blogg i ett mindre 3-kolumners grid (kontrasten
 * mot butikens stora kort är avsiktlig), (9) galleri, (10) plats, (11) closing.
 * Webshop/blogg/presentkort vävs in via `modules`-propen (S10).
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md) — TYPOGRAFIN ÄR MALLENS EGEN. De globala
 * rollerna .sf-h1/.sf-h2/.sf-eyebrow/.sf-body (tokens.css) är en ×1.2–1.5-skala:
 * hero 83 → h1 56 → h2 34 → kort 24 → 16px. Allt blir mellanstort, ögat hittar
 * ingen ingång — moroten. Viora kör sin egen ×2-skala ur viora.module.css i
 * stället: 108 → 52 → 26 → 18 → 16 | 11–12px mikro. Sektionsstrukturen
 * (shared.sfServices/sfAboutGrid/sfLocBand/sfGalleryBand/sfClosing) är kvar —
 * bara typografin, radien, bildratiot (allt 4:5) och rytmen (12/20/32/48/144)
 * är våra. Noll typografiska inline-styles: skalan bor i CSS:en, inte i markupen.
 */
export function VioraLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // VIORA ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats
  // egna kort-språk istället för den generiska sektions-stapeln — page.tsx
  // hoppar över StorefrontModuleSections för viora och förladdar teasers
  // (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir SYNKRON
  // (onboarding-studions klient-preview renderar samma komponent). Modulernas
  // EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Ikonlänkarnas butiks-genvägar länkar bara dit /shop faktiskt går att nå
  // (live/paused renderar; av/draft → notFound) — annars en 404-fälla (S9).
  // Utan modules-prop (studions statiska preview) visas alla fyra — previewn
  // ska se en hel sida, och dess länkar är ändå inte klickbara på riktigt.
  const shopReachable = modules ? modules.shopReachable : true

  const heroPhoto = content.heroImages[0] ?? content.heroImages[1] ?? ''

  return (
    <>
      {/* 1 — HERO, 50/50 split: färgad platta till vänster, bild till höger. Ingen
          text ovanpå bilden — bildhalvan är ren fotografi. */}
      <section className={styles.vioHero}>
        <div className={styles.vioHeroPanel}>
          <Reveal>
            <p className={styles.vioHeroEyebrow}>{content.heroEyebrow}</p>
            <h1 className={styles.vioHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.vioHeroLede}>{content.heroLede}</p>
            <div className={styles.vioHeroActions}>
              <BookCta className={styles.vioHeroCta} />
              {shopReachable ? (
                <Link href="/shop" className={styles.vioHeroSecondary}>
                  Till butiken <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
        <div className={styles.vioHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }} />
      </section>

      {/* 2 — IKONLÄNKAR — fyra funktionella genvägar in i verksamheten */}
      <nav className={styles.vioLinks} aria-label="Genvägar">
        {shopReachable ? (
          <Link href="/shop" className={styles.vioLinkItem}>
            <svg className={styles.vioLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l2.4 5.2 5.6.6-4.2 3.9 1.2 5.6L12 15.9 6.9 18.3l1.2-5.6L3.9 8.8l5.6-.6L12 3z" />
            </svg>
            <span className={styles.vioLinkLabel}>Mest sålda</span>
            <span className={styles.vioLinkDesc}>Våra mest populära buketter</span>
          </Link>
        ) : null}
        {shopReachable ? (
          <Link href="/shop" className={styles.vioLinkItem}>
            <svg className={styles.vioLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20c8-1 14-7 15-15C11 6 5 12 4 20z" />
              <path d="M4 20c2-4 5-7 9-9" />
            </svg>
            <span className={styles.vioLinkLabel}>Växter</span>
            <span className={styles.vioLinkDesc}>Krukväxter för hem och kontor</span>
          </Link>
        ) : null}
        <Bookable className={styles.vioLinkItem} label="Beställ floristens val">
          <svg className={styles.vioLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z" />
            <path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" />
          </svg>
          <span className={styles.vioLinkLabel}>Floristens val</span>
          <span className={styles.vioLinkDesc}>Låt floristen välja åt dig</span>
        </Bookable>
        <a href="#hitta" className={styles.vioLinkItem}>
          <svg className={styles.vioLinkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s7-7.2 7-12a7 7 0 10-14 0c0 4.8 7 12 7 12z" />
            <circle cx="12" cy="9" r="2.3" />
          </svg>
          <span className={styles.vioLinkLabel}>Leveransorter</span>
          <span className={styles.vioLinkDesc}>Se var vi levererar</span>
        </a>
      </nav>

      {/* 3 — CITAT-BAND */}
      <section className={styles.vioQuoteBand}>
        <Reveal>
          <span className={styles.vioQuoteMark} aria-hidden="true">”</span>
          <p className={styles.vioQuote}>{content.italic}</p>
        </Reveal>
      </section>

      {/* 4 — UR BUTIKEN — STORT 2-kolumners kort-grid, medvetet större bilder än
          resten av sviten. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.vioShopSection}>
          <Reveal className={styles.vioSecHead}>
            <p className={styles.vioEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.vioH2}>{content.shopTitle ?? 'Handplockat till dig'}</h2>
          </Reveal>
          <div className={styles.vioShopGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.vioShopCard}>
                  <div
                    className={styles.vioShopImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <div className={styles.vioShopBody}>
                    <span className={styles.vioShopName}>{p.name}</span>
                    <span className={styles.vioShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.vioSecHead}>
            <Link href="/shop" className={styles.vioMoreLink}>
              {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 5 — TJÄNSTER — bara när det finns aktiva tjänster, ingen tom-text på
          hemmet (goal-55 8B). Delad rad-struktur, viora-typografi. */}
      {rows.length > 0 ? (
        <section className={`${shared.sfServices} ${styles.vioServices}`}>
          <div className={shared.sfNarrow}>
            <Reveal className={styles.vioSecHead}>
              <p className={styles.vioEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.vioH2}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Boka — ${s.name}`}>
                    <span className={`${shared.sfRowNum} ${styles.vioRowNum}`} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={shared.sfRowMain}>
                      <span className={styles.vioRowName}>{s.name}</span>
                      <span className={styles.vioRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={shared.sfRowMeta}>
                      <span className={styles.vioRowPrice}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal className={styles.vioSecHead}>
                <a href="/tjanster" className={styles.vioMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 6 — OM — delad grid-struktur (fotot är redan 4:5 = mallens enda ratio) */}
      <section>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid} ${styles.vioAboutGrid}`}>
          <Reveal>
            <div className={shared.sfAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.vioEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.vioH2}>{content.aboutTitle}</h2>
            <p className={styles.vioBody}>{content.aboutCopyHome}</p>
            <ul className={shared.sfStatTrio}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.vioStatValue}>{n}</span>
                  <span className={styles.vioStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 7 — PRESENTKORT — en smal rad i primärfärg, aldrig en hel sektion. */}
      {presentkortLive ? (
        <div className={styles.vioGiftRow}>
          <Reveal className={styles.vioGiftInner}>
            <p className={styles.vioGiftEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.vioGiftLede}>{content.giftLede ?? 'Ge bort en blomstrande stund.'}</p>
            <Link href="/presentkort" className={styles.vioGiftCta}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* 8 — FRÅN BLOGGEN — mindre 3-kolumners teaser-grid (kontrast mot butikens
          stora kort är avsiktlig — men SAMMA 4:5-format). Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.vioTeaserSection}>
          <Reveal className={styles.vioSecHead}>
            <p className={styles.vioEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.vioH2}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
          </Reveal>
          <div className={styles.vioTeaserGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.vioTeaserCard}>
                  <div
                    className={styles.vioTeaserImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.vioTeaserTitle}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.vioTeaserExcerpt}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.vioSecHead}>
            <Link href="/blogg" className={styles.vioMoreLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 9 — GALLERI — masonry + lightbox, tvingat till mallens 4:5 (viora.module.css) */}
      <section className={`${shared.sfGalleryBand} ${styles.vioGallery}`}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className={styles.vioEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* 10 — PLATS & ÖPPETTIDER — id="hitta" är målet för ikonlänken "Leveransorter"
          ovan (samma-sida-ankare, aldrig en 404-fälla). */}
      <section id="hitta" className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid} ${styles.vioLocGrid}`}>
          <Reveal>
            <p className={styles.vioEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.vioH2}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.vioBody}>{location.address}</p>
            ) : (
              <p className={styles.vioBody}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={`${shared.sfHoursRow} ${styles.vioHoursRow}`}>
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
                  className={styles.vioMapLink}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={styles.vioMapHint}>Karta visas när adressen är ifylld.</span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 11 — CLOSING */}
      <section className={`${shared.sfClosing} ${styles.vioClosing}`}>
        <Reveal>
          <h2 className={styles.vioClosingTitle}>
            {content.closingTitle ?? 'Blommor för din dag?'}
          </h2>
          <p className={styles.vioClosingLede}>
            {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.vioClosingActions}>
            <BookCta className={`${shared.sfClosingCta} ${styles.vioClosingCta}`} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
