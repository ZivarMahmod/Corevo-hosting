import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { BookCta } from '@/components/brand/BookCta'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './onyx.module.css'

/**
 * ONYX — MÖRK STUDIO (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Onyx - Mörk Studio.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HERO          — två spalter (1.1fr/1fr): eyebrow, "Blommor är inte alltid söta.",
 *                       två CTA:er ("SE DROPPET" / "BOKA STUDION") och kvällsnoten till
 *                       vänster; fotot till höger med FIG-etiketten i nedre hörnet.
 *   (2) VECKANS DROP  — tre produkter i hårlinje-rastret (1px gap), "+ LÄGG I KASSE".
 *   (3) MANIFEST-BAND — ett centrerat påstående, inget annat.
 *   (4) TRE VÄGAR     — 02 Veckans drop · 03 Night classes · 08 Kretsen.
 *   (5) JOURNAL       — två inlägg som hårlinje-rader (datum | rubrik | LÄS →).
 *   (6) CLOSING       — foto med 78 % svart slöja, "Ikväll, före 23:00." + BESTÄLL NU.
 *
 * Filen har varken galleri-band, presentkortsrad eller team-sektion på hemmet — och då
 * har inte mallen det heller. Att lägga till en sektion "för att grannmallen har en" ÄR
 * att improvisera bort mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * MODUL-GATINGEN är plattformens och HELIG: drop-rutnätet ritas bara när shopen har
 * teasers, journal-raderna bara när bloggen har inlägg, "SE DROPPET" pekar på /shop bara
 * när butiken går att nå (annars boknings-drawern). `modules === undefined` (studions
 * statiska preview) → visa allt.
 *
 * AVVIKELSE (medveten): filens tredje väg "Kretsen" (lojalitet) har ingen route i Corevo
 * — /krets finns inte. Kortet renderas därför som TEXT UTAN LÄNK i stället för att peka
 * på en 404. Formen är filens; ingen länk till en modul som inte går att nå.
 *
 * SYNKRON komponent (ingen async, ingen 'use client') — onboarding-studions preview
 * renderar samma komponent.
 */
export function OnyxLayout({ content, modules }: StorefrontLayoutProps) {
  // Filen visar TRE produkter i "Veckans drop" (products.slice(0, 3)) och TVÅ journal-rader.
  const drop = (modules?.shopTeasers ?? []).slice(0, 3)
  const posts = (modules?.bloggTeasers ?? []).slice(0, 2)
  // modules === undefined (studions statiska preview) → visa allt.
  const shopReachable = modules ? modules.shopReachable : true

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const closingPhoto = content.closingImage ?? content.galleryImages[2] ?? ''

  const paths = [
    {
      num: '02',
      title: content.pillar1Title ?? 'Veckans drop',
      desc: content.pillar1Body ?? 'Begränsade buketter, nya varje måndag.',
      href: shopReachable ? '/shop' : null,
    },
    {
      num: '03',
      title: content.pillar2Title ?? 'Night classes',
      desc: content.pillar2Body ?? 'Kvällskurser i studion — bind till hög musik.',
      href: '/kurser',
    },
    {
      num: '08',
      title: content.pillar3Title ?? 'Kretsen',
      desc: content.pillar3Body ?? 'Inre cirkeln. Tidig access och stängda kvällar.',
      href: null,
    },
  ]

  return (
    <div className={styles.onRoot}>
      {/* (1) HERO */}
      <section className={styles.onHero}>
        <div className={styles.onHeroText}>
          <Reveal>
            <p className={styles.onHeroEyebrow}>{content.heroEyebrow}</p>
            <h1 className={styles.onHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.onHeroLede}>{content.heroLede}</p>
            <div className={styles.onHeroCtas}>
              {shopReachable ? (
                <Link href="/shop" className={styles.onSolid}>
                  SE DROPPET
                </Link>
              ) : null}
              {/* "BOKA STUDION" är en HANDLING → plattformens boknings-CTA, aldrig egen logik. */}
              <BookCta className={styles.onGhost} label="BOKA STUDION" />
            </div>
            <p className={styles.onHeroNote}>
              {content.findEyebrow ?? 'KVÄLLSLEVERANS 18–23 · BESTÄLL FÖRE 20:00'}
            </p>
          </Reveal>
        </div>
        <div
          className={styles.onHeroPhoto}
          style={heroPhoto ? { backgroundImage: `url(${heroPhoto})` } : undefined}
        >
          <span className={styles.onFig}>{content.galleryEyebrow ?? 'FIG. 01 — MAGNOLIA NOIR'}</span>
        </div>
      </section>

      {/* (2) VECKANS DROP */}
      {drop.length > 0 ? (
        <section className={styles.onSection}>
          <div className={styles.onSecHead}>
            <h2 className={styles.onSecTitle}>{content.shopTitle ?? 'Veckans drop'}</h2>
            <Link href="/shop" className={styles.onLink}>
              {content.shopCta ?? 'SE ALLT →'}
            </Link>
          </div>
          <ul className={styles.onGrid}>
            {drop.map((p, i) => (
              <li key={p.id} className={styles.onCard}>
                <Reveal delay={i * 90}>
                  <div className={styles.onCardMedia}>
                    <Link
                      href={`/shop/${p.id}`}
                      className={styles.onCardImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                      aria-label={`${p.name} — visa produkten`}
                    >
                      <span className={styles.onSrOnly}>{p.imageAlt ?? p.name}</span>
                    </Link>
                  </div>
                  <div className={styles.onCardRow}>
                    <h3 className={styles.onCardName}>
                      <Link href={`/shop/${p.id}`}>{p.name}</Link>
                    </h3>
                    <span className={styles.onCardPrice}>
                      {formatShopPrice(p.priceCents, p.currency)}
                    </span>
                  </div>
                  {p.description ? <p className={styles.onCardDesc}>{p.description}</p> : null}
                  {/* Teaser-kortet BÄR ingen köp-logik: köp-rälsen (AddToCart) bor i butiks-
                      vyn och på produktsidan, där fulfilment-läget faktiskt är känt. */}
                  <Link href={`/shop/${p.id}`} className={styles.onWire}>
                    + LÄGG I KASSE
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (3) MANIFEST-BANDET */}
      <section className={styles.onManifest}>
        <Reveal>
          <p className={styles.onManifestText}>{content.italic}</p>
        </Reveal>
      </section>

      {/* (4) TRE VÄGAR */}
      <section className={styles.onPaths}>
        {paths.map((t, i) => (
          <Reveal key={t.num} delay={i * 90}>
            {t.href ? (
              <Link href={t.href} className={styles.onPath}>
                <p className={styles.onPathNum}>{t.num}</p>
                <h3 className={styles.onPathTitle}>{t.title}</h3>
                <p className={styles.onPathDesc}>{t.desc}</p>
              </Link>
            ) : (
              <div className={styles.onPath}>
                <p className={styles.onPathNum}>{t.num}</p>
                <h3 className={styles.onPathTitle}>{t.title}</h3>
                <p className={styles.onPathDesc}>{t.desc}</p>
              </div>
            )}
          </Reveal>
        ))}
      </section>

      {/* (5) JOURNAL-UTDRAGET */}
      {posts.length > 0 ? (
        <section className={styles.onSection}>
          <div className={styles.onSecHead}>
            <h2 className={styles.onSecTitle}>{content.blogTitle ?? 'Journal'}</h2>
            <Link href="/blogg" className={styles.onLink}>
              {content.blogCta ?? 'ALLA INLÄGG →'}
            </Link>
          </div>
          <ul className={styles.onJournalList}>
            {posts.map((b) => (
              <li key={b.id}>
                <Link href={b.slug ? `/blogg/${b.slug}` : '/blogg'} className={styles.onJournalRow}>
                  <span className={styles.onJournalDate}>{(b.publishedAt ?? '').slice(0, 10)}</span>
                  <span className={styles.onJournalTitle}>{b.title}</span>
                  <span className={styles.onJournalRead}>LÄS →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (6) CLOSING */}
      <section
        className={styles.onClosing}
        style={closingPhoto ? { backgroundImage: `url(${closingPhoto})` } : undefined}
      >
        <div className={styles.onClosingVeil} />
        <div className={styles.onClosingInner}>
          <Reveal>
            <h2 className={styles.onClosingTitle}>
              {content.closingTitle ?? 'Ikväll, före 23:00.'}
            </h2>
            <p className={styles.onClosingLede}>
              {content.closingLede ?? 'Beställ före 20:00 så cyklar budet ut buketten samma kväll.'}
            </p>
            {shopReachable ? (
              <Link href="/shop" className={styles.onSolid}>
                BESTÄLL NU
              </Link>
            ) : (
              <BookCta className={styles.onSolid} label="BESTÄLL NU" />
            )}
          </Reveal>
        </div>
      </section>
    </div>
  )
}
