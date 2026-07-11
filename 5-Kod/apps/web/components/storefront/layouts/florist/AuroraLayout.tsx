import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, serviceDesc, serviceNum } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import shared from '../../storefront.module.css'
import styles from './aurora.module.css'

/**
 * AURORA — korall/laxrosa på varmvitt florist-mall (florist-sviten, goal-58).
 * EGET formspråk: tunn korall-annonsrad, bred landskaps-hero med en rund
 * "Handla nu"-cirkelknapp ovanpå bilden, ett korall-band med en fet mening +
 * liten CTA, en rosa panel med ett förskjutet asymmetriskt valv-collage — och
 * DÄREFTER de invävda modulerna (butik/blogg/presentkort) i samma varma,
 * runda formspråk. Webshop/blogg/presentkort vävs in via `modules`-propen (S10),
 * precis som Flora — Aurora äger sina moduler (THEME_OWNS_MODULES).
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
  // Collagets sex valv: två ur hero-arrayen + fyra ur galleriet — förskjutet i
  // CSS (alternerande höjd, marginal och valv-riktning), inte i markupen.
  const collage = [
    hero2,
    content.galleryImages[0] ?? hero1,
    content.galleryImages[1] ?? hero1,
    hero3,
    content.galleryImages[2] ?? hero1,
    content.galleryImages[3] ?? hero1,
  ]

  return (
    <>
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
              <span className={shared.sfPillEyebrow}>{content.heroEyebrow}</span>
              <h1 className={styles.auHeroTitle}>{content.heroTitle}</h1>
              <p className={styles.auHeroLede}>{content.heroLede}</p>
              <div className={styles.auHeroActions}>
                <BookCta />
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

      {/* 3+4 — KORALL-BAND med fet mening + liten centrerad CTA */}
      <section className={styles.auStatement}>
        <Reveal>
          <p className={styles.auStatementText}>{content.tagline}</p>
          <BookCta className={styles.auStatementCta} label="Boka tid" />
        </Reveal>
      </section>

      {/* 5 — ROSA PANEL: förskjutet, asymmetriskt valv-collage */}
      <section className={styles.auCollageBand}>
        <Reveal className={styles.auCollageHead}>
          <p className="sf-eyebrow">{content.galleryEyebrow ?? '— Från studion'}</p>
        </Reveal>
        <div className={styles.auCollageGrid}>
          {collage.map((src, i) => (
            <Reveal key={`${src}-${i}`} delay={i * 70} className={styles.auCollageItem} style={{ backgroundImage: `url(${src})` }}>
              <span />
            </Reveal>
          ))}
        </div>
      </section>

      {/* 6 — UR BUTIKEN — webshop-modulen invävd (max 3 teasers) */}
      {shopTeasers.length > 0 ? (
        <section style={{ paddingBottom: 'clamp(44px, 6vw, 84px)', paddingTop: 'clamp(44px, 6vw, 84px)' }}>
          <Reveal className={styles.auSecHead}>
            <p className="sf-eyebrow">{content.shopEyebrow ?? '— Ur butiken'}</p>
            <h2 className="sf-h2" style={{ marginTop: 10 }}>{content.shopTitle ?? 'Handla något fint'}</h2>
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

      {/* 7 — TJÄNSTER — bara när det finns aktiva tjänster (goal-55 8B) */}
      {rows.length > 0 ? (
        <section className={shared.sfServices}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className="sf-eyebrow">{content.servicesEyebrow}</p>
              <h2 className="sf-h1" style={{ marginTop: 12 }}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Beställ — ${s.name}`}>
                    <span className={styles.auRowNum} aria-hidden="true">{serviceNum(i)}</span>
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

      {/* 8 — OM — rundad bild + berättelse + kursiv värmefras + stat-trio */}
      <section style={{ paddingTop: 'clamp(44px, 7vw, 84px)', paddingBottom: 'clamp(44px, 7vw, 84px)' }}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div className={styles.auAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className="sf-eyebrow">— Om {tenant.name}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>{content.aboutTitle}</h2>
            <p className="sf-body" style={{ fontSize: 17, marginTop: 16 }}>{content.aboutCopyHome}</p>
            <p className={styles.auItalicLine}>”{content.italic}”</p>
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

      {/* 9 — PRESENTKORT — en smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <section className={styles.auGiftBand}>
          <Reveal style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: '8px 16px' }}>
            <p className="sf-eyebrow" style={{ margin: 0 }}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.auGiftLede}>{content.giftLede ?? 'Ge bort blomsterglädje, när som helst.'}</p>
            <a href="/presentkort" className={styles.auBandCta} style={{ marginTop: 0 }}>{content.giftCta ?? 'Köp presentkort'}</a>
          </Reveal>
        </section>
      ) : null}

      {/* 10 — FRÅN BLOGGEN — blogg-modulen invävd (max 3 teasers) */}
      {bloggTeasers.length > 0 ? (
        <section style={{ paddingBottom: 'clamp(44px, 6vw, 84px)' }}>
          <Reveal className={styles.auSecHead}>
            <p className="sf-eyebrow">{content.blogEyebrow ?? '— Bloggen'}</p>
            <h2 className="sf-h2" style={{ marginTop: 10 }}>{content.blogTitle ?? 'Nyheter & inspiration'}</h2>
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

      {/* 11 — PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className="sf-eyebrow">{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className="sf-h2" style={{ marginTop: 12 }}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>{location.address}</p>
            ) : (
              <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>Adress visas snart.</p>
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

      {/* 12 — CLOSING */}
      <section className={shared.sfClosing}>
        <Reveal>
          <h2 className="sf-h1" style={{ color: '#fff', maxWidth: '40rem', margin: '0 auto' }}>
            {content.closingTitle ?? 'Redo att beställa?'}
          </h2>
          <p className={shared.sfClosingLead}>
            {content.closingLede ?? 'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div style={{ marginTop: 30 }}>
            <BookCta className={shared.sfClosingCta} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
