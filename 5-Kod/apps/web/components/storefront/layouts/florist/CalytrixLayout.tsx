import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { BRANSCH_BOKNING } from '../../bransch-copy'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './calytrix.module.css'

/**
 * CALYTRIX — plommon/vinröd e-handelsflorist, ombyggd från grunden (Zivars order:
 * "mallen äger ALLT som syns"). Scenen är ny; MOTORN är exakt densamma: samma
 * modul-gating (shopReachable/teasers/presentkortLive), samma Bookable/BookCta,
 * samma dataflöden. Zivars uiverse-element bär sidan — ANATOMIN är porterad
 * (struktur, rörelse, tillstånd), uttrycket kommer ur calytrix egna tokens:
 *
 *   · cir-btn (rad 4888)      → hero- och closing-CTA:n "Beställ blommor":
 *                                guldblock + pil i plommon-cirkel som glider ↗
 *   · item-hints (rad 4637)   → pulserande prick på hero-fotot som pekar in i butiken
 *   · 3D-karusellen (rad 1349)→ "BUTIKEN SOM HJÄLTE": bästsäljarna roterar som en
 *                                ring av produktkort på mörkt plommon — signaturen
 *   · cutout-kupongen (14857) → presentkortsraden som URKLIPPT kupong (perforerad
 *                                papperslapp på plommonbordet)
 *   · pushable (rad 5779)     → kupongens knapp TRYCKS ner fysiskt (3 lager:
 *                                skugga/kant/front)
 *
 * Ordning: (1) foto-hero med cir-btn + hint-prick → (2) plommonband (tagline) →
 * (3) 3D-karusellen → (4) priser som kortrutnät → (5) blogg-rad → (6) presentkorts-
 * kupongen → (7) galleri → (8) OM-bildband → (9) plats-rad → (10) closing.
 *
 * Modul-gating (LAG, testad i florist-suite.test.tsx): av modul = NOLL länkar till
 * dess sida. Hero-CTA:n länkar bara till /shop när shopReachable; annars faller den
 * tillbaka på boknings-drawern med floristens verb (aldrig "boka tid" — bransch-
 * copy äger orden). Layouten är SYNKRON (previewn kan inte rendera async).
 */
export function CalytrixLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  const shopReachable = modules ? modules.shopReachable : true

  const heroImg = content.heroImages[0] ?? ''

  // Ringen behöver 6 kort för att läsas som en RING (3 kort = en gles triangel).
  // Teasers är max 3 (LayoutModuleTeasers) → de repeteras cykliskt. Dubbletterna
  // är mus-klickbara men tas UR tabb-ordningen (tabIndex -1 + aria-hidden):
  // en skärmläsare ska höra varje produkt EN gång, inte tre.
  const RING_SLOTS = 6
  const ringSlots =
    shopTeasers.length > 0
      ? Array.from({ length: RING_SLOTS }, (_, i) => ({
          p: shopTeasers[i % shopTeasers.length]!,
          dup: i >= shopTeasers.length,
        }))
      : []

  // Pilen i cir-btn-knappen (ritad inline — CSP tillåter inga fjärr-assets).
  const cirArrow = (
    <span className={styles.calCirBtnPuck} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 18 18 6" />
        <path d="M8 6h10v10" />
      </svg>
    </span>
  )

  return (
    <div className={styles.calRoot}>
      {/* 1 — FULLBREDDS FOTO-HERO. CTA:n är cir-btn-anatomin: guldblock + pil i
          plommon-cirkel (cirkeln är mallens medvetna undantag från radie 0 — som
          badge-pillen). Hint-pricken (item-hints) pulserar över fotot och pekar
          in i butiken — bara när butiken faktiskt går att nå. */}
      <section className={styles.calHero} style={{ backgroundImage: `url(${heroImg})` }}>
        <div className={styles.calHeroScrim} aria-hidden="true" />
        <div className={styles.calHeroInner}>
          <h1 className={styles.calHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.calHeroLede}>{content.heroLede}</p>
          <div className={styles.calHeroCtaRow}>
            {shopReachable ? (
              <Link href="/shop" className={styles.calCirBtn}>
                Beställ blommor
                {cirArrow}
              </Link>
            ) : (
              /* Butiken av → boknings-drawern, med FLORISTENS verb ur bransch-
                 lagret (en florist bokar en konsultation, aldrig en "tid"). */
              <BookCta className={styles.calHeroCta} label={BRANSCH_BOKNING.florist!.cta} />
            )}
          </div>
        </div>
        {shopReachable ? (
          <Link href="/shop" className={styles.calHint} aria-label="In i butiken — se buketterna">
            <span className={styles.calHintDot} aria-hidden="true" />
            <span className={styles.calHintLabel} aria-hidden="true">
              In i butiken
            </span>
          </Link>
        ) : null}
      </section>

      {/* 2 — MÖRKT MARKNADSFÖRINGS-BAND (lyft platta, oförändrad gest) */}
      <section className={styles.calBand}>
        <p className={styles.calBandText}>{content.tagline}</p>
      </section>

      {/* 3 — BUTIKEN SOM HJÄLTE: bästsäljarna som ROTERANDE 3D-RING på mörkt
          plommon. Anatomin ur uiverse-karusellen (preserve-3d, rotateY per index,
          translateZ ut till ringens radie, oändlig rotation) — uttrycket ur mallens
          tokens (4:5-kort på surface, guldkant, plommonrum). Ringen PAUSAR vid
          hover/fokus så ett kort går att sikta på; reduced-motion fryser den helt
          (en stillastående solfjäder är fortfarande scenen). */}
      {ringSlots.length > 0 ? (
        <section className={styles.calStage}>
          <Reveal className={styles.calStageHead} as="div">
            <p className={styles.calStageEyebrow}>{content.shopEyebrow ?? '— Mest sålda'}</p>
            <h2 className={styles.calStageTitle}>{content.shopTitle ?? 'Beställ det alla vill ha'}</h2>
          </Reveal>
          <div className={styles.calRingScene}>
            <div
              className={styles.calRing}
              style={{ '--cal-ring-n': String(RING_SLOTS) } as CSSProperties}
            >
              {ringSlots.map(({ p, dup }, i) => (
                <Link
                  key={`${p.id}-${i}`}
                  href={`/shop/${p.id}`}
                  className={styles.calRingCard}
                  style={{ '--cal-ring-i': String(i) } as CSSProperties}
                  tabIndex={dup ? -1 : undefined}
                  aria-hidden={dup ? true : undefined}
                >
                  <span
                    className={styles.calRingImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                  />
                  <span className={styles.calRingName}>{p.name}</span>
                  <span className={styles.calRingPrice}>{formatShopPrice(p.priceCents, p.currency)}</span>
                </Link>
              ))}
            </div>
          </div>
          {shopReachable ? (
            <div className={styles.calStageCtaRow}>
              <Link href="/shop" className={styles.calStageCta}>
                {content.shopCta ?? 'Visa hela butiken'}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 4 — PRISER SOM RUTNÄT AV KORT (varje kort = <Bookable> — funktionen orörd) */}
      {rows.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className={styles.calSecTitle}>{content.servicesTitle}</h2>
            </div>
            {hasMore ? (
              <Link href="/tjanster" className={styles.calSecCta}>
                Se allt vi gör
              </Link>
            ) : null}
          </Reveal>
          <div className={styles.calPriceGrid}>
            {rows.map((s, i) => (
              <Reveal key={s.id} as="div" delay={i * 60}>
                <Bookable className={styles.calPriceCard} label={`Boka — ${s.name}`}>
                  <span className={styles.calPriceName}>{s.name}</span>
                  <span className={styles.calPriceDesc}>{serviceDesc(s)}</span>
                  <span className={styles.calPriceFoot}>
                    <span className={styles.calPriceValue}>{formatPrice(s)}</span>
                    <span className={styles.calPriceDur}>{formatDuration(s)}</span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5 — FRÅN BLOGGEN (samma kort-formspråk som butiken) */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.calSection}>
          <Reveal className={styles.calSecHead} as="div">
            <div>
              <p className="sf-eyebrow">{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className={styles.calSecTitle}>{content.blogTitle ?? 'Nytt från floristen'}</h2>
            </div>
            <Link href="/blogg" className={styles.calSecCta}>
              {content.blogCta ?? 'Läs hela bloggen'}
            </Link>
          </Reveal>
          <div className={styles.calScrollRow}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} as="div" delay={i * 70} className={styles.calCardSlot}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.calCard}>
                  <div className={styles.calCardImgWrap}>
                    <div
                      className={styles.calCardImg}
                      style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined}
                    />
                  </div>
                  <h3 className={styles.calCardName}>{p.title}</h3>
                  {p.excerpt ? <p className={styles.calCardMeta}>{p.excerpt}</p> : null}
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6 — PRESENTKORTET SOM URKLIPPT KUPONG (cutout-anatomin): en perforerad
          papperslapp på det mörka plommonbordet — presentkortet ÄR ju en kupong,
          så formen ljuger inte. Knappen är pushable-anatomin: tre lager
          (skugga/kant/front) och fronten TRYCKS ner fysiskt vid klick. */}
      {presentkortLive ? (
        <section className={styles.calCouponBand}>
          <Reveal className={styles.calCoupon} as="div">
            <p className={styles.calCouponKicker}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.calCouponText}>{content.giftLede ?? 'Ge bort något som blommar.'}</p>
            <Link href="/presentkort" className={styles.calPush}>
              <span className={styles.calPushShadow} aria-hidden="true" />
              <span className={styles.calPushEdge} aria-hidden="true" />
              <span className={styles.calPushFront}>{content.giftCta ?? 'Till presentkorten'}</span>
            </Link>
          </Reveal>
        </section>
      ) : null}

      {/* 7 — GALLERI (mallens 4:5-ratio + raka hörn via .calGallery-wrappern) */}
      {content.galleryImages.length > 0 ? (
        <section className={styles.calSection}>
          <div className={styles.calSecHead}>
            <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Galleri'}</p>
          </div>
          <Reveal className={`${styles.calGallery} ${styles.calGalleryWrap}`} as="div">
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </section>
      ) : null}

      {/* 8 — OM: brett bildband, texten ligger som overlay-platta i bilden */}
      <section className={styles.calAboutBand} style={{ backgroundImage: `url(${content.aboutImage})` }}>
        <div className={styles.calAboutScrim} aria-hidden="true" />
        <Reveal className={styles.calAboutPanel} as="div">
          <p className="sf-eyebrow">— Om {tenant.name}</p>
          <h2 className={styles.calAboutTitle}>{content.aboutTitle}</h2>
          <p className={styles.calAboutText}>{content.aboutCopyHome}</p>
          <ul className={styles.calAboutStats}>
            {content.stats.map(([n, l]) => (
              <li key={l}>
                <span className={styles.calStatValue}>{n}</span>
                <span className={styles.calStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* 9 — PLATS: en rad med adress · tider · karta-länk (butikens fot) */}
      <section className={styles.calLocRow}>
        <div className={styles.calLocInner}>
          <div>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta hit'}</p>
            <p className={styles.calLocAddr}>{location?.address ?? 'Adress visas snart.'}</p>
          </div>
          {location?.hours ? (
            <div className={styles.calLocHours}>
              {location.hours.map((h) => (
                <div key={h.day} className={styles.calLocHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}
          {location?.address ? (
            <a
              className={styles.calSecCta}
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Visa på karta
            </a>
          ) : null}
        </div>
      </section>

      {/* 10 — CLOSING: mörk plommonplatta. Primär = cir-btn in i butiken (gatad),
           sekundär = boknings-drawern i vinrött (funktionen får aldrig tappas —
           konsultationen ska gå att boka även från sidfotens granne). */}
      <section className={styles.calClosing}>
        <Reveal>
          <h2 className={styles.calClosingTitle}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={styles.calClosingLede}>
            {content.closingLede ?? 'Handla i butiken, boka en tjänst eller hör av dig — vi finns här.'}
          </p>
          <div className={styles.calClosingActions}>
            {shopReachable ? (
              <Link href="/shop" className={styles.calCirBtn}>
                Beställ blommor
                {cirArrow}
              </Link>
            ) : null}
            <BookCta
              className={`${styles.calHeroCta} ${shopReachable ? styles.calClosingBook : ''}`}
              label={BRANSCH_BOKNING.florist!.cta}
            />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
