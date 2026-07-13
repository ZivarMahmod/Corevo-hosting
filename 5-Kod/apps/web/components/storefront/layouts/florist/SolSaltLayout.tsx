import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { BookCta } from '@/components/brand/BookCta'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './solsalt.module.css'

/**
 * SOL & SALT — MEDELHAVSBOD (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Sol & Salt - Medelhav.dc.html", sektion
 * för sektion, i filens ordning:
 *
 *   (1) HERO        — koboltblå platta i 32px radie, 1.05fr/1fr: solgul badge, DM Serif 62px
 *                     ("Sommar i / bukettform."), lede, "Till boden" (solgul) + "Boka" (ram),
 *                     foto i höger halva (min 480px)
 *   (2) SOLREMSAN   — solgult 999px-band med annonsraden (mallens utility-text)
 *   (3) VECKANS FAVORITER — tre produktkort ur boden + "Hela sortimentet →"
 *   (4) TRE PLATTOR — Hemkörning (solgul) · Krukväxter (salvia) · Presentkort (persika)
 *   (5) BODEN       — papperskort: foto 5:4 till vänster, om-texten till höger
 *   (6) FRÅN BODEN  — tre blogg-teasers i 16:11
 *
 * Filen har varken galleri-band eller stat-rad på hemmet — och då har inte mallen det heller
 * (caps.homeGallery/homeStats = false i manifestet). Att lägga till en sektion "för att de
 * andra mallarna har en" ÄR att improvisera bort mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * Modul-gatingen är plattformens och HELIG: produktbandet ritas bara när shopen har teasers,
 * bloggbandet bara när det finns inlägg, presentkort-plattan bara när modulen är live. En
 * avstängd modul får NOLL länkar till sin sida. SYNKRON komponent (ingen async, ingen
 * 'use client') — onboarding-studions preview renderar samma komponent.
 */
export function SolSaltLayout({ content, modules }: StorefrontLayoutProps) {
  // Filen visar TRE produkter och TRE inlägg på hemmet (products.slice(0,3) / blog.slice(0,3)).
  const products = (modules?.shopTeasers ?? []).slice(0, 3)
  const posts = (modules?.bloggTeasers ?? []).slice(0, 3)
  // modules === undefined (studions statiska preview) → visa allt.
  const shopReachable = modules ? modules.shopReachable : true
  const presentkortLive = modules ? modules.presentkortLive : true

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const aboutPhoto = content.aboutImage ?? content.galleryImages[1] ?? ''

  // Filens home-om-text skiljer sig från /om-sidans. resolveThemeContent sätter aboutCopyHome
  // = aboutCopy när ägaren INTE skrivit en egen hem-text — då är det mallens egen hem-copy som
  // gäller, verbatim ur filen. Skriver ägaren något eget vinner det (extraHome: aboutCopyHome).
  const HOME_ABOUT =
    'Sol & Salt är en liten blomsterbod med förkärlek för det soldränkta — citrongult, koboltblått och allt grönt som tål en varm fönsterbräda. Vi plockar på morgonen och binder hela dagen.'
  const aboutHome = content.aboutCopyHome === content.aboutCopy ? HOME_ABOUT : content.aboutCopyHome

  // Filens tre plattor. Presentkort-plattan är modul-gatad; de två första leder till boden och
  // ritas bara när butiken går att nå.
  const tiles = [
    shopReachable
      ? {
          key: 'hemkorning',
          cls: styles.slTileSun,
          emoji: '🚲',
          title: content.pillar1Title ?? 'Hemkörning',
          desc: content.pillar1Body ?? 'Fri över 400 kr, samma dag.',
          cta: 'Handla',
          href: '/shop',
        }
      : null,
    shopReachable
      ? {
          key: 'krukvaxter',
          cls: styles.slTileGreen,
          emoji: '🪴',
          title: content.pillar2Title ?? 'Krukväxter',
          desc: content.pillar2Body ?? 'Grönt som tål en solig bräda.',
          cta: 'Se boden',
          href: '/shop',
        }
      : null,
    presentkortLive
      ? {
          key: 'presentkort',
          cls: styles.slTilePeach,
          emoji: '💌',
          title: content.pillar3Title ?? 'Presentkort',
          desc: content.pillar3Body ?? 'Ge bort en bit medelhav.',
          cta: 'Köp',
          href: '/presentkort',
        }
      : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null)

  return (
    <div className={styles.slRoot}>
      <div className={styles.slWrap}>
        {/* (1) HERO — koboltplattan */}
        <section className={styles.slHero}>
          <div className={styles.slHeroCard}>
            <Reveal className={styles.slHeroText}>
              <p className={styles.slHeroBadge}>{content.heroEyebrow}</p>
              <h1 className={styles.slHeroTitle}>{content.heroTitle}</h1>
              <p className={styles.slHeroLede}>{content.heroLede}</p>
              <div className={styles.slHeroCtas}>
                {shopReachable ? (
                  <Link href="/shop" className={styles.slPillSun}>
                    Till boden
                  </Link>
                ) : null}
                <BookCta className={styles.slPillGhost} label="Boka" />
              </div>
            </Reveal>
            <div className={styles.slHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }} />
          </div>
        </section>

        {/* (2) SOLREMSAN — filens gula annonsband (mallens Nav äger utility-raden, se chrome) */}
        <section className={styles.slStrip}>
          <p className={styles.slStripText}>{content.utility}</p>
        </section>

        {/* (3) VECKANS FAVORITER — ur boden */}
        {products.length > 0 ? (
          <section className={styles.slSection}>
            <div className={styles.slSecHead}>
              <div>
                <p className={styles.slEyebrow}>{content.shopEyebrow ?? 'Ur boden'}</p>
                <h2 className={styles.slSecTitle}>{content.shopTitle ?? 'Veckans favoriter'}</h2>
              </div>
              <Link href="/shop" className={styles.slLink}>
                {content.shopCta ?? 'Hela sortimentet →'}
              </Link>
            </div>
            <ul className={styles.slGrid3}>
              {products.map((p, i) => (
                <li key={p.id}>
                  <Reveal delay={i * 90} className={styles.slCard}>
                    <Link
                      href={`/shop/${p.id}`}
                      className={styles.slCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                      aria-label={`${p.name} — visa varan`}
                    >
                      <span className={styles.slSrOnly}>{p.imageAlt ?? p.name}</span>
                    </Link>
                    <div className={styles.slCardBody}>
                      <div className={styles.slCardHead}>
                        <h3 className={styles.slCardName}>{p.name}</h3>
                        <span className={styles.slCardPrice}>
                          {formatProductPrice(p)}
                        </span>
                      </div>
                      {p.description ? <p className={styles.slCardDesc}>{p.description}</p> : null}
                      {/* Filens "Lägg i korg" i mallens form. Teaser-propen bär INTE shop-configen
                          (LayoutModuleTeasers = produkter + reachable), och köp-knappens löfte ÄR
                          fulfilment-beroende (shopCtaLabel: "Lägg i kundvagn" / "Reservera för
                          upphämtning" / "Beställ till butik"). Att gissa en fulfilment här hade
                          satt fel löfte på hemmet — så knappen bär till produktsidan, där modulens
                          riktiga <AddToCart> med rätt config sitter. Mallen bygger ALDRIG egen
                          korg-logik. */}
                      <div className={styles.slCardBuy}>
                        <Link href={`/shop/${p.id}`} className={styles.slPillBlue}>
                          Lägg i korg
                        </Link>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* (4) TRE PLATTOR */}
        {tiles.length > 0 ? (
          <section className={styles.slTiles}>
            {tiles.map((t, i) => (
              <Reveal key={t.key} delay={i * 90}>
                <Link href={t.href} className={t.cls}>
                  <p className={styles.slTileEmoji} aria-hidden="true">
                    {t.emoji}
                  </p>
                  <h3 className={styles.slTileTitle}>{t.title}</h3>
                  <p className={styles.slTileDesc}>{t.desc}</p>
                  <span className={styles.slTileCta}>{t.cta} →</span>
                </Link>
              </Reveal>
            ))}
          </section>
        ) : null}

        {/* (5) BODEN — om-bandet */}
        <section className={styles.slAbout}>
          <Reveal>
            <div
              className={styles.slAboutPhoto}
              style={aboutPhoto ? { backgroundImage: `url(${aboutPhoto})` } : undefined}
            />
          </Reveal>
          <Reveal delay={140}>
            <p className={styles.slAboutEyebrow}>{content.teamEyebrow}</p>
            <h2 className={styles.slAboutTitle}>{content.teamTitle}</h2>
            <p className={styles.slAboutBody}>{aboutHome}</p>
            <Link href="/om" className={styles.slLink}>
              Mer om oss →
            </Link>
          </Reveal>
        </section>

        {/* (6) FRÅN BODEN — blogg-teasers */}
        {posts.length > 0 ? (
          <section className={styles.slBlogBand}>
            <h2 className={styles.slBlogBandTitle}>{content.blogTitle ?? 'Från boden'}</h2>
            <ul className={styles.slGrid3}>
              {posts.map((b, i) => (
                <li key={b.id}>
                  <Reveal delay={i * 90}>
                    <Link href={b.slug ? `/blogg/${b.slug}` : '/blogg'}>
                      <span
                        className={styles.slTeaserImg}
                        style={
                          b.coverImageUrl ? { backgroundImage: `url(${b.coverImageUrl})` } : undefined
                        }
                      />
                      {b.publishedAt ? (
                        <p className={styles.slTeaserDate}>{formatBandDate(b.publishedAt)}</p>
                      ) : null}
                      <h3 className={styles.slTeaserTitle}>{b.title}</h3>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** Filens datumform i bandet: "4 juli" (versal-mikro sätts av CSS:en). */
function formatBandDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}
