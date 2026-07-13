import { AddToCart } from '../../shop/AddToCart'
import { JoinClubForm } from '../../lojalitet/JoinClubForm'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import { formatPlanPrice, loyaltyIntervalLabel } from '@/lib/storefront/lojalitet/types'
import type {
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeGalleriViewProps,
  ThemeLojalitetViewProps,
} from './types'
import styles from './ateljevinter.module.css'

/**
 * ATELJÉ VINTER — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   SAMLINGEN (butik) — filens `showButik`: TVÅ spalter (inte tre), 5:6-bilder, en hårlinje
 *   mellan namn/pris och beskrivningen, "+ förvärva" som hårlinje-knapp längst ner till
 *   höger. Inga kort, inga skuggor, inga rundade hörn.
 *
 *   ANTECKNINGAR (blogg) — filens `showBlogg`: en smal spalt (640px), inlägg under varandra
 *   med 64px luft, datum i primärfärg, ingen bild. Bloggen i den här mallen ÄR text.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ════════════════════════════════ SAMLINGEN ═══════════════════════════════ */

export function AteljeVinterShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.avShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.avEyebrow}>{content.shopEyebrow ?? 'samling nr 14'}</p>
      <h1 className={styles.avPageTitle}>{content.shopTitle ?? 'samlingen'}</h1>

      {paused ? (
        <p role="status" className={styles.avNotice}>
          samlingen är tillfälligt stängd för nya förvärv. vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.avEmpty}>samlingen är tom just nu.</p>
      ) : (
        <ul className={styles.avShopGrid}>
          {products.map((p) => (
            <li key={p.id}>
              <a
                href={`/shop/${p.id}`}
                className={styles.avShopImg}
                aria-label={`${p.name} — visa verket`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.avSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.avShopHead}>
                <p className={styles.avWorkName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </p>
                <p className={styles.avWorkPrice}>{formatProductPrice(p)}</p>
              </div>
              <div className={styles.avShopFoot}>
                {p.description ? <p className={styles.avShopDesc}>{p.description}</p> : <span />}
                {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={styles.avUnderline}>
          {content.shopCta ?? 'se hela samlingen →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════ ANTECKNINGAR ═════════════════════════════ */

export function AteljeVinterBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.avBlogg} data-module="blogg">
      <p className={styles.avEyebrow}>{content.blogEyebrow ?? 'rum iv'}</p>
      <h1 className={styles.avPageTitle}>{content.blogTitle ?? 'anteckningar'}</h1>

      {posts.length === 0 ? (
        <p className={styles.avEmpty}>inga anteckningar är publicerade ännu.</p>
      ) : (
        <ul className={styles.avPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <article>
                  {date ? <p className={styles.avPostDate}>{date}</p> : null}
                  <h2 className={styles.avPostTitle}>{p.title}</h2>
                  {p.excerpt ? <p className={styles.avPostExcerpt}>{p.excerpt}</p> : null}
                  {p.slug ? (
                    <a href={`/blogg/${p.slug}`} className={styles.avUnderline}>
                      läs anteckningen →
                    </a>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={styles.avUnderline}>
          {content.blogCta ?? 'läs alla anteckningar →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ ARKIVET ════════════════════════════════ */

/**
 * Filens `showGalleri`: EN smal spalt (840px), verken under varandra med 80px luft,
 * bildens proportion styrd per verk (3/2 eller 4/5 i filen — därav `aspectRatio` i
 * kontraktet), och en bildtext som ligger som en hårlinjerad rad under: motivet till
 * vänster, årtalet till höger. Inga kort, ingen ram, ingen skugga.
 *
 * Tomt arkiv → en ärlig rad, aldrig stock-foton som utges för att vara ateljéns arbeten.
 */
export function AteljeVinterGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.avGalleri} data-module="galleri">
      <p className={styles.avEyebrow}>{content.galleryEyebrow ?? 'rum iii'}</p>
      <h1 className={styles.avPageTitle}>{content.galleryTitle ?? 'arkivet'}</h1>

      {items.length === 0 ? (
        <p className={styles.avEmpty}>arkivet är tomt just nu.</p>
      ) : (
        <div className={styles.avGalList}>
          {items.map((g) => (
            <figure key={g.id} className={styles.avGalFig}>
              {g.imageUrl ? (
                <div
                  className={styles.avGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{
                    backgroundImage: `url(${g.imageUrl})`,
                    aspectRatio: g.aspectRatio ?? '3/2',
                  }}
                />
              ) : null}
              {g.caption || g.yearLabel ? (
                <figcaption className={styles.avGalCap}>
                  <span className={styles.avGalCaption}>{g.caption}</span>
                  <span className={styles.avGalYear}>{g.yearLabel}</span>
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}

/* ════════════════════════════════ VÄNKRETSEN ══════════════════════════════ */

/**
 * Filens `showVanner`: 560px, centrerat, och medlemskapet är EN mening + ett fält.
 * Formuläret ligger inklämt mellan två hårlinjer (44px luft), knappen är mörk och fyrkantig.
 *
 * Funktionen är plattformens: <JoinClubForm> bär server-actionen (joinLoyaltyClub) och
 * dess tack-läge. Formen är mallens — därför stylas formulärets element via .avClubJoin
 * i mallens egen CSS i stället för att JoinClubForm får en mall-prop.
 *
 * Ateljé Vinters klubb har INGA nivåer i sitt paket (gratis, alltid) — men om ägaren har
 * lagt upp nivåer i klubben renderas de som en hårlinjerad lista, aldrig som påhittade
 * priskort. Tomt = ingenting.
 */
export function AteljeVinterLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  return (
    <section className={styles.avClub} data-module="lojalitet" data-variant={config.variant}>
      <p className={styles.avEyebrow}>{content.clubEyebrow ?? 'vänkretsen'}</p>
      <h1 className={styles.avPageTitle}>{content.clubTitle ?? 'först till samlingen'}</h1>
      <p className={styles.avClubLede}>{content.clubLede ?? config.perkText}</p>

      {config.perks && config.perks.length > 0 ? (
        <ul className={styles.avClubPerks}>
          {config.perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
      ) : null}

      {plans.length > 0 ? (
        <ul className={styles.avClubPlans}>
          {plans.map((p) => (
            <li key={p.id} data-featured={p.featured ? 'true' : undefined}>
              <span className={styles.avPlanName}>{p.name}</span>
              <span className={styles.avPlanPrice}>
                {formatPlanPrice(p.priceCents)} {loyaltyIntervalLabel(p.interval)}
              </span>
              {p.perks.length > 0 ? (
                <span className={styles.avPlanPerks}>{p.perks.join(' · ')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.avClubBand}>
        <div className={styles.avClubJoin}>
          <JoinClubForm cta={content.clubCta ?? 'gå med'} />
        </div>
      </div>

      {content.clubNote ? <p className={styles.avClubNote}>{content.clubNote}</p> : null}
    </section>
  )
}
