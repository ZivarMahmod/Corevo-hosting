import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './aurora.module.css'

/**
 * AURORA — LEKFULL BOUTIQUE i korall (florist-sviten, goal-58 → tema-paket goal-59).
 *
 * Hemmet är HELT Auroras eget: NOLL delade .sf*-klasser (det var där alla 13 mallar
 * blev samma sida i olika färg). Kompositionen:
 *   annonsrad → bred landskaps-hero med rund "Handla nu"-cirkel ovanpå bilden →
 *   korall-band med EN mening → valv-collage i förskjuten grid → butik som RUNDADE
 *   HÖGA kort → priser i TVÅ mjuka kolumner → om med valv-foto → presentkort-rad →
 *   blogg → plats som mjukt kort → closing på mörk korall.
 *
 * Modul-gatingen är oförändrad: teasers renderas bara när de finns, presentkortet är
 * en smal rad, cirkelknappen bara när shoppen är nåbar. Layouten är SYNKRON.
 */
export function AuroraLayout({ tenant, content, services, location, modules }: StorefrontLayoutProps) {
  const rows = services.slice(0, 6)
  const hasMore = services.length > 6

  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  const presentkortLive = modules?.presentkortLive ?? false
  // Utan modules-prop (studions statiska preview) VISAS cirkelknappen — previewn
  // ska se en hel sida även om länken inte är klickbar på riktigt (S9-mönstret).
  const shopReachable = modules ? modules.shopReachable : true

  const [hero1, hero2, hero3] = [
    content.heroImages[0] ?? '',
    content.heroImages[1] ?? content.heroImages[0] ?? '',
    content.heroImages[2] ?? content.heroImages[0] ?? '',
  ]
  const collage = [
    hero2,
    content.galleryImages[0] ?? hero1,
    content.galleryImages[1] ?? hero1,
    hero3,
    content.galleryImages[2] ?? hero1,
    content.galleryImages[3] ?? hero1,
  ]

  return (
    <div className={styles.auRoot}>
      {/* 1 — TUNN KORALL-ANNONSRAD */}
      <div className={styles.auAnnounce}>
        <p className={styles.auAnnounceText}>{content.utility}</p>
      </div>

      {/* 2 — BRED LANDSKAPS-HERO med rund "Handla nu"-cirkelknapp uppe till höger */}
      <section className={styles.auHero}>
        <div className={styles.auHeroFrame}>
          <div className={styles.auHeroImg} style={{ backgroundImage: `url(${hero1})` }}>
            <div className={styles.auHeroScrim} />
            <div className={styles.auHeroContent}>
              <p className={styles.auHeroEyebrow}>{content.heroEyebrow}</p>
              <h1 className={styles.auHeroTitle}>{content.heroTitle}</h1>
              <p className={styles.auHeroLede}>{content.heroLede}</p>
              <div className={styles.auHeroActions}>
                <BookCta className={styles.auBtn} />
              </div>
            </div>
            {shopReachable ? (
              <Link href="/shop" className={styles.auShopCircle}>
                <span>Handla nu</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* 3 — KORALL-BAND: en mening + liten inverterad CTA */}
      <section className={styles.auStatement}>
        <Reveal>
          <p className={styles.auStatementText}>{content.tagline}</p>
          <BookCta className={`${styles.auBtn} ${styles.auStatementCta}`} />
        </Reveal>
      </section>

      {/* 4 — ROSA PANEL: förskjutet, asymmetriskt valv-collage */}
      <section className={styles.auCollageBand}>
        <Reveal className={styles.auCollageHead}>
          <p className={styles.auEyebrow}>{content.galleryEyebrow ?? '— Från studion'}</p>
        </Reveal>
        <div className={styles.auCollageGrid}>
          {collage.map((src, i) => (
            <Reveal key={`${src}-${i}`} delay={i * 70} className={styles.auCollageItem} style={{ backgroundImage: `url(${src})` }}>
              <span />
            </Reveal>
          ))}
        </div>
      </section>

      {/* 5 — UR BUTIKEN — rundade HÖGA kort (3:4) */}
      {shopTeasers.length > 0 ? (
        <section className={styles.auSection}>
          <Reveal className={styles.auSecHead}>
            <p className={styles.auEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className={styles.auH2}>{content.shopTitle ?? 'Handla något fint'}</h2>
          </Reveal>
          <div className={styles.auCardGrid}>
            {shopTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={`/shop/${p.id}`} className={styles.auCard}>
                  <div className={styles.auCardImg} style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined} />
                  <div className={styles.auCardBody}>
                    <h3 className={styles.auCardName}>{p.name}</h3>
                    <p className={styles.auCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.auSecHead}>
            <Link href="/shop" className={styles.auBandCta}>{content.shopCta ?? 'Se hela butiken'}</Link>
          </Reveal>
        </section>
      ) : null}

      {/* 6 — PRISER I TVÅ MJUKA KOLUMNER (Auroras egen prislista, ingen delad rad-lista) */}
      {rows.length > 0 ? (
        <section className={styles.auSection}>
          <Reveal className={styles.auSecHead}>
            <p className={styles.auEyebrow}>{content.servicesEyebrow}</p>
            <h2 className={styles.auH2}>{content.servicesTitle}</h2>
          </Reveal>
          <div className={styles.auPriceCols}>
            {rows.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Bookable className={styles.auPriceRow} label={`Beställ — ${s.name}`}>
                  <span className={styles.auRowNum} aria-hidden="true">{serviceNum(i)}</span>
                  <span className={styles.auPriceMain}>
                    <span className={styles.auRowName}>{s.name}</span>
                    <span className={styles.auRowDesc}>{serviceDesc(s)}</span>
                  </span>
                  <span className={styles.auRowPrice}>{formatPrice(s)}</span>
                </Bookable>
              </Reveal>
            ))}
          </div>
          {hasMore ? (
            <Reveal className={styles.auSecHead}>
              <Link href="/tjanster" className={styles.auBandCta}>Se allt vi gör</Link>
            </Reveal>
          ) : null}
        </section>
      ) : null}

      {/* 7 — OM — valv-foto + berättelse + kursiv värmefras + stat-trio */}
      <section className={styles.auSection}>
        <div className={styles.auAboutGrid}>
          <Reveal>
            <div className={styles.auAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.auEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.auH2}>{content.aboutTitle}</h2>
            <p className={styles.auBody}>{content.aboutCopyHome}</p>
            <p className={styles.auItalicLine}>”{content.italic}”</p>
            <ul className={styles.auStats}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={styles.auStatValue}>{n}</span>
                  <span className={styles.auStatLabel}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 8 — PRESENTKORT — en smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <section className={styles.auGiftBand}>
          <Reveal className={styles.auGiftInner}>
            <p className={styles.auEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.auGiftLede}>{content.giftLede ?? 'Ge bort blomsterglädje, när som helst.'}</p>
            <Link href="/presentkort" className={styles.auBandCta}>{content.giftCta ?? 'Köp presentkort'}</Link>
          </Reveal>
        </section>
      ) : null}

      {/* 9 — FRÅN BLOGGEN */}
      {bloggTeasers.length > 0 ? (
        <section className={styles.auSection}>
          <Reveal className={styles.auSecHead}>
            <p className={styles.auEyebrow}>{content.blogEyebrow ?? '— Bloggen'}</p>
            <h2 className={styles.auH2}>{content.blogTitle ?? 'Nyheter & inspiration'}</h2>
          </Reveal>
          <div className={styles.auCardGrid}>
            {bloggTeasers.map((p, i) => (
              <Reveal key={p.id} delay={i * 90}>
                <Link href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.auCard}>
                  <div className={styles.auCardImg} style={p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined} />
                  <div className={styles.auCardBody}>
                    <h3 className={styles.auCardName}>{p.title}</h3>
                    {p.excerpt ? <p className={styles.auCardMeta}>{p.excerpt}</p> : null}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.auSecHead}>
            <Link href="/blogg" className={styles.auBandCta}>{content.blogCta ?? 'Läs fler inlägg'}</Link>
          </Reveal>
        </section>
      ) : null}

      {/* 10 — PLATS & ÖPPETTIDER — Auroras eget mjuka kort */}
      <section className={styles.auSection}>
        <Reveal className={styles.auLocCard}>
          <div className={styles.auLocGrid}>
            <div>
              <p className={styles.auEyebrow}>{content.findEyebrow ?? '— Hitta hit'}</p>
              <h2 className={styles.auH2}>
                {location?.address ? location.address.split(',')[0] : tenant.name}
              </h2>
              {location?.address ? (
                <p className={styles.auBody}>{location.address}</p>
              ) : (
                <p className={styles.auBody}>Adress visas snart.</p>
              )}
              {location?.address ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.auBandCta}
                >
                  Visa på karta
                </a>
              ) : null}
            </div>
            <div>
              {location?.hours ? (
                <div className={styles.auHours}>
                  {location.hours.map((h) => (
                    <p key={h.day} className={styles.auHoursRow}>
                      <span>{h.day}</span>
                      <span>{h.time}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className={styles.auBody}>Öppettider visas snart.</p>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* 11 — CLOSING på mörk korall (vit rubrik = 7.27:1) */}
      <section className={styles.auClosing}>
        <Reveal>
          <h2 className={styles.auClosingTitle}>{content.closingTitle ?? 'Redo att beställa?'}</h2>
          <p className={styles.auClosingLede}>
            {content.closingLede ?? 'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.auClosingActions}>
            <BookCta className={`${styles.auBtn} ${styles.auStatementCta}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
