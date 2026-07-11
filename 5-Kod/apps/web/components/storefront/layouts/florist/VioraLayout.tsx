import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Gallery } from '../../Gallery'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './viora.module.css'

/**
 * VIORA — djup violett + krämvit, modern boutique. HELT TEMA-PAKET (goal-59):
 * mallen äger sitt sidhuvud (viora.chrome), sin sidfot, sina undersidor
 * (viora.pages) OCH hela hemmet. NOLL delade .sf*-klasser — hemmets nedre halva
 * var där alla mallar blev samma sida, så varje sektion nedan är mallens egen.
 *
 * KOMPOSITIONEN är signaturen (inte färgen):
 *   1  hero = 50/50 SPLIT — violett textplatta | rent foto (aldrig text i bilden)
 *   2  fyra funktionella IKON-GENVÄGAR i en rad med hårlinjer emellan
 *   3  citat-band på accent-plattan
 *   4  butiken = STORT 2-kolumners kort-grid (störst bilder i hela sviten)
 *   5  tjänster = KORT-GRID med pris i kortet (ingen rad-prislista i hela mallen)
 *   6  om = split, spegelvänd mot heron (foto | text) + stats i kort
 *   7  presentkort = smal violett rad, aldrig en hel sektion
 *   8  bloggen = mindre 3-kolumners kort-grid (kontrasten mot butiken är avsiktlig)
 *   9  galleri
 *  10  plats & öppettider = split (tider-kort | kart-panel), id="hitta"
 *  11  closing = violett platta
 * Webshop/blogg/presentkort vävs in via `modules`-propen (S10); layouten förblir
 * SYNKRON (studions klient-preview renderar samma komponent).
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): egen typskala 108 → 52 → 26 → 16 → 12px
 * (steg ×2.08/×2.00/×1.63/×1.33), rubrik-lh ≤1.15 mot bröd-lh ≥1.55, ETT bildformat
 * (4:5), binär radie (0 eller pill), EN accent. Allt bor i viora.module.css — noll
 * typografiska inline-styles i markupen.
 */
export function VioraLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Butiks-genvägarna länkar bara dit /shop faktiskt går att nå (live/paused renderar;
  // av/draft → notFound) — annars en 404-fälla. Utan modules-prop (studions statiska
  // preview) visas alla fyra: previewn ska se en hel sida.
  const shopReachable = modules ? modules.shopReachable : true

  const heroPhoto = content.heroImages[0] ?? content.heroImages[1] ?? ''

  return (
    <>
      {/* 1 — HERO, 50/50 split: färgad platta till vänster, rent foto till höger. */}
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

      {/* 4 — UR BUTIKEN — STORT 2-kolumners kort-grid. Tom modul → ingen sektion. */}
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

      {/* 5 — TJÄNSTER — mallens KORT-GRID (pris i kortet, aldrig en rad-prislista).
          Bara när det finns aktiva tjänster: ingen tom-text på hemmet (goal-55 8B). */}
      {rows.length > 0 ? (
        <section className={styles.vioSvcSection}>
          <Reveal className={styles.vioSecHead}>
            <p className={styles.vioEyebrow}>{content.servicesEyebrow}</p>
            <h2 className={styles.vioH2}>{content.servicesTitle}</h2>
          </Reveal>
          <div className={styles.vioSvcGrid}>
            {rows.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Bookable className={styles.vioSvcCard} label={`Boka — ${s.name}`}>
                  <span className={styles.vioSvcTop}>
                    <span className={styles.vioSvcName}>{s.name}</span>
                    <span className={styles.vioSvcPrice}>{formatPrice(s)}</span>
                  </span>
                  <span className={styles.vioSvcDesc}>{serviceDesc(s)}</span>
                  <span className={styles.vioSvcMeta}>
                    <span className={styles.vioSvcDur}>{formatDuration(s)}</span>
                    <span className={styles.vioSvcBook} aria-hidden="true">
                      Boka <span>→</span>
                    </span>
                  </span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          {hasMore ? (
            <Reveal className={styles.vioSecHead}>
              <Link href="/tjanster" className={styles.vioMoreLink}>
                Se allt vi gör <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 6 — OM — mallens EGNA split (foto | text), spegelvänd mot heron. Stats i kort. */}
      <section className={styles.vioAbout}>
        <Reveal>
          <div
            className={styles.vioAboutPhoto}
            style={content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined}
          />
        </Reveal>
        <Reveal delay={120} className={styles.vioAboutText}>
          <p className={styles.vioEyebrow}>— Om {tenant.name}</p>
          <h2 className={styles.vioH2}>{content.aboutTitle}</h2>
          <p className={styles.vioBody}>{content.aboutCopyHome}</p>
          <ul className={styles.vioStatGrid}>
            {content.stats.map(([n, l]) => (
              <li key={l} className={styles.vioStatCard}>
                <span className={styles.vioStatValue}>{n}</span>
                <span className={styles.vioStatLabel}>{l}</span>
              </li>
            ))}
          </ul>
        </Reveal>
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

      {/* 8 — FRÅN BLOGGEN — mindre 3-kolumners kort-grid, SAMMA 4:5-format som butiken. */}
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

      {/* 9 — GALLERI — mallens egen band-yta, brickorna tvingade till 4:5 i CSS:en */}
      <section className={styles.vioGallery}>
        <div className={styles.vioGalleryInner}>
          <Reveal>
            <p className={styles.vioEyebrow}>{content.galleryEyebrow ?? '— Galleri'}</p>
          </Reveal>
          <Reveal>
            <Gallery photos={content.galleryImages.map((src) => ({ src, alt: 'Galleribild' }))} />
          </Reveal>
        </div>
      </section>

      {/* 10 — PLATS & ÖPPETTIDER — mallens egen split. id="hitta" är målet för
          ikonlänken "Leveransorter" ovan (samma-sida-ankare, aldrig en 404-fälla). */}
      <section id="hitta" className={styles.vioLocSection}>
        <div className={styles.vioLocGrid}>
          <Reveal className={styles.vioLocCard}>
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
              <div className={styles.vioHoursList}>
                {location.hours.map((h) => (
                  <div key={h.day} className={styles.vioHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={120} className={styles.vioMapPanel}>
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
          </Reveal>
        </div>
      </section>

      {/* 11 — CLOSING — violett platta (samma som undersidornas avslutning) */}
      <section className={styles.vioClosing}>
        <Reveal className={styles.vioClosingInner}>
          <h2 className={styles.vioClosingTitle}>{content.closingTitle ?? 'Blommor för din dag?'}</h2>
          <p className={styles.vioClosingLede}>
            {content.closingLede ?? 'Beställ, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.vioClosingActions}>
            <BookCta className={styles.vioClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
