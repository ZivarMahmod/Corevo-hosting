import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import { formatBloggShortDate } from '@/lib/storefront/blogg/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — ART DÉCO (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Lunaria - Art Déco.dc.html", sektion
 * för sektion, i filens ordning:
 *
 *   (1) HERO          — dubbel guldram: text (deco-hörn, eyebrow, 64px Poiret One,
 *                       "Kliv in i butiken" + "Boka →") | foto i höger halva, 500px högt
 *   (2) GULD-DELARE   — "◆ Floristens urval ◆" mellan två guldlinjer
 *   (3) URVAL         — tre verk ur butiken, inramade kort med "Lägg i korg"
 *   (4) MANIFEST      — citatet mellan två guldlinjer
 *   (5) TRE PELARE  — I · II · III, romerska siffror, var sin väg in i en modul
 *   (6) KRÖNIKAN      — tre blogg-teasers under en tunn silverdelare
 *
 * Filen har varken galleri-band eller presentkortsrad på hemmet — då har inte mallen det
 * heller (se AGENTS.md:s UI-acceptansregel: lägga till en sektion "för att grannen har en" är att
 * improvisera bort mallen).
 *
 * Modul-gatingen är plattformens och HELIG: urvalet ritas bara när shopen har teasers,
 * krönikan bara när bloggen har inlägg, och "Kliv in i butiken" pekar på /tjanster när
 * shopen inte går att nå. SYNKRON komponent (ingen async, ingen 'use client') — studions
 * preview renderar samma komponent.
 */
export function LunariaLayout({ content, modules }: StorefrontLayoutProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  // Filen visar TRE verk på hemmet (products.slice(0, 3)) och tre krönike-inlägg.
  const shopTeasers = (modules?.shopTeasers ?? []).slice(0, 3)
  const bloggTeasers = (modules?.bloggTeasers ?? []).slice(0, 3)
  // Saknad reachability failar stängt; onboarding-previewns modulytor renderas separat.
  const shopReachable = modules?.shopReachable ?? false
  // goal-64: klubben (III Cirkeln) pekade på /klubb — en route som INTE FANNS. Varje
  // besökare som klickade landade i en 404. Sidan finns nu, och länken är modul-gatad:
  // Lojalitet av → kortet står kvar men olänkat (filens form utan 404-fällan).
  const klubbReachable = modules?.lojalitetReachable ?? false
  const kurserReachable = modules?.kurserReachable ?? false

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''

  // Filens tre pelare: I Bröllop → /boka, II Bindkvällar → /kurser, III Cirkeln →
  // /klubb (manifestets `klubb` = lojalitetsmodulen).
  const salons: { no: string; title: string; desc: string; cta: string; href: string | null }[] = [
    {
      no: 'I',
      title: content.pillar1Title ?? 'Bröllop',
      desc: content.pillar1Body ?? 'Brudbukett och dekor komponerad i decostil.',
      cta: 'Boka möte',
      href: bookingReachable ? '/boka' : null,
    },
    {
      no: 'II',
      title: content.pillar2Title ?? 'Bindkvällar',
      desc: content.pillar2Body ?? 'Lär dig binda med balans och proportion.',
      cta: 'Se kurser',
      href: kurserReachable ? '/kurser' : null,
    },
    {
      no: 'III',
      title: content.pillar3Title ?? 'Cirkeln',
      desc: content.pillar3Body ?? 'Vår inre krets — förtur och privata kvällar.',
      cta: 'Bli medlem',
      href: klubbReachable ? '/klubb' : null,
    },
  ]

  return (
    <div className={styles.lnRoot}>
      <div className={styles.lnWrap}>
        {/* (1) HERO — dubbel guldram, text | foto */}
        <section className={styles.lnHero}>
          <Reveal>
            <div className={styles.lnHeroFrame}>
              <div className={styles.lnHeroInner}>
                <div className={styles.lnHeroText}>
                  <div className={styles.lnHeroCorner} aria-hidden="true" />
                  <p className={styles.lnHeroEyebrow} data-corevo-editor-field="heroEyebrow" data-corevo-editor-stable-field="heroEyebrow">{content.heroEyebrow}</p>
                  <h1 className={styles.lnHeroTitle} data-corevo-editor-field="heroTitle" data-corevo-editor-stable-field="heroTitle">{content.heroTitle}</h1>
                  <p className={styles.lnHeroLede} data-corevo-editor-field="heroLede" data-corevo-editor-stable-field="heroLede">{content.heroLede}</p>
                  <div className={styles.lnHeroCtas}>
                    <Link href={shopReachable ? '/shop' : '/tjanster'} className={styles.lnSolid}>
                      Kliv in i butiken
                    </Link>
                    {bookingReachable ? (
                      <Link href="/boka" className={styles.lnUnderline}>
                        Boka →
                      </Link>
                    ) : (
                      <span className={styles.lnUnderline} aria-disabled="true">
                        Boka →
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={styles.lnHeroPhoto}
                  style={heroPhoto ? { backgroundImage: `url(${heroPhoto})` } : undefined}
                  data-corevo-editor-field="hero_images.0"
                  data-corevo-editor-stable-field="hero_images.0"
                />
              </div>
            </div>
          </Reveal>
        </section>

        {/* (2)+(3) GULD-DELARE + URVAL — bara när shopen har något att visa */}
        {shopTeasers.length > 0 ? (
          <>
            <section className={styles.lnDivider}>
              <span className={styles.lnRuleGold} />
              <span className={styles.lnDividerLabel} data-corevo-editor-field="homeGalleryEyebrow" data-corevo-editor-stable-field="homeGalleryEyebrow">
                {content.homeGalleryEyebrow ?? '◆ Floristens urval ◆'}
              </span>
              <span className={styles.lnRuleGold} />
            </section>

            <section className={styles.lnSection}>
              <ul className={styles.lnGrid3}>
                {shopTeasers.map((p, i) => (
                  <li key={p.id}>
                    <Reveal delay={i * 90}>
                      <div className={styles.lnCard}>
                        <Link
                          href={`/shop/${p.id}`}
                          className={styles.lnCardImg}
                          style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                          aria-label={`${p.name} — visa verket`}
                        >
                          <span className="sr-only">{p.imageAlt ?? p.name}</span>
                        </Link>
                        <div className={styles.lnCardBody}>
                          <h3 className={styles.lnCardName}>{p.name}</h3>
                          <p className={styles.lnCardPrice}>{formatProductPrice(p)}</p>
                          {/* Köp-rälsen bor i butiken: teaser-korten har ingen ShopConfig
                              (fulfilment) och får därför aldrig en egen korg-knapp — de
                              leder in på produktsidan där <AddToCart> är den riktiga. */}
                          <Link href={`/shop/${p.id}`} className={styles.lnGhost}>
                            Lägg i korg
                          </Link>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ul>
              <p className={styles.lnMore}>
                <Link href="/shop" className={styles.lnUnderline}>
                  <span data-corevo-editor-field="shopCta" data-corevo-editor-stable-field="shopCta">{content.shopCta ?? 'Hela samlingen →'}</span>
                </Link>
              </p>
            </section>
          </>
        ) : null}

        {/* (4) MANIFEST — citatet mellan två guldlinjer */}
        <section className={styles.lnManifest}>
          <Reveal>
            <div className={styles.lnManifestInner}>
              <p className={styles.lnManifestText} data-corevo-editor-field="italic" data-corevo-editor-stable-field="italic">{content.italic}</p>
            </div>
          </Reveal>
        </section>

        {/* (5) TRE PELARE — I · II · III */}
        <section className={styles.lnSalons}>
          {salons.map((s, i) => (
            <Reveal key={s.no} delay={i * 90}>
              {/* Onåbar modul → samma kort, men som <div>: formen bevaras, länken (och
                  därmed 404:an) försvinner. */}
              {s.href ? (
                <Link href={s.href} className={styles.lnSalon}>
                  <p className={styles.lnSalonNo}>{s.no}</p>
                  <h3 className={styles.lnSalonTitle} data-corevo-editor-field={`pillar${i + 1}Title`} data-corevo-editor-stable-field={`pillar${i + 1}Title`}>{s.title}</h3>
                  <p className={styles.lnSalonDesc} data-corevo-editor-field={`pillar${i + 1}Body`} data-corevo-editor-stable-field={`pillar${i + 1}Body`}>{s.desc}</p>
                  <span className={styles.lnSalonCta}>{s.cta} →</span>
                </Link>
              ) : (
                <div className={styles.lnSalon}>
                  <p className={styles.lnSalonNo}>{s.no}</p>
                  <h3 className={styles.lnSalonTitle} data-corevo-editor-field={`pillar${i + 1}Title`} data-corevo-editor-stable-field={`pillar${i + 1}Title`}>{s.title}</h3>
                  <p className={styles.lnSalonDesc} data-corevo-editor-field={`pillar${i + 1}Body`} data-corevo-editor-stable-field={`pillar${i + 1}Body`}>{s.desc}</p>
                </div>
              )}
            </Reveal>
          ))}
        </section>

        {/* (6) KRÖNIKAN — tre inlägg under en tunn silverdelare */}
        {bloggTeasers.length > 0 ? (
          <section className={styles.lnJournal}>
            <div className={styles.lnDividerThin}>
              <span className={styles.lnRuleThin} />
              <span className={styles.lnDividerThinLabel} data-corevo-editor-field="blogTitle" data-corevo-editor-stable-field="blogTitle">{content.blogTitle ?? 'Krönikan'}</span>
              <span className={styles.lnRuleThin} />
            </div>
            <ul className={styles.lnJournalGrid}>
              {bloggTeasers.map((b, i) => (
                <li key={b.id}>
                  <Reveal delay={i * 90}>
                    <Link href={b.slug ? `/blogg/${b.slug}` : '/blogg'}>
                      <span
                        className={styles.lnJournalImg}
                        style={
                          b.coverImageUrl
                            ? { backgroundImage: `url(${b.coverImageUrl})` }
                            : undefined
                        }
                      />
                      {b.publishedAt ? (
                        <p className={styles.lnJournalDate}>
                          {formatBloggShortDate(b.publishedAt)}
                        </p>
                      ) : null}
                      <h3 className={styles.lnJournalTitle}>{b.title}</h3>
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
