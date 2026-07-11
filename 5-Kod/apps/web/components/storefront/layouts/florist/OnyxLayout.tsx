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
 * mjuk morot"). EGET formspråk, ensamt i sviten om det: en mint-annonsrad, ett
 * mörkt wordmark-band med ett stiliserat EST-emblem (rent dekorativt — inget
 * påhittat årtal), en VÄNSTERSTÄLLD hero-text ovanpå en mörk bild (resten av
 * sviten centrerar sin hero — det är kontrasten), ett mintgrönt leverans-band,
 * en mörk trio av produktbilder mot svart, mörka modul-kort, tjänster i ljus
 * text på mörk botten, om-sektion, galleri, plats och en korall closing.
 * Webshop/blogg/presentkort vävs in via `modules`-propen (S10).
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
      {/* 1 — MINT ANNONSRAD */}
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
            <span className="sf-eyebrow">{content.heroEyebrow}</span>
            <h1 className={styles.onxHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.onxHeroLede}>{content.heroLede}</p>
            <div className={styles.onxHeroActions}>
              <BookCta className={styles.onxHeroCta} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4 — MINTGRÖNT LEVERANS-BAND */}
      <div className={styles.onxDeliveryBand}>
        <Reveal className={styles.onxDeliveryInner}>
          <p className={styles.onxDeliveryText}>
            Fräscha snitt, bundna för hand — och ute på väg samma dag.
          </p>
          {shopReachable ? (
            <Link href="/shop" className={styles.onxDeliveryCta}>
              Beställ blommor
            </Link>
          ) : (
            <BookCta className={styles.onxDeliveryCta} label="Boka tid" />
          )}
        </Reveal>
      </div>

      {/* 5 — MÖRK PRODUKTTRIO MOT SVART */}
      <section className={styles.onxTrioSection}>
        <Reveal className={styles.onxTrioHead}>
          <p className="sf-eyebrow">{content.galleryEyebrow ?? '— I säsong'}</p>
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
            <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.onxSecTitle}>{content.shopTitle ?? 'Beställ något dramatiskt'}</h2>
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
          <Reveal className={styles.onxSecHead}>
            <Link href="/shop" className={shared.sfMoreLink}>
              {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* TJÄNSTER — ljus text på mörk botten. Bara när det finns aktiva
          tjänster — ingen tom-text på hemmet (goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={shared.sfServices}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className={styles.onxTitleLg}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Boka — ${s.name}`}>
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

      {/* OM — surface-panelen bryter rytmen mot den svarta botten runt om. */}
      <section className={styles.onxAboutSection}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div className={shared.sfAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className={styles.onxSecTitle}>{content.aboutTitle}</h2>
            <p className="sf-body" style={{ marginTop: 16 }}>
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

      {/* FRÅN BLOGGEN — blogg-modulen invävd i mörka kort (3 senaste → /blogg).
          Tom modul → ingen sektion. */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.onxCardSection}>
          <Reveal className={styles.onxSecHead}>
            <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
            <h2 className={styles.onxSecTitle}>{content.blogTitle ?? 'Säsong, tips & inspiration'}</h2>
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
          <Reveal className={styles.onxSecHead}>
            <Link href="/blogg" className={shared.sfMoreLink}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* PRESENTKORT — en smal rad i temats ton, aldrig en hel sektion. */}
      {presentkortLive ? (
        <div className={styles.onxGiftRow}>
          <Reveal className={styles.onxGiftInner}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>
              {content.giftEyebrow ?? '— Presentkort'}
            </p>
            <p className={styles.onxGiftLede}>{content.giftLede ?? 'Ge bort något som sticker ut.'}</p>
            <Link href="/presentkort" className={shared.sfMoreLink} style={{ marginTop: 0 }}>
              {content.giftCta ?? 'Till presentkorten'}
            </Link>
          </Reveal>
        </div>
      ) : null}

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

      {/* PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta till butiken'}</p>
            <h2 className={styles.onxSecTitle}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className="sf-body" style={{ marginTop: 6 }}>
                {location.address}
              </p>
            ) : (
              <p className="sf-body" style={{ marginTop: 6 }}>
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

      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className={styles.onxTitleLg} style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto' }}>
            {content.closingTitle ?? 'Redo för något som sticker ut?'}
          </h2>
          <p className={shared.sfClosingLead}>
            {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
