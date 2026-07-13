import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { formatPrice, serviceDesc } from '../../service-format'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './blomstertorget.module.css'

/**
 * BLOMSTERTORGET — FÖRSTASIDAN (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Blomstertorget - Tidning.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HUVUDNYHETEN — 2fr/1fr: artikeln (etikett, 42px versalrubrik, 16:9-foto med
 *       byline, tvåspaltig brödtext, röd platt-CTA) och högerspalten med DAGENS PRISER
 *       (prickade noteringsrader) + den streckade STAMKUNDSKUPONGEN.
 *   (2) NOTISER — tre spalter med prickad spaltlinje mellan.
 *   (3) KUNGÖRELSER + BILDSIDAN — 1fr/1fr under en 3px-linje.
 *
 * Filen har varken hero-band, team-sektion eller presentkortsrad på hemmet — och då har
 * inte mallen det heller. Modulerna nås via masthead, kupongen och sidfoten, precis som i
 * filen. Att lägga till en sektion "för att de andra mallarna har en" ÄR att improvisera
 * bort mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * MOCKDATAN ÄR BARA FORMEN: prisnoteringarna och torgets varor kommer ur shop-modulen
 * (modules.shopTeasers), notiserna ur bloggen (modules.bloggTeasers) och kungörelserna ur
 * tenantens tjänster (services). Modul-gatingen är plattformens och HELIG: en avstängd
 * shop ger noll länkar till /shop, och notisspalten ritas bara när bloggen har inlägg.
 * SYNKRON komponent (ingen async, ingen 'use client') — studions preview renderar samma
 * komponent.
 */
export function BlomstertorgetLayout({ content, services, modules }: StorefrontLayoutProps) {
  // modules === undefined (studions statiska preview) → visa allt.
  const shopReachable = modules ? modules.shopReachable : true
  // Filens högerspalt noterar SEX priser; produkterna är torgets egna.
  const ticker = (modules?.shopTeasers ?? []).slice(0, 6)
  // Filens förstasida har TRE notiser.
  const notiser = (modules?.bloggTeasers ?? []).slice(0, 3)
  // Filens kungörelse-spalt visar TRE rader (courses.slice(0, 3)).
  const kungorelser = services.slice(0, 3)

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const picks = content.galleryImages.slice(1, 3)
  // Torgpriserna nås bara när shopen är live/pausad; annars pekar CTA:n på tjänsterna.
  const priceHref = shopReachable ? '/shop' : '/tjanster'

  return (
    <div className={styles.btRoot}>
      <div className={styles.btWrap}>
        {/* (1) HUVUDNYHETEN */}
        <section className={styles.btLeadSection}>
          <Reveal>
            <article>
              <p className={styles.btTag}>{content.heroEyebrow}</p>
              <h2 className={styles.btLeadTitle}>{content.heroTitle}</h2>
              <div
                className={styles.btLeadPhoto}
                style={heroPhoto ? { backgroundImage: `url(${heroPhoto})` } : undefined}
                role="img"
                aria-label={content.heroTitle}
              />
              <p className={styles.btCred}>
                {content.galleryEyebrow ?? 'Foto: Torgets egen — morgonens leverans, gång 3'}
              </p>
              <p className={styles.btLeadBody}>
                <span className={styles.btDateline}>{content.findEyebrow ?? 'Hötorget.'}</span>{' '}
                {content.heroLede}
              </p>
              <Link href={priceHref} className={styles.btBtn}>
                {content.shopCta ?? 'Till torgpriserna →'}
              </Link>
            </article>
          </Reveal>

          <Reveal delay={120}>
            <aside className={styles.btAside}>
              {/* DAGENS PRISER — noteringarna är shop-modulens riktiga produkter. */}
              {ticker.length > 0 ? (
                <>
                  <p className={styles.btAsideHead}>{content.shopEyebrow ?? 'Dagens priser'}</p>
                  {ticker.map((p) => (
                    <div key={p.id} className={styles.btTickerRow}>
                      <span className={styles.btTickerName}>{p.name}</span>
                      <span className={styles.btTickerPrice}>
                        {formatShopPrice(p.priceCents, p.currency)}
                      </span>
                    </div>
                  ))}
                  <p className={styles.btTickerNote}>{content.italic}</p>
                </>
              ) : null}

              {/* STAMKUNDSKUPONGEN — lojalitetsmodulens väg in (/stamkund). */}
              <div className={styles.btCoupon}>
                <p className={styles.btCouponHead}>{content.pillar3Title ?? '✂ Stamkundskupong'}</p>
                <p className={styles.btCouponBody}>
                  {content.pillar3Body ?? 'Var 8:e bunt gratis för registrerade stamkunder.'}
                </p>
                <Link href="/stamkund" className={styles.btCouponCta}>
                  {content.pillar3Link ?? 'Registrera dig →'}
                </Link>
              </div>
            </aside>
          </Reveal>
        </section>

        {/* (2) NOTISER — bloggens tre senaste. */}
        {notiser.length > 0 ? (
          <ul className={styles.btNotisSection}>
            {notiser.map((n, i) => (
              <li key={n.id} className={styles.btNotis}>
                <Reveal delay={i * 90}>
                  <article>
                    <p className={styles.btTag}>{content.blogEyebrow ?? 'Notis'}</p>
                    <h3 className={styles.btNotisTitle}>{n.title}</h3>
                    {n.excerpt ? <p className={styles.btNotisText}>{n.excerpt}</p> : null}
                    <Link
                      href={n.slug ? `/blogg/${n.slug}` : '/blogg'}
                      className={styles.btItalicLink}
                    >
                      {content.blogCta ?? 'läs mer →'}
                    </Link>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        ) : null}

        {/* (3) KUNGÖRELSER + BILDSIDAN */}
        <section className={styles.btTwoCol}>
          {kungorelser.length > 0 ? (
            <Reveal>
              <div>
                <p className={styles.btColHead}>{content.pillar1Title ?? 'Kungörelser'}</p>
                {kungorelser.map((k) => (
                  <div key={k.id} className={styles.btKungRow}>
                    <span className={styles.btKungMeta}>{formatPrice(k)}</span>
                    <span className={styles.btKungText}>
                      <strong className={styles.btKungName}>{k.name}.</strong> {serviceDesc(k)}
                    </span>
                  </div>
                ))}
                <Link href="/kurser" className={styles.btMoreLink}>
                  {content.pillar1Link ?? 'alla kungörelser →'}
                </Link>
              </div>
            </Reveal>
          ) : null}

          <Reveal delay={120}>
            <div>
              <p className={styles.btColHead}>{content.pillar2Title ?? 'Bildsidan'}</p>
              <div className={styles.btPicGrid}>
                {picks.map((src) => (
                  <div key={src} className={styles.btPic} style={{ backgroundImage: `url(${src})` }} />
                ))}
              </div>
              <p className={styles.btCred}>
                {content.pillar2Body ?? 'Ur veckans arkiv — tulpanlasset & lördagens hjärtbukett'}
              </p>
              <Link href="/galleri" className={styles.btItalicLink}>
                {content.pillar2Link ?? 'hela bildsidan →'}
              </Link>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  )
}
