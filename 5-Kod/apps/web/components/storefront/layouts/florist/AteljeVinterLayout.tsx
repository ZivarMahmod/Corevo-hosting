import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './ateljevinter.module.css'

/**
 * ATELJÉ VINTER — GALLERI-MINIMAL (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Ateljé Vinter - Galleri Minimal.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HERO      — två spalter: text till vänster, ett enda verk i 4:5 till höger med
 *                   bildtext + pris under (filens "nr 01 — eukalyptus, ensam · 600 kr")
 *   (2) UR SAMLINGEN — tre verk i rad, numrerade, med "+ förvärva" som hårlinje-knapp
 *   (3) ATELJÉNS HÅLLNING — ett centrerat statement, inget annat
 *   (4) RUMMEN    — rum i (ateljébesök) · rum ii (seminarier) · rum iii (arkivet)
 *
 * Filen har varken galleri-band, blogg-band eller presentkort-rad på hemmet — och då har
 * inte mallen det heller. Modulerna nås via nav, rummen och sidfoten, precis som i filen.
 * Att lägga till en sektion "för att de andra mallarna har en" ÄR att improvisera bort
 * mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * Modul-gatingen är plattformens och HELIG: verk-rutnätet ritas bara när shopen har
 * teasers, rum i/ii bara när modulen går att nå. SYNKRON komponent (ingen async, ingen
 * 'use client') — onboarding-studions preview renderar samma komponent.
 */
export function AteljeVinterLayout({ content, modules }: StorefrontLayoutProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  // Filen visar SEX verk i samlingen och TRE på hemmet (products.slice(1, 4)).
  const works = (modules?.shopTeasers ?? []).slice(0, 3)
  // Saknad reachability failar stängt; onboarding-previewns modulytor renderas separat.
  const shopReachable = modules?.shopReachable ?? false
  const kurserReachable = modules?.kurserReachable ?? false
  const galleriReachable = modules?.galleriReachable ?? false

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const heroWork = works[0] ?? null

  const rooms = [
    {
      num: 'rum i',
      title: content.pillar1Title ?? 'ateljébesök',
      desc:
        content.pillar1Body ??
        'en timme, två stolar, era idéer om bröllop eller beställningsverk.',
      href: bookingReachable ? '/boka' : null,
    },
    {
      num: 'rum ii',
      title: content.pillar2Title ?? 'seminarier',
      desc: content.pillar2Body ?? 'fyra platser per tillfälle. ett tema, två timmar, inga genvägar.',
      href: kurserReachable ? '/kurser' : null,
    },
    {
      num: 'rum iii',
      title: content.pillar3Title ?? 'arkivet',
      desc:
        content.pillar3Body ??
        'tidigare samlingar, dokumenterade innan de lämnade huset.',
      href: galleriReachable ? '/galleri' : null,
    },
  ]

  return (
    <div className={styles.avRoot}>
      <div className={styles.avWrap}>
        {/* (1) HERO — text | ett verk */}
        <section className={styles.avHero}>
          <Reveal>
            <p className={styles.avEyebrow}>{content.heroEyebrow}</p>
            <h1 className={styles.avHeroTitle}>{content.heroTitle}</h1>
            <p className={styles.avHeroLede}>{content.heroLede}</p>
            <Link href={shopReachable ? '/shop' : '/tjanster'} className={styles.avUnderline}>
              se samlingen
            </Link>
          </Reveal>
          <Reveal delay={140}>
            <div className={styles.avHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }} />
            {heroWork ? (
              <div className={styles.avHeroCaption}>
                <p className={styles.avMeta}>{heroWork.name}</p>
                <p className={styles.avMetaPrice}>
                  {formatProductPrice(heroWork)}
                </p>
              </div>
            ) : null}
          </Reveal>
        </section>

        {/* (2) UR SAMLINGEN — tre numrerade verk */}
        {works.length > 0 ? (
          <>
            <div className={styles.avRule} />
            <section className={styles.avSection}>
              <Reveal className={styles.avSecHead}>
                <h2 className={styles.avSecTitle}>{content.shopTitle ?? 'ur samlingen'}</h2>
                <p className={styles.avSecCount}>{content.shopEyebrow ?? '01 — 06'}</p>
              </Reveal>
              <ul className={styles.avWorkGrid}>
                {works.map((p, i) => (
                  <li key={p.id}>
                    <Reveal delay={i * 90}>
                      <Link
                        href={`/shop/${p.id}`}
                        className={styles.avWorkImg}
                        style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                        aria-label={`${p.name} — visa verket`}
                      >
                        <span className={styles.avSrOnly}>{p.imageAlt ?? p.name}</span>
                      </Link>
                      <div className={styles.avWorkRow}>
                        <p className={styles.avWorkName}>{p.name}</p>
                        <p className={styles.avWorkPrice}>
                          {formatProductPrice(p)}
                        </p>
                      </div>
                      <Link href={`/shop/${p.id}`} className={`${styles.avUnderline} ${styles.avWorkBuy}`}>
                        + förvärva
                      </Link>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}

        {/* (3) ATELJÉNS HÅLLNING */}
        <div className={styles.avRule} />
        <section className={styles.avStatement}>
          <Reveal>
            <p className={styles.avEyebrow}>{content.homeGalleryEyebrow ?? 'ateljéns hållning'}</p>
            <p className={styles.avStatementText}>{content.italic}</p>
          </Reveal>
        </section>

        {/* (4) RUMMEN */}
        <div className={styles.avRule} />
        <section className={styles.avRooms}>
          {rooms.map((r, i) => (
            <Reveal key={r.num} delay={i * 90}>
              {r.href ? (
                <Link href={r.href} className={styles.avRoom}>
                  <p className={styles.avRoomNum}>{r.num}</p>
                  <h3 className={styles.avRoomTitle}>{r.title}</h3>
                  <p className={styles.avRoomDesc}>{r.desc}</p>
                  <span className={styles.avUnderline}>gå in →</span>
                </Link>
              ) : (
                <div className={styles.avRoom}>
                  <p className={styles.avRoomNum}>{r.num}</p>
                  <h3 className={styles.avRoomTitle}>{r.title}</h3>
                  <p className={styles.avRoomDesc}>{r.desc}</p>
                </div>
              )}
            </Reveal>
          ))}
        </section>
      </div>
    </div>
  )
}
