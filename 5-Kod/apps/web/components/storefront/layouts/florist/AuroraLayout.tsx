import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './aurora.module.css'

/**
 * AURORA — ROMANTISK STUDIO (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Aurora - Romantisk Studio.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HERO           — text vänster (etikett, rubrik, lede, två CTA:er, tre ✿-löften),
 *                        valv-foto höger med kursiv bildtext under
 *   (2) DE TRE VÄGARNA — buketter · bröllop · kurser, som höga valv-kort
 *   (3) CITAT-BANDET   — blush-platta, en kursiv mening, en 44px hårlinje under
 *   (4) VECKANS FAVORITER — tre produkter ur shop-modulen + "Hela sortimentet"
 *   (5) PRESENTKORT + KURSER — två band sida vid sida
 *   (6) STUDION        — spegelvänt valv-foto vänster, om-texten höger
 *   (7) FRÅN STUDION   — två blogg-rader (bild vänster, text höger)
 *   (8) AVSLUTNINGEN   — helbreddsfoto med scrim, vit knapp
 *
 * Filen har inget galleri-band på hemmet (galleriet är en EGEN sida i .dc-filen) — och då
 * har inte mallen det heller. Att lägga till en sektion "för att syskonen har en" ÄR att
 * improvisera bort mallen (CLAUDE.md § DESIGN-TROHET).
 *
 * Modul-gatingen är plattformens och HELIG: favoriterna ritas bara när shopen har teasers,
 * väg-korten bara mot moduler som går att nå, presentkort-bandet bara när modulen är live.
 * En avstängd modul får inte ge EN enda länk till sin sida (404-fällan).
 *
 * SYNKRON komponent (ingen async, ingen 'use client') — onboarding-studions preview
 * renderar samma komponent.
 */
export function AuroraLayout({ content, modules }: StorefrontLayoutProps) {
  // Filen visar TRE favoriter på hemmet (homeProducts = products.slice(0, 3))…
  const favorites = (modules?.shopTeasers ?? []).slice(0, 3)
  // …och TVÅ blogg-rader (homeBlog = blog.slice(0, 2)).
  const posts = (modules?.bloggTeasers ?? []).slice(0, 2)
  // Saknad reachability failar stängt; onboarding-previewns modulytor renderas separat.
  const shopReachable = modules?.shopReachable ?? false
  const offertReachable = modules?.offertReachable ?? false
  const presentkortReachable = modules?.presentkortReachable ?? false
  // goal-64: klubben har en publik sida nu (/klubb). Modul av → ingen länk (404-fällan).
  const klubbReachable = modules?.lojalitetReachable ?? false
  const kurserReachable = modules?.kurserReachable ?? false

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const [pathBukett, pathBrollop, pathKurs] = content.galleryImages

  // Filens `paths` — de tre vägarna in i sajten. Varje väg ÄR en modul, och en modul som
  // inte går att nå får ingen ruta: annars leder valvet rakt in i en 404.
  const paths = [
    shopReachable
      ? {
          key: 'butik',
          title: 'Buketter',
          desc: 'Handbundna, varje morgon.',
          cta: 'till butiken',
          img: pathBukett ?? heroPhoto,
          href: '/shop',
        }
      : null,
    offertReachable
      ? {
          key: 'brollop',
          title: 'Bröllop',
          desc: 'Er dag, i blom.',
          cta: 'läs mer',
          img: pathBrollop ?? heroPhoto,
          href: '/offert',
        }
      : null,
    kurserReachable
      ? {
          key: 'kurser',
          title: 'Kurser & event',
          desc: 'Bind din egen bukett.',
          cta: 'se datum',
          img: pathKurs ?? heroPhoto,
          href: '/kurser',
        }
      : null,
  ].filter((p): p is NonNullable<typeof p> => p !== null)

  return (
    <div className={styles.auRoot}>
      {/* (1) HERO */}
      <section className={styles.auHero}>
        <Reveal>
          <p className={styles.auEyebrow}>{content.heroEyebrow}</p>
          <h1 className={styles.auHeroTitle}>{content.heroTitle}</h1>
          <p className={styles.auHeroLede}>{content.heroLede}</p>
          <div className={styles.auHeroCtas}>
            {shopReachable ? (
              <Link href="/shop" className={styles.auBtn}>
                Se buketterna
              </Link>
            ) : (
              <Link href="/tjanster" className={styles.auBtn}>
                Se vad vi gör
              </Link>
            )}
            {offertReachable ? (
              <Link href="/offert" className={styles.auLink}>
                till bröllopet →
              </Link>
            ) : null}
          </div>
          <div className={styles.auUsps}>
            <p className={styles.auUsp}>Samma dag-leverans</p>
            <p className={styles.auUsp}>Handbundet varje morgon</p>
            <p className={styles.auUsp}>Handskrivna kort</p>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className={styles.auHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }} />
          <p className={styles.auHeroCaption}>ur studion, bunden i morse</p>
        </Reveal>
      </section>

      {/* (2) DE TRE VÄGARNA */}
      <section className={styles.auSection}>
        <div className={styles.auGrid3}>
          {paths.map((p, i) => (
            <Reveal key={p.key} delay={i * 90}>
              <Link href={p.href} className={styles.auPath}>
                <span
                  className={styles.auPathImg}
                  style={p.img ? { backgroundImage: `url(${p.img})`, display: 'block' } : { display: 'block' }}
                />
                <span className={styles.auPathTitle} style={{ display: 'block' }}>
                  {p.title}
                </span>
                <span className={styles.auPathDesc} style={{ display: 'block' }}>
                  {p.desc}
                </span>
                <span className={styles.auPathCta}>{p.cta} →</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* (3) CITAT-BANDET */}
      <section className={styles.auQuote}>
        <Reveal>
          <p className={styles.auQuoteText}>{content.italic}</p>
          <div className={styles.auQuoteRule} />
        </Reveal>
      </section>

      {/* (4) VECKANS FAVORITER — shop-modulens data, mallens form. Teaser-propen bär ingen
          ShopConfig (och därmed ingen fulfilment), så köpet sker där kontraktet finns: på
          produktsidan, med modulens egen <AddToCart>. Mallen bygger ALDRIG egen korg-logik
          — samma väg som pilotmallen tar. */}
      {favorites.length > 0 ? (
        <section className={styles.auSection}>
          <Reveal className={styles.auSecHead}>
            <p className={styles.auEyebrow}>{content.shopEyebrow ?? 'Veckans favoriter'}</p>
            <h2 className={styles.auSecTitle}>{content.shopTitle ?? 'Mest älskade just nu'}</h2>
          </Reveal>
          <ul className={styles.auGrid3} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {favorites.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 90}>
                  <Link
                    href={`/shop/${p.id}`}
                    className={styles.auProdImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    aria-label={`${p.name} — visa buketten`}
                  >
                    <span className={styles.auSrOnly}>{p.imageAlt ?? p.name}</span>
                  </Link>
                  <div className={styles.auProdRow}>
                    <p className={styles.auProdName}>{p.name}</p>
                    <p className={styles.auProdPrice}>
                      {formatProductPrice(p)}
                    </p>
                  </div>
                  {p.description ? <p className={styles.auProdDesc}>{p.description}</p> : null}
                  <Link href={`/shop/${p.id}`} className={styles.auLink}>
                    lägg i korgen →
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className={styles.auSecFoot}>
            <Link href="/shop" className={styles.auBtnOutline}>
              {content.shopCta ?? 'Hela sortimentet'}
            </Link>
          </p>
        </section>
      ) : null}

      {/* (5) PRESENTKORT + KLUBBEN — bandet ritas bara när presentkort-modulen är live.
          goal-64: filens ANDRA band ÄR Blomsterklubben (lojalitet). Det hade ingen publik
          sida i plattformen och pekade därför på kurs-vägen i stället. Klubben har nu en
          riktig sida (/klubb) → bandet är filens igen, när modulen går att nå. Lojalitet
          av → kurs-bandet som förr (aldrig en länk till en stängd modul). */}
      {presentkortReachable ? (
        <section className={styles.auSection}>
          <div className={styles.auBands}>
            <Reveal>
              <Link href="/presentkort" className={styles.auBand}>
                <span className={styles.auEyebrow} style={{ display: 'block' }}>
                  {content.giftEyebrow ?? 'Presentkort'}
                </span>
                <span className={styles.auBandTitle} style={{ display: 'block' }}>
                  Ge bort blomsterglädje
                </span>
                <span className={styles.auBandText} style={{ display: 'block' }}>
                  {content.giftLede ??
                    'Valfritt belopp, giltigt ett år — skickas vackert inslaget eller digitalt.'}
                </span>
                <span className={styles.auLink}>{content.giftCta ?? 'till presentkorten →'}</span>
              </Link>
            </Reveal>
            <Reveal delay={90}>
              {klubbReachable ? (
                <Link href="/klubb" className={styles.auBandWhite}>
                  <span className={styles.auEyebrow} style={{ display: 'block' }}>
                    Blomsterklubben
                  </span>
                  <span className={styles.auBandTitle} style={{ display: 'block' }}>
                    Blommor hem varje månad
                  </span>
                  <span className={styles.auBandText} style={{ display: 'block' }}>
                    Samla stämplar, få förmåner och gå med i klubben.
                  </span>
                  <span className={styles.auLink}>till klubben →</span>
                </Link>
              ) : kurserReachable ? (
                <Link href="/kurser" className={styles.auBandWhite}>
                  <span className={styles.auEyebrow} style={{ display: 'block' }}>
                    Kurser &amp; event
                  </span>
                  <span className={styles.auBandTitle} style={{ display: 'block' }}>
                    Bind din egen bukett
                  </span>
                  <span className={styles.auBandText} style={{ display: 'block' }}>
                    Små grupper, mycket blommor och fika i studion. Alla nivåer är välkomna.
                  </span>
                  <span className={styles.auLink}>se datum →</span>
                </Link>
              ) : (
                <div className={styles.auBandWhite}>
                  <span className={styles.auEyebrow} style={{ display: 'block' }}>
                    Kurser &amp; event
                  </span>
                  <span className={styles.auBandTitle} style={{ display: 'block' }}>
                    Bind din egen bukett
                  </span>
                  <span className={styles.auBandText} style={{ display: 'block' }}>
                    Nya datum publiceras här när de är klara.
                  </span>
                </div>
              )}
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* (6) STUDION */}
      <section className={styles.auAbout}>
        <Reveal>
          <div
            className={styles.auAboutPhoto}
            style={
              content.aboutImage ? { backgroundImage: `url(${content.aboutImage})` } : undefined
            }
          />
        </Reveal>
        <Reveal delay={140}>
          <p className={styles.auEyebrow}>{content.teamEyebrow ?? 'Studion'}</p>
          <h2 className={styles.auAboutTitle}>{content.aboutTitle}</h2>
          <p className={styles.auAboutText}>{content.aboutCopy}</p>
          <p className={styles.auAboutText}>
            Kom förbi på en kaffe, boka en kurs, eller beställ online — det blir fint, det
            lovar vi.
          </p>
          <Link href="/om" className={styles.auAboutLink}>
            läs vår historia →
          </Link>
        </Reveal>
      </section>

      {/* (7) FRÅN STUDION — blogg-modulens data, mallens rad-form. */}
      {posts.length > 0 ? (
        <section className={styles.auSectionNarrow}>
          <Reveal className={styles.auSecHead}>
            <p className={styles.auEyebrow}>{content.blogEyebrow ?? 'Bloggen'}</p>
            <h2 className={styles.auSecTitle}>{content.blogTitle ?? 'Från studion'}</h2>
          </Reveal>
          <ul className={styles.auPostList}>
            {posts.map((post, i) => (
              <li key={post.id}>
                <Reveal delay={i * 90}>
                  <Link
                    href={post.slug ? `/blogg/${post.slug}` : '/blogg'}
                    className={styles.auPostCard}
                  >
                    <span
                      className={styles.auPostImg}
                      style={
                        post.coverImageUrl
                          ? { backgroundImage: `url(${post.coverImageUrl})` }
                          : undefined
                      }
                    />
                    <span>
                      {post.publishedAt ? (
                        <span className={styles.auPostDate} style={{ display: 'block' }}>
                          {formatPostDate(post.publishedAt)}
                        </span>
                      ) : null}
                      <span className={styles.auPostTitle} style={{ display: 'block' }}>
                        {post.title}
                      </span>
                      {post.excerpt ? (
                        <span className={styles.auPostExcerpt} style={{ display: 'block' }}>
                          {post.excerpt}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* (8) AVSLUTNINGEN */}
      <section
        className={styles.auClosing}
        style={
          content.closingImage ? { backgroundImage: `url(${content.closingImage})` } : undefined
        }
      >
        <div className={styles.auClosingScrim} />
        <div className={styles.auClosingInner}>
          <h2 className={styles.auClosingTitle}>Gör någons dag idag</h2>
          <p className={styles.auClosingLede}>
            Beställ före kl 14 så levererar vi samma dag, med ett handskrivet kort.
          </p>
          <Link href={shopReachable ? '/shop' : '/kontakt'} className={styles.auBtnWhite}>
            {shopReachable ? 'Se buketterna' : 'Hör av dig'}
          </Link>
        </div>
      </section>
    </div>
  )
}

/** Filens datumform på blogg-raderna ("2 juli 2026"). */
function formatPostDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}
