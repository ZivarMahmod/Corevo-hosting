import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './siluett.module.css'

/**
 * SILUETT — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BUTIKEN (showButik) — eyebrow "Det vi själva använder vid stolen", Bodoni-h1 58px,
 *   TRE spalter med 1:1-foto, hårlinje under fotot, namn i Bodoni + pris i grotesk på
 *   samma baslinje, och "Lägg i kasse" som hårlinje-knapp. Inga rundade hörn, inga skuggor.
 *   Filens kategori-filter (Allt/Schampo/Vård/Styling) hör till mockdatan och är INTE
 *   återskapat — kundens katalog har sina egna kategorier och shop-modulen äger urvalet.
 *
 *   JOURNAL (showJournal) — 2px-linje överst, sedan rader: text till vänster (datum i
 *   elviolett mikroversal, Bodoni-rubrik 30px, ingress), 3:2-bild till höger.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═══════════════════════════════════ BUTIKEN ══════════════════════════════ */

export function SiluettShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.siShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.siEyebrow}>
        {content.shopEyebrow ?? 'Det vi själva använder vid stolen'}
      </p>
      <h1 className={styles.siShopTitle}>{content.shopTitle ?? 'Butiken'}</h1>

      {/* Pausad butik: katalogen är läsbar, köp-CTA:erna stängda. Modulens regel, inte mallens. */}
      {paused ? (
        <p role="status" className={styles.siNotice}>
          Butiken är tillfälligt stängd för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.siEmpty}>Butiken är tom just nu.</p>
      ) : (
        <ul className={styles.siShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.siShopCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.siShopImg}
                aria-label={`${p.name} — visa produkten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.siSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.siShopBody}>
                <div className={styles.siShopHead}>
                  <h3 className={styles.siShopName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  <span className={styles.siShopPrice}>
                    {formatShopPrice(p.priceCents, p.currency)}
                  </span>
                </div>
                {p.description ? <p className={styles.siShopDesc}>{p.description}</p> : null}
                {paused ? null : (
                  <div className={styles.siShopBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={`${styles.siUnderline} ${styles.siMoreLink}`}>
          {content.shopCta ?? 'Hela butiken →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════════ JOURNAL ══════════════════════════════ */

export function SiluettBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.siBlogg} data-module="blogg">
      <h1 className={styles.siPageTitle}>{content.blogTitle ?? 'Journal'}</h1>

      {posts.length === 0 ? (
        <p className={styles.siEmpty}>Inga texter är publicerade ännu.</p>
      ) : (
        <ul className={styles.siPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a href={p.slug ? `/blogg/${p.slug}` : undefined} className={styles.siPostRow}>
                  <div>
                    {date ? <p className={styles.siPostMeta}>{date}</p> : null}
                    <h2 className={styles.siPostTitle}>{p.title}</h2>
                    {p.excerpt ? <p className={styles.siPostExcerpt}>{p.excerpt}</p> : null}
                  </div>
                  <div
                    className={styles.siPostPhoto}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                    role={p.coverImageAlt ? 'img' : undefined}
                    aria-label={p.coverImageAlt ?? undefined}
                  />
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={`${styles.siUnderline} ${styles.siMoreLink}`}>
          {content.blogCta ?? 'Alla texter →'}
        </a>
      ) : null}
    </section>
  )
}
