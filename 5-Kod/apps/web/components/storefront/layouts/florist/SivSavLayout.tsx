import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { BookCta } from '@/components/brand/BookCta'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import { formatBloggShortDate } from '@/lib/storefront/blogg/types'
import type { StorefrontLayoutProps } from '../types'
import styles from './sivsav.module.css'

/**
 * SIV & SÄV — SKANDINAVISKT LJUST (goal-64, Claude Design-paketet).
 *
 * Hemmet är en EXAKT kopia av `showHem`-blocket i "Siv & Säv - Skandinaviskt.dc.html",
 * sektion för sektion, i filens ordning:
 *
 *   (1) HERO            — två spalter: eyebrow/H1/lede + två CTA:er till vänster,
 *                         portalfotot (200px upptill, 24px nedtill) i 4:5 till höger
 *   (2) TRE LÖFTEN      — tre kolumner mellan två hårlinjer ("Bundet i säsong" …)
 *   (3) VECKANS BUKETTER— tre produkter, 4:5-foto, namn/pris på rad, "Lägg i korg"
 *   (4) OM-BAND         — salviaplatta (32px radie): text | kvadratiskt foto
 *   (5) JOURNALEN       — tre blogg-kort, 16:11-foto, datum + rubrik
 *
 * Filen har varken galleri-band, presentkorts-rad eller kurs-band på hemmet — och då har
 * inte mallen det heller. De modulerna nås via nav och sidfot, precis som i filen. Att
 * lägga till en sektion "för att syskonmallarna har en" ÄR att improvisera bort mallen
 * (se AGENTS.md:s UI-acceptansregel).
 *
 * MODUL-GATINGEN är plattformens och HELIG: buketterna ritas bara när shopen har teasers,
 * journalen bara när bloggen har inlägg, och "Se buketterna" pekar på /tjanster när shopen
 * inte går att nå — noll länkar till en avstängd modul. Köpknappen är modulens EGEN
 * <AddToCart> (aldrig en egen korg-logik). SYNKRON komponent (ingen async, ingen
 * 'use client') — onboarding-studions preview renderar samma komponent.
 */
export function SivSavLayout({ content, modules }: StorefrontLayoutProps) {
  const bookingReachable = modules?.bookingReachable ?? false
  // Filen visar TRE buketter på hemmet (products.slice(0, 3)) och TRE inlägg (blog.slice(0, 3)).
  const products = (modules?.shopTeasers ?? []).slice(0, 3)
  const posts = (modules?.bloggTeasers ?? []).slice(0, 3)
  // Saknad reachability failar stängt; onboarding-previewns modulytor renderas separat.
  const shopReachable = modules?.shopReachable ?? false

  const heroPhoto = content.heroImages[0] ?? content.galleryImages[0] ?? ''
  const aboutPhoto = content.aboutImage ?? content.galleryImages[1] ?? ''

  // Filens tre löften, verbatim. Redigerbara via pillar-nycklarna (extraHome).
  const promises = [
    {
      title: content.pillar1Title ?? 'Bundet i säsong',
      desc:
        content.pillar1Body ??
        'Vi arbetar med det som växer just nu — därför ser buketten olika ut vecka till vecka.',
    },
    {
      title: content.pillar2Title ?? 'Samma dag',
      desc:
        content.pillar2Body ??
        'Beställ före kl 13 så levererar vårt bud inom Stockholm samma eftermiddag.',
    },
    {
      title: content.pillar3Title ?? 'Håller en vecka',
      desc:
        content.pillar3Body ??
        'Skötselråd följer med varje bukett. Håller den inte sju dagar binder vi en ny.',
    },
  ]

  return (
    <div className={styles.ssRoot}>
      <div className={styles.ssWrap}>
        {/* (1) HERO */}
        <section className={styles.ssHero}>
          <Reveal>
            <p className={styles.ssHeroEyebrow} data-corevo-editor-field="heroEyebrow" data-corevo-editor-stable-field="heroEyebrow">{content.heroEyebrow}</p>
            <h1 className={styles.ssHeroTitle} data-corevo-editor-field="heroTitle" data-corevo-editor-stable-field="heroTitle">{content.heroTitle}</h1>
            <p className={styles.ssHeroLede} data-corevo-editor-field="heroLede" data-corevo-editor-stable-field="heroLede">{content.heroLede}</p>
            <div className={styles.ssHeroCtas}>
              {/* Filens "Se buketterna" → butiken. Är shopen av finns ingen butik att
                  peka på: då blir tjänstelistan vägen in, aldrig en död länk. */}
              <Link href={shopReachable ? '/shop' : '/tjanster'} className={styles.ssSolid}>
                {shopReachable ? 'Se buketterna' : 'Se vad vi gör'}
              </Link>
              {/* "Boka en tid →" är en HANDLING → plattformens boknings-drawer. */}
              <BookCta
                enabled={bookingReachable}
                className={styles.ssUnderline}
                label="Boka en tid →"
              />
            </div>
          </Reveal>
          <Reveal delay={140}>
            <div className={styles.ssHeroPhoto} style={{ backgroundImage: `url(${heroPhoto})` }} data-corevo-editor-field="hero_images.0" data-corevo-editor-stable-field="hero_images.0" />
          </Reveal>
        </section>

        {/* (2) TRE LÖFTEN */}
        <section className={styles.ssPromises}>
          {promises.map((pr, i) => (
            <Reveal key={pr.title} delay={i * 90}>
              <p className={styles.ssPromiseTitle} data-corevo-editor-field={`pillar${i + 1}Title`} data-corevo-editor-stable-field={`pillar${i + 1}Title`}>{pr.title}</p>
              <p className={styles.ssPromiseDesc} data-corevo-editor-field={`pillar${i + 1}Body`} data-corevo-editor-stable-field={`pillar${i + 1}Body`}>{pr.desc}</p>
            </Reveal>
          ))}
        </section>

        {/* (3) VECKANS BUKETTER — bara när shopen faktiskt har produkter. */}
        {products.length > 0 ? (
          <section className={styles.ssSection}>
            <Reveal className={styles.ssSecHead}>
              <div>
                <p className={styles.ssEyebrow} data-corevo-editor-field="shopEyebrow" data-corevo-editor-stable-field="shopEyebrow">{content.shopEyebrow ?? 'Just nu'}</p>
                <h2 className={styles.ssSecTitle} data-corevo-editor-field="shopTitle" data-corevo-editor-stable-field="shopTitle">{content.shopTitle ?? 'Veckans buketter'}</h2>
              </div>
              <Link href="/shop" className={styles.ssSecLink}>
                <span data-corevo-editor-field="shopCta" data-corevo-editor-stable-field="shopCta">{content.shopCta ?? 'Hela sortimentet →'}</span>
              </Link>
            </Reveal>
            <ul className={styles.ssProductGrid}>
              {products.map((p, i) => (
                <li key={p.id}>
                  <Reveal delay={i * 90}>
                    <Link
                      href={`/shop/${p.id}`}
                      className={styles.ssProductImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                      aria-label={`${p.name} — visa buketten`}
                    >
                      <span className="sr-only">{p.imageAlt ?? p.name}</span>
                    </Link>
                    <div className={styles.ssProductRow}>
                      <h3 className={styles.ssProductName}>
                        <Link href={`/shop/${p.id}`}>{p.name}</Link>
                      </h3>
                      <span className={styles.ssProductPrice}>{formatProductPrice(p)}</span>
                    </div>
                    {p.description ? <p className={styles.ssProductDesc}>{p.description}</p> : null}
                    {/* Filens "Lägg i korg" på hemmet. Teaser-propen bär ingen ShopConfig
                        (och därmed ingen fulfilment), så köpet sker där kontraktet finns:
                        på produktsidan, med modulens egen <AddToCart>. Mallen bygger ALDRIG
                        en egen korg-logik. Samma väg som pilotmallen tar. */}
                    <Link href={`/shop/${p.id}`} className={styles.ssPill}>
                      Lägg i korg
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* (4) OM-BAND — salviaplattan */}
        <section className={styles.ssSectionWide}>
          <Reveal className={styles.ssAbout}>
            <div>
              <p className={styles.ssAboutEyebrow} data-corevo-editor-field="homeGalleryEyebrow" data-corevo-editor-stable-field="homeGalleryEyebrow">{content.homeGalleryEyebrow ?? 'Ateljén'}</p>
              <h2 className={styles.ssAboutTitle}>
                <span data-corevo-editor-field="aboutTitle" data-corevo-editor-stable-field="aboutTitle">{content.aboutTitle ?? 'Mindre är mer — men aldrig kallt'}</span>
              </h2>
              <p className={styles.ssAboutBody} data-corevo-editor-field="aboutCopyHome" data-corevo-editor-stable-field="aboutCopyHome">{content.aboutCopyHome ?? content.aboutCopy}</p>
              <Link href="/om" className={styles.ssUnderline}>
                Läs mer om oss →
              </Link>
            </div>
            <div
              className={styles.ssAboutPhoto}
              style={{ backgroundImage: `url(${aboutPhoto})` }}
              data-corevo-editor-field="about_image"
              data-corevo-editor-stable-field="about_image"
            />
          </Reveal>
        </section>

        {/* (5) JOURNALEN — bara när bloggen har publicerade inlägg. */}
        {posts.length > 0 ? (
          <section className={styles.ssSectionWide}>
            <Reveal className={styles.ssSecHead}>
              <h2 className={styles.ssSecTitle} data-corevo-editor-field="blogTitle" data-corevo-editor-stable-field="blogTitle">{content.blogTitle ?? 'Journalen'}</h2>
              <Link href="/blogg" className={styles.ssSecLink}>
                <span data-corevo-editor-field="blogCta" data-corevo-editor-stable-field="blogCta">{content.blogCta ?? 'Alla inlägg →'}</span>
              </Link>
            </Reveal>
            <ul className={styles.ssJournalGrid}>
              {posts.map((b, i) => (
                <li key={b.id}>
                  <Reveal delay={i * 90}>
                    <Link
                      href={b.slug ? `/blogg/${b.slug}` : '/blogg'}
                      className={styles.ssJournalCard}
                    >
                      <div
                        className={styles.ssJournalImg}
                        style={
                          b.coverImageUrl
                            ? { backgroundImage: `url(${b.coverImageUrl})` }
                            : undefined
                        }
                      />
                      {b.publishedAt ? (
                        <p className={styles.ssJournalDate}>
                          {formatBloggShortDate(b.publishedAt)}
                        </p>
                      ) : null}
                      <h3 className={styles.ssJournalTitle}>{b.title}</h3>
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
