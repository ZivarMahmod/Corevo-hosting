import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
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
                <p className={styles.avWorkPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
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
