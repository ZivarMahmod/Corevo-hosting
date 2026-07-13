import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './snitt.module.css'

/**
 * SNITT — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   HYLLAN (butik) — filens `showButik`: tre spalter, 1:1-bilder, namn till vänster och
 *   pris i Anton-lime till höger, beskrivning under, "Lägg i korg" som inramad knapp i
 *   full bredd. Butiken är PAUSAD → katalogen läses, köpknapparna ritas inte alls.
 *
 *   JOURNAL (blogg) — filens `showJournal`: inläggen under varandra som 220px foto | text,
 *   taggen och datumet i lime mikroversal, rubriken i Anton-versaler.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ══════════════════════════════════ HYLLAN ════════════════════════════════════ */

export function SnittShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.snShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.snEyebrow}>
        <span className={styles.snDash}>—</span> {content.shopEyebrow ?? 'Butik'}
      </p>
      <h1 className={styles.snPageTitle}>
        {content.shopTitle ?? 'Hyllan'}
        <span className={styles.snDot}>.</span>
      </h1>
      <p className={styles.snPageLede}>
        Det vi jobbar med vid stolarna. Inget vi inte själva har hemma.
      </p>

      {paused ? (
        <p role="status" className={styles.snNotice}>
          Hyllan är tillfälligt stängd för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.snEmpty}>Hyllan är tom just nu.</p>
      ) : (
        <ul className={styles.snShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.snCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.snShopImg}
                aria-label={`${p.name} — visa produkten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.snSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.snCardBody}>
                <div className={styles.snShopHead}>
                  <h3 className={styles.snShopName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  <span className={styles.snShopPrice}>
                    {formatShopPrice(p.priceCents, p.currency)}
                  </span>
                </div>
                {p.description ? <p className={styles.snShopDesc}>{p.description}</p> : null}
                {/* Pausad butik → NOLL köpknappar. Katalogen är läsbar, kassan är stängd. */}
                {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.snShopMore}>
          <a href={moreHref} className={styles.snLink}>
            {content.shopCta ?? 'Hela hyllan →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ JOURNAL ════════════════════════════════════ */

export function SnittBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.snBlogg} data-module="blogg">
      <p className={styles.snEyebrow}>
        <span className={styles.snDash}>—</span> {content.blogEyebrow ?? 'Ur stolen'}
      </p>
      <h1 className={styles.snPageTitleAlone}>
        {content.blogTitle ?? 'Journal'}
        <span className={styles.snDot}>.</span>
      </h1>

      {posts.length === 0 ? (
        <p className={styles.snEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.snPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.snPost}>
                  <span
                    className={styles.snPostPhoto}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  />
                  <span className={styles.snPostBody}>
                    {date ? <span className={styles.snPostMeta}>{date}</span> : null}
                    <span className={styles.snPostTitle}>{p.title}</span>
                    {p.excerpt ? <span className={styles.snPostExcerpt}>{p.excerpt}</span> : null}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.snBloggMore}>
          <a href={moreHref} className={styles.snLink}>
            {content.blogCta ?? 'Hela journalen →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
