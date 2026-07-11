import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './onyx.module.css'

/**
 * ONYX — mörk, dramatisk lyxflorist (Zivar: "ska kännas som ett svärd, inte en
 * mjuk morot"). EGET formspråk, ensamt i sviten om det: en smal annonsremsa, ett
 * mörkt wordmark-band med ett stiliserat EST-emblem (rent dekorativt — inget
 * påhittat årtal), en VÄNSTERSTÄLLD hero-text ovanpå en mörk bild (resten av
 * sviten centrerar sin hero — det är kontrasten), ett ljust leverans-band, en
 * mörk trio av produktbilder mot svart, mörka modul-kort, tjänster i ljus text
 * på mörk botten, om-sektion, galleri, plats och en mörk closing.
 * Webshop/blogg/presentkort vävs in via `modules`-propen (S10).
 *
 * SKÄRPE-PASSET (design-skarpa-zentum.md): mallen använder sina EGNA typroller
 * (onxEyebrow/onxTitle/onxLede/onxBody + onxBtn) i stället för de delade
 * sf-rollerna där skalan spelar roll — de delade rollerna sitter på en flack
 * ×1.2–1.3-skala som gjorde alla nivåer lika viktiga. Strukturen (grid, rader,
 * about-grid, karta) kommer fortfarande från storefront.module.css. Se CSS:en för
 * mätvärdena. Sektionsordningen är oförändrad.
 */
export function OnyxLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  // ONYX ÄGER SINA MODULER (S10): butik/blogg/presentkort vävs in i temats mörka
  // kort-språk istället för den generiska sektions-stapeln — page.tsx hoppar
  // över StorefrontModuleSections för onyx och förladdar teasers
  // (loadLayoutModuleTeasers) som `modules`-prop så layouten förblir SYNKRON
  // (onboarding-studions klient-preview renderar samma komponent). Modulernas
  // EGNA sidor är fortfarande hemmet (/shop, /blogg, /presentkort).
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Leverans-bandets knapp länkar bara till /shop när modulen går att nå
  // (live/paused) — annars en 404-fälla (S9). Utan modules-prop (studions
  // statiska preview) visas shop-vägen — previewn ska se en hel sida.
  const shopReachable = modules ? modules.shopReachable : true

  const trioImages = [
    content.galleryImages[0] ?? content.heroImages[0] ?? '',
    content.galleryImages[1] ?? content.heroImages[0] ?? '',
    content.galleryImages[2] ?? content.heroImages[0] ?? '',
  ]

  return (
    <>
      {/* 1 — ANNONSREMSA (korall, smal: accenten på en LITEN yta) */}
      <div className={styles.onxAnnounce}>
        <p>{content.utility}</p>
      </div>

      {/* 2 — MÖRKT WORDMARK-BAND — centrerat namn + rent dekorativt EST-emblem
          (ingen sifferclaim, bara ett stilgrepp — den riktiga funktionella
          navigationen är delad chrome utanför den här komponenten). */}
      <div className={styles.onxWordmark}>
        <p className={styles.onxWordmarkName}>{tenant.name}</p>
        <span className={styles.onxEstBadge} aria-hidden="true">Est</span>
      </div>

      {/* 3 — HERO, vänsterställd över en mörk bild (INTE centrerad) */}
      <section
        className={styles.onxHero}
        style={{ backgroundImage: `url(${content.heroImages[0] ?? ''})` }}
      >
        <div className={styles.onxHeroScrim} aria-hidden="true" />
        <div className={styles.onxHeroInner}>
          <Reveal>
            <span className={styles.onxEyebrow}>{content.heroEyebrow}</span>
            <h1 className={styles.onxHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.onxHeroLede}>{content.heroLede}</p>
            <div className={styles.onxHeroActions}>
              <BookCta className={styles.onxBtn} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4 — LJUST LEVERANS-BAND (bone) — hård invertering mot den svarta sidan */}
      <div className={styles.onxDeliveryBand}>
        <Reveal className={styles.onxDeliveryInner}>
          <p className={styles.onxDeliveryText}>
            Fräscha snitt, bundna för hand — och ute på väg samma dag.
          </p>
          {shopReachable ? (
            <Link href="/shop" className={styles.onxBtnInk}>
              Beställ blommor
            </Link>
          ) : (
            <BookCta className={styles.onxBtnInk} label="Boka tid" />
          )}
        </Reveal>
      </div>

      {/* 5 — MÖRK PRODUKTTRIO MOT SVART */}
      <section className={styles.onxTrioSection}>
        <Reveal className={styles.onxTrioHead}>
          <p className={styles.onxEyebrow}>{content.galleryEyebrow ?? '— I säsong'}</p>
        </Reveal>
        <div className={styles.onxTrio}>
          <Reveal>
            <div className={styles.onxTrioImg} style={{ backgroundImage: `url(${trioImages[0]})` }} />
          </Reveal>
          <Reveal delay={90}>
            <div className={styles.onxTrioImg} style={{ backgroundImage: `url(${trioImages[1]})` }} />
          </Reveal>
          <Reveal delay={180}>
            <div className={styles.onxTrioImg} style={{ backgroundImage: `url(${trioImages[2]})` }} />
          </Reveal>
        </div>
      </section>

      {/* UR BUTIKEN — webshop-modulen invävd i mörka kort. Bara ett smakprov;
          hela sortimentet bor på /shop. Tom modul → ingen sektion. */}
      {shopTeasers.length > 0 ? (
        <section className={styles.onxCardSection}>
          <Reveal className={styles.onxSecHead}>
            <p className={styles.onxEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.onxTitle}>{content.shopTitle ?? 'Beställ något dramatiskt'}</h2>
          </Reveal>
          <div className={styles.onxCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.onxCard}>
                  <div
                    className={styles.onxCardImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <h3 className={styles.onxCardName}>{p.name}</h3>
                  <p className={styles.onxCardMeta}>{formatShopPrice(p.priceCents, p.currency)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.onxSecFoot}>
            <Link href="/shop" className={styles.onxMoreLink}>
              {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* TJÄNSTER — ljus text på mörk botten. Bara när det finns aktiva
          tjänster — ingen tom-text på hemmet (goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={styles.onxServices}>
          <div className={shared.sfNarrow}>
            <Reveal className={styles.onxServicesHead}>
              <p className={styles.onxEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.onxTitle}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Boka — ${s.name}`}>
                    <span className={styles.onxRowNum} aria-hidden="true">
                      {serviceNum(i)}
                    </span>
                    <span className={shared.sfRowMain}>
                      <span className={styles.onxRowName}>{s.name}</span>
                      <span className={styles.onxRowDesc}>{serviceDesc(s)}</span>
                    </span>
                    <span className={styles.onxRowMeta}>
                      <span className={styles.onxRowPrice}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal className={styles.onxSecFoot}>
                <a href="/tjanster" className={styles.onxMoreLink}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* OM — surface-panelen bryter rytmen mot den svarta botten runt om. */}
      <section className={styles.onxAboutSection}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div className={styles.onxAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.onxEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.onxTitle}>{content.aboutTitle}</h2>
            <p className={styles.onxBody}>{content.aboutCopyHome}</p>
            <ul className={styles.onxStats}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.onxStatValue}>{n}</span>
                  <span className={styles.onxStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* FRÅN BLOGGEN — blogg-modulen invävd i mörka kort (3 senaste → /blogg).
          Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.onxCardSection}>
          <Reveal className={styles.onxSecHead}>
            <p className={styles.onxEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.onxTitle}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
          </Reveal>
          <div className={styles.onxCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.onxCard}>
                  <div
                    className={styles.onxCardImg}
                    style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                  />
                  <h3 className={styles.onxCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.onxCardMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.onxSecFoot}>
            <Link href="/blogg" className={styles.onxMoreLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — en smal rad i temats ton, aldrig en hel sektion. */}
      {presentkortLive ? (
        <div className={styles.onxGiftRow}>
          <Reveal className={styles.onxGiftInner}>
            <p className={`${styles.onxEyebrow} ${styles.onxGiftEyebrow}`}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.onxGiftLede}>{content.giftLede ?? 'Ge bort något som sticker ut.'}</p>
            <Link href="/presentkort" className={`${styles.onxMoreLink} ${styles.onxGiftLink}`}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

      {/* GALLERI — masonry + lightbox (samma 4/5-ratio som resten av mallen) */}
      <section className={styles.onxGallery}>
        <div className={shared.sfWide}>
          <Reveal className={styles.onxGalleryHead}>
            <p className={styles.onxEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* PLATS & ÖPPETTIDER */}
      <section className={styles.onxLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className={styles.onxEyebrow}>{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.onxTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.onxBody}>{location.address}</p>
            ) : (
              <p className={styles.onxBody}>Adress visas snart.</p>
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

      {/* CLOSING — mörk yta, EN korall-pill (accenten stannar på små ytor) */}
      <section className={styles.onxClosing}>
        <Reveal className={styles.onxClosingInner}>
          <h2 className={styles.onxTitle}>
            {content.closingTitle ?? 'Redo för något som sticker ut?'}
          </h2>
          <p className={styles.onxClosingLede}>
            {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.onxClosingActions}>
            <BookCta className={styles.onxBtn} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
