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
 * "Handla nu"-cirkelknapp ovanpå bilden, ett korall-band med en mening +
 * liten CTA, en rosa panel med ett förskjutet asymmetriskt valv-collage — och
 * DÄREFTER de invävda modulerna (butik/blogg/presentkort) i samma varma
 * formspråk. Webshop/blogg/presentkort vävs in via `modules`-propen (S10),
 * precis som Flora — Aurora äger sina moduler (THEME_OWNS_MODULES).
 *
 * SKÄRPE-PASS (design-skarpa-zentum.md): identiteten är orörd — typografin är
 * skärpt. Mallen använder INTE de globala .sf-h1/.sf-h2/.sf-eyebrow/.sf-body
 * längre (de ligger på en slappare skala: h2 34px, eyebrow utan LS-disciplin) —
 * den kör sin egen skala 96/48/26/18/16/11 ur aurora.module.css. Där ett DELAT
 * element bär typografi (tjänsteraderna, stat-trion, closing-leden) läggs
 * mallens klass PÅ det delade klassnamnet; aurora-regeln är dubblad
 * (.auRowName.auRowName) och vinner på specificitet — den delade filen rörs inte.
 * Allt i EN root (.auRoot) så mallens dekor-tokens har ett hem.
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
  // Collagets sex valv: två ur hero-arrayen + fyra ur galleriet. Alla i SAMMA
  // ratio (9:10) — förskjutningen sitter i marginalen och valv-riktningen (CSS),
  // aldrig i höjden, så bildkanterna fortsätter linjera i griden.
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

      {/* 3+4 — KORALL-BAND med en mening + liten centrerad CTA */}
      <section className={styles.auStatement}>
        <Reveal>
          <p className={styles.auStatementText}>{content.tagline}</p>
          <BookCta className={`${styles.auBtn} ${styles.auStatementCta}`} label="Boka tid" />
        </Reveal>
      </section>

      {/* 5 — ROSA PANEL: förskjutet, asymmetriskt valv-collage */}
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

      {/* 6 — UR BUTIKEN — webshop-modulen invävd (max 3 teasers) */}
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

      {/* 7 — TJÄNSTER — bara när det finns aktiva tjänster (goal-55 8B) */}
      {rows.length > 0 ? (
        <section className={styles.auSection}>
          <div className={shared.sfNarrow}>
            <Reveal style={{ textAlign: 'center' }}>
              <p className={styles.auEyebrow}>{content.servicesEyebrow}</p>
              <h2 className={styles.auH2}>{content.servicesTitle}</h2>
            </Reveal>
            <div className={shared.sfRowList}>
              {rows.map((s, i) => (
                <Reveal key={s.id} delay={i * 60}>
                  <Bookable className={shared.sfRow} label={`Beställ — ${s.name}`}>
                    <span className={styles.auRowNum} aria-hidden="true">{serviceNum(i)}</span>
                    <span className={shared.sfRowMain}>
                      <span className={`${shared.sfRowName} ${styles.auRowName}`}>{s.name}</span>
                      <span className={`${shared.sfRowDesc} ${styles.auRowDesc}`}>{serviceDesc(s)}</span>
                    </span>
                    <span className={shared.sfRowMeta}>
                      <span className={`${shared.sfRowPrice} ${styles.auRowPrice}`}>{formatPrice(s)}</span>
                    </span>
                  </Bookable>
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <Reveal style={{ textAlign: 'center' }}>
                <a href="/tjanster" className={`${shared.sfMoreLink} ${styles.auMoreLink}`}>
                  Se allt vi gör <span aria-hidden="true">→</span>
                </a>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 8 — OM — foto (9:10) + berättelse + kursiv värmefras + stat-trio */}
      <section className={styles.auSection}>
        <div className={`${shared.sfWide} ${shared.sfAboutGrid}`}>
          <Reveal>
            <div className={styles.auAboutPhoto} style={{ backgroundImage: `url(${content.aboutImage})` }} />
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.auEyebrow}>— Om {tenant.name}</p>
            <h2 className={styles.auH2}>{content.aboutTitle}</h2>
            <p className={styles.auBody}>{content.aboutCopyHome}</p>
            <p className={styles.auItalicLine}>”{content.italic}”</p>
            <ul className={shared.sfStatTrio}>
              {content.stats.map(([n, l]) => (
                <li key={l}>
                  <span className={`${shared.sfStatValue} ${styles.auStatValue}`}>{n}</span>
                  <span className={`${shared.sfStatLabel} ${styles.auStatLabel}`}>{l}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 9 — PRESENTKORT — en smal rad, aldrig en hel sektion */}
      {presentkortLive ? (
        <section className={styles.auGiftBand}>
          <Reveal style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: '12px 20px' }}>
            <p className={styles.auEyebrow}>{content.giftEyebrow ?? '— Presentkort'}</p>
            <p className={styles.auGiftLede}>{content.giftLede ?? 'Ge bort blomsterglädje, när som helst.'}</p>
            <a href="/presentkort" className={styles.auBandCta} style={{ marginTop: 0 }}>{content.giftCta ?? 'Köp presentkort'}</a>
          </Reveal>
        </section>
      ) : null}

      {/* 10 — FRÅN BLOGGEN — blogg-modulen invävd (max 3 teasers) */}
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

      {/* 11 — PLATS & ÖPPETTIDER */}
      <section className={shared.sfLocBand}>
        <div className={`${shared.sfWide} ${shared.sfLocGrid}`}>
          <Reveal>
            <p className={styles.auEyebrow}>{content.findEyebrow ?? '— Hitta hit'}</p>
            <h2 className={styles.auH2}>
              {location?.address ? location.address.split(',')[0] : tenant.name}
            </h2>
            {location?.address ? (
              <p className={styles.auBody}>{location.address}</p>
            ) : (
              <p className={styles.auBody}>Adress visas snart.</p>
            )}
            {location?.hours ? (
              <div className={shared.sfHours}>
                {location.hours.map((h) => (
                  <div key={h.day} className={`${shared.sfHoursRow} ${styles.auHoursRow}`}>
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
                  className={`${shared.sfMapLink} ${styles.auMapLink}`}
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

      {/* 12 — CLOSING (auClosing flyttar bandet till mörk korall → rubriken skär 7.27:1) */}
      <section className={`${shared.sfClosing} ${styles.auClosing}`}>
        <Reveal>
          <h2 className={styles.auClosingTitle}>
            {content.closingTitle ?? 'Redo att beställa?'}
          </h2>
          <p className={`${shared.sfClosingLead} ${styles.auClosingLede}`}>
            {content.closingLede ?? 'Handla i butiken, boka en tid eller hör av dig — vi hjälper dig gärna.'}
          </p>
          <div className={styles.auClosingActions}>
            <BookCta className={`${shared.sfClosingCta} ${styles.auBtn}`} />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
