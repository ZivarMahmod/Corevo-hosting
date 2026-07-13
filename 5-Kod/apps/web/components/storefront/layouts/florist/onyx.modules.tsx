import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './onyx.module.css'

/**
 * ONYX — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BUTIKEN (`showButik`) — "DROP 27 — VECKA 28" över "Butiken", tre kolumner i
 *   hårlinje-rastret (1px gap på #2E2E2E), kvadratiska bilder, "+ LÄGG I KASSE" som
 *   mässings-outline. Inga kort, inga skuggor, inga rundade hörn.
 *
 *   JOURNAL (`showBlogg`) — "Från studion": rader med datum + etikett i en 180px-spalt
 *   till vänster och rubrik + ingress till höger, hårlinje mellan raderna.
 *
 * PAUSAD BUTIK är HELIGT: katalogen förblir läsbar, men NOLL köpknappar renderas.
 * SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

/* ═════════════════════════════════ BUTIKEN ════════════════════════════════ */

export function OnyxShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.onShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.onEyebrow}>{content.shopEyebrow ?? 'DROP 27 — VECKA 28'}</p>
      <h1 className={styles.onPageTitleTight}>{content.shopTitle ?? 'Butiken'}</h1>
      <p className={styles.onPageLede}>
        Begränsade antal per vecka. När droppet är slut är det slut — nästa måndag kommer nya
        sorter.
      </p>

      {paused ? (
        <p role="status" className={styles.onNotice}>
          [ STÄNGT ] BUTIKEN TAR EMOT INGA NYA BESTÄLLNINGAR JUST NU.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.onEmpty}>[ TOMT ] DROPPET ÄR SLUT.</p>
      ) : (
        <ul className={styles.onGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.onCard}>
              <div className={styles.onCardMedia}>
                <a
                  href={`/shop/${p.id}`}
                  className={styles.onCardImg}
                  aria-label={`${p.name} — visa produkten`}
                  style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                >
                  <span className={styles.onSrOnly}>{p.imageAlt ?? p.name}</span>
                </a>
              </div>
              <div className={styles.onCardRow}>
                <h3 className={styles.onCardName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </h3>
                <span className={styles.onCardPrice}>
                  {formatShopPrice(p.priceCents, p.currency)}
                </span>
              </div>
              {p.description ? <p className={styles.onCardDesc}>{p.description}</p> : null}
              {/* Pausad butik → NOLL köpknappar. Katalogen är fortfarande läsbar. */}
              {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} compact />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.onMoreRow}>
          <a href={moreHref} className={styles.onLink}>
            {content.shopCta ?? 'SE ALLT →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ JOURNAL ════════════════════════════════ */

export function OnyxBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.onBlogg} data-module="blogg">
      <p className={styles.onEyebrow}>{content.blogEyebrow ?? 'JOURNAL'}</p>
      <h1 className={styles.onPageTitle}>{content.blogTitle ?? 'Från studion'}</h1>

      {posts.length === 0 ? (
        <p className={styles.onEmpty}>[ TOMT ] INGA INLÄGG ÄR PUBLICERADE ÄNNU.</p>
      ) : (
        <ul className={styles.onPostList}>
          {posts.map((p) => (
            <li key={p.id} className={styles.onPost}>
              <div>
                {p.publishedAt ? (
                  <p className={styles.onPostDate}>{p.publishedAt.slice(0, 10)}</p>
                ) : null}
              </div>
              <div>
                <h2 className={styles.onPostTitle}>
                  {p.slug ? <a href={`/blogg/${p.slug}`}>{p.title}</a> : p.title}
                </h2>
                {p.excerpt ? <p className={styles.onPostExcerpt}>{p.excerpt}</p> : null}
                {p.slug ? (
                  <a href={`/blogg/${p.slug}`} className={styles.onLink}>
                    LÄS →
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.onMoreRow}>
          <a href={moreHref} className={styles.onLink}>
            {content.blogCta ?? 'ALLA INLÄGG →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
