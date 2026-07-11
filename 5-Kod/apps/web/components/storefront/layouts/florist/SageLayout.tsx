import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './sage.module.css'

/**
 * SAGE — varmgrå/greige + mjuk salvia, luftig studio (florist-sviten, goal-58).
 * EGEN struktur-signatur bland de 13 syskonen: (1) transparent nav ÖVER en
 * full-bleed hero (literal `.hero`-sentinel + negativ margin cancellerar
 * --nav-h, samma knep som Salvia använder på ett annat tema), (2) hero med
 * liten versal-eyebrow + STOR versal-rubrik + två knappar sida vid sida (fylld
 * + outline), (3) en centrerad välkomstrad med en enda knapp, (4) en inramad
 * kategori-trio (Mest sålda/Födelsedag/Bröllop) som länkar in i butiken,
 * (5) butiks-teasers, (6) tjänster, (7) citat, (8) om, (9) galleri, (10) blogg,
 * (11) presentkort, (12) plats, (13) closing. Genomgående raka kanter (temats
 * --sf-radius = 0) och EN accentfärg — inga ornament, ingen kursiv (till
 * skillnad från Flora).
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): identiteten är orörd (färgfamilj,
 * struktur-signatur, sektionsordning) — utförandet är skärpt. Typskalan går i
 * ×1.85–2.0-steg (96 → 52 → 26 px), all mikrotext är EN nivå (12px/600/VERSALER
 * /1px), rubrikerna kör Marcellus riktiga vikt (400, inte syntetisk 700) utan
 * positiv tracking, alla bilder ligger i EN ratio (4/5 — även galleriet, som
 * annars är 1/1), radien är binär (0 på struktur, pill på knapp) och hovern är
 * 5px/400ms utan skugg-bloom. Se sage.module.css för skalan, sage.theme.ts för
 * de räknade kontrastvärdena.
 */
export function SageLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // SAGE ÄGER SINA MODULER (S10, samma kontrakt som Flora/Salvia): butik/blogg/
  // presentkort vävs in i temats egna sektioner istället för den generiska
  // sektions-stapeln — page.tsx hoppar över StorefrontModuleSections för sage
  // och förladdar teasers (loadLayoutModuleTeasers) som `modules`-prop, så
  // layouten förblir SYNKRON (onboarding-studions klient-preview renderar
  // samma komponent). Modulernas EGNA sidor är fortfarande hemmet för allt
  // innehåll — hemmet visar bara ett smakprov.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Kategori-trion och hero-knappen mot butiken länkar bara dit en sida
  // faktiskt går att nå (live ELLER paused) — annars en 404-fälla (S9). Utan
  // modules-prop (studions statiska preview) VISAS de: previewn ska se en hel
  // sida och dess länkar är ändå inte klickbara på riktigt.
  const shopReachable = modules ? modules.shopReachable : true

  // Ägaren kan ha laddat upp ett eget galleri med färre än tre bilder — falla
  // tillbaka på hero-fotot så en inramad kategori-kort aldrig får en trasig
  // bakgrund (samma skydd som Floras pelare: `galleryImages[i] ?? arch`).
  const heroFallback = content.heroImages[0] ?? ''
  const cat1 = content.galleryImages[0] ?? heroFallback
  const cat2 = content.galleryImages[1] ?? heroFallback
  const cat3 = content.galleryImages[2] ?? heroFallback

  return (
    <>
      {/* HERO — full-bleed foto, transparent nav ovanpå (.hero-sentinel) */}
      <section className={`hero ${styles.sgHero}`} aria-label="Välkommen">
        <div className={styles.sgHeroBg} style={{ backgroundImage: `url(${content.heroImages[0]})` }} />
        <div className={styles.sgHeroOverlay} />
        <div className={styles.sgHeroInner}>
          <p className={styles.sgHeroEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.sgHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.sgHeroLede}>{content.heroLede}</p>
          <div className={styles.sgHeroActions}>
            <BookCta className={styles.sgPillCta} />
            {shopReachable ? (
              <Link href="/shop" className={styles.sgHeroBtnOutline}>
                Till butiken
              </Link>
            ) : (
              <Link href="/om" className={styles.sgHeroBtnOutline}>
                Om oss
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* VÄLKOMST-RAD — centrerad rubrik + brödtext + en knapp */}
      <section className={styles.sgWelcome}>
        <Reveal className={styles.sgWelcomeInner}>
          <h2 className={styles.sgSectionTitle}>Välkommen till {tenant.name}</h2>
          <p className={styles.sgLede}>{content.aboutCopy}</p>
          <Link href="/om" className={`btn-accent ${styles.sgPillCta} ${styles.sgWelcomeCta}`}>
            Läs mer om oss
          </Link>
        </Reveal>
      </section>

      {/* KATEGORI-TRIO — inramade foton, versal-etikett under, → butiken */}
      {shopReachable ? (
        <section className={styles.sgSectionTight}>
          <div className={styles.sgCategoryGrid}>
            <Reveal>
              <Link href="/shop" className={styles.sgCategoryCard}>
                <div className={styles.sgCategoryFrame}>
                  <div className={styles.sgCategoryImg} style={{ backgroundImage: `url(${cat1})` }} />
                </div>
                <span className={styles.sgCategoryLabel}>Mest sålda</span>
              </Link>
            </Reveal>
            <Reveal delay={100}>
              <Link href="/shop" className={styles.sgCategoryCard}>
                <div className={styles.sgCategoryFrame}>
                  <div className={styles.sgCategoryImg} style={{ backgroundImage: `url(${cat2})` }} />
                </div>
                <span className={styles.sgCategoryLabel}>Födelsedag</span>
              </Link>
            </Reveal>
            <Reveal delay={200}>
              <Link href="/shop" className={styles.sgCategoryCard}>
                <div className={styles.sgCategoryFrame}>
                  <div className={styles.sgCategoryImg} style={{ backgroundImage: `url(${cat3})` }} />
                </div>
                <span className={styles.sgCategoryLabel}>Bröllop</span>
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* UR BUTIKEN — webshop-modulen invävd, bara ett smakprov */}
      {shopTeasers.length > 0 ? (
        <section className={styles.sgSection}>
          <Reveal className={styles.sgSectionHead}>
            <p className={styles.sgEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.sgSectionTitle}>{content.shopTitle ?? 'Nyheter från butiken'}</h2>
          </Reveal>
          <div className={styles.sgCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.sgCard}>
                  <div className={styles.sgCardImg} style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined} />
                  <div className={styles.sgCardBody}>
                    <h3 className={styles.sgCardName}>{p.name}</h3>
                    <span className={styles.sgCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ textAlign: 'center' }}>
            <Link href="/shop" className={styles.sgBandCta}>
              {content.shopCta ?? 'Till hela butiken'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* TJÄNSTER — numrerade rader, tom sektion visas aldrig (goal-55 8B) */}
      {rows.length > 0 ? (
        <section className={`${shared.sfServices} ${styles.sgSection}`}>
          <div className={shared.sfNarrow}>
            <Reveal className={styles.sgSectionHead}>
              <p className={styles.sgEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.sgSectionTitle}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Beställ — ${s.name}`}>
                    <span className={`${shared.sfRowNum} ${styles.sgRowNum}`} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={shared.sfRowMain}>
                      <span className={`${shared.sfRowName} ${styles.sgRowName}`}>{s.name}</span>
                      <span className={`${shared.sfRowDesc} ${styles.sgRowDesc}`}>{serviceDesc(s)}</span>
                    </span>
                    <span className={shared.sfRowMeta}>
                      <span className={`${shared.sfRowPrice} ${styles.sgRowPrice}`}>{formatPrice(s)}</span>
                      <span className={`${shared.sfRowTime} ${styles.sgRowTime}`}>{formatDuration(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal style={{ textAlign: 'center' }}>
                <a href="/tjanster" className={`${shared.sfMoreLink} ${styles.sgMoreLink}`}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* CITAT — andhämtning, upprätt (ej kursiv) */}
      <section className={styles.sgQuoteBand}>
        <Reveal>
          <p className={styles.sgQuote}>&rdquo;{content.italic}&rdquo;</p>
        </Reveal>
      </section>

      {/* OM — foto + text + statistik-trio */}
      <section>
        <div className={`${shared.sfWide} ${styles.sgAboutGrid}`}>
          <Reveal>
            <div className={styles.sgAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.sgEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.sgSectionTitle}>{content.aboutTitle}</h2>
            <p className={styles.sgAboutLede}>{content.aboutCopyHome}</p>
            <ul className={`${shared.sfStatTrio} ${styles.sgStatTrio}`}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={`${shared.sfStatValue} ${styles.sgStatValue}`}>{n}</span>
                  <span className={`${shared.sfStatLabel} ${styles.sgStatLabel}`}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* GALLERI — masonry + lightbox, tvingad in i mallens enda bildratio (4/5) */}
      <section className={`${shared.sfGalleryBand} ${styles.sgSection}`}>
        <div className={shared.sfWide}>
          <Reveal>
            <p className={`${styles.sgEyebrow} ${styles.sgGalleryEyebrow}`}>
              {content.galleryEyebrow ?? '— Galleri'}
            </p>
          </Reveal>
          <Reveal className={styles.sgGallery}>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* FRÅN BLOGGEN — blogg-modulen invävd (3 senaste) */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.sgSection}>
          <Reveal className={styles.sgSectionHead}>
            <p className={styles.sgEyebrow}>{content.blogEyebrow ?? '— Inspiration'}</p>
            <h2 className={styles.sgSectionTitle}>{content.blogTitle ?? 'Från bloggen'}</h2>
          </Reveal>
          <div className={styles.sgCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.sgCard}>
                  <div className={styles.sgCardImg} style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined} />
                  <div className={styles.sgCardBody}>
                    <h3 className={styles.sgCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.sgCardMeta}>{p.excerpt}</p> : null}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ textAlign: 'center' }}>
            <Link href="/blogg" className={styles.sgBandCta}>
              {content.blogCta ?? 'Läs fler inlägg'}
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — en smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <section className={styles.sgGiftRow}>
          <Reveal className={styles.sgGiftInner}>
            <p className={styles.sgEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.sgGiftLede}>{content.giftLede ?? 'Ge bort blommor, när som helst.'}</p>
            <a href="/presentkort" className={styles.sgBandCta} style={{ margin: 0 }}>
              {content.giftCta ?? 'Till presentkorten'}
            </a>
          </Reveal>
        </section>
      ) : null}

      {/* PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid} ${styles.sgGridPad}`}>
          <Reveal>
            <p className={styles.sgEyebrow}>{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className={styles.sgSectionTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.sgLocAddr}>{location.address}</p>
            ) : (
              <p className={styles.sgLocAddr}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={`${shared.sfHours} ${styles.sgHours}`}>
                {location.hours.map((h) => (
                  <div key={h.day} className={`${shared.sfHoursRow} ${styles.sgHoursRow}`}>
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
                  className={`${shared.sfMapLink} ${styles.sgMapLink}`}
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={`${shared.sfMapHint} ${styles.sgMapHint}`}>
                  Karta visas när adressen är ifylld.
                </span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CLOSING */}
      <section className={`${shared.sfClosing} ${styles.sgBand}`}>
        <Reveal>
          <h2 className={styles.sgClosingTitle}>
            {content.closingTitle ?? 'Redo att beställa?'}
          </h2>
          <p className={`${shared.sfClosingLead} ${styles.sgClosingLede}`}>
            {content.closingLede ?? 'Handla i butiken, boka en kurs eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.sgClosingActions}>
            <BookCta className={`${shared.sfClosingCta} ${styles.sgPillCta}`} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
