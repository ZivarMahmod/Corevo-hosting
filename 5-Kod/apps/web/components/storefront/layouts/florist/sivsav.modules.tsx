import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './sivsav.module.css'

/**
 * SIV & SÄV — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BUKETTERNA (butik) — filens `showButik`: eyebrow "Sortiment" + H1 "Buketterna", tre
 *   spalter, 4:5-foton med 24px-hörn, namn/pris på en rad, beskrivning, konturad pill
 *   "Lägg i korg". Inga skuggor.
 *
 *   JOURNALEN (blogg) — filens `showBlogg`: 900px-spalt, inläggen som vita 24px-kort med
 *   260px-bild till vänster och text till höger. Datum + tagg i spärrad salvia-versal.
 *
 * PAUSAD BUTIK: katalogen förblir läsbar men NOLL köpknappar renderas — en kund ska aldrig
 * kunna handla i en stängd butik.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ════════════════════════════════ BUKETTERNA ══════════════════════════════ */

export function SivSavShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.ssShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.ssEyebrow}>{content.shopEyebrow ?? 'Sortiment'}</p>
      <h1 className={styles.ssPageTitle}>{content.shopTitle ?? 'Buketterna'}</h1>

      {paused ? (
        <p role="status" className={styles.ssNotice}>
          Butiken är tillfälligt stängd för nya beställningar. Sortimentet står kvar — vi
          öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.ssEmpty}>Sortimentet visas snart.</p>
      ) : (
        <ul className={styles.ssShopGrid}>
          {products.map((p) => (
            <li key={p.id}>
              <a
                href={`/shop/${p.id}`}
                className={styles.ssProductImg}
                aria-label={`${p.name} — visa buketten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.ssSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.ssProductRow}>
                <h3 className={styles.ssShopName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </h3>
                <span className={styles.ssProductPrice}>
                  {formatShopPrice(p.priceCents, p.currency)}
                </span>
              </div>
              {p.description ? <p className={styles.ssShopDesc}>{p.description}</p> : null}
              {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} compact />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.ssMore}>
          <a href={moreHref} className={styles.ssUnderline}>
            {content.shopCta ?? 'Hela sortimentet →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ JOURNALEN ══════════════════════════════ */

export function SivSavBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.ssBlogg} data-module="blogg">
      <p className={styles.ssEyebrow}>{content.blogEyebrow ?? 'Journalen'}</p>
      <h1 className={styles.ssPageTitle}>{content.blogTitle ?? 'Ord om blomster'}</h1>

      {posts.length === 0 ? (
        <p className={styles.ssEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.ssPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            const href = p.slug ? `/blogg/${p.slug}` : null
            return (
              <li key={p.id}>
                <article
                  className={p.coverImageUrl ? styles.ssPostCard : styles.ssPostCardText}
                >
                  {p.coverImageUrl ? (
                    <div
                      className={styles.ssPostImg}
                      style={{ backgroundImage: `url(${p.coverImageUrl})` }}
                      role="img"
                      aria-label={p.coverImageAlt ?? p.title}
                    />
                  ) : null}
                  <div className={styles.ssPostBody}>
                    {date ? <p className={styles.ssPostMeta}>{date}</p> : null}
                    <h2 className={styles.ssPostTitle}>
                      {href ? <a href={href}>{p.title}</a> : p.title}
                    </h2>
                    {p.excerpt ? <p className={styles.ssPostExcerpt}>{p.excerpt}</p> : null}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.ssMore}>
          <a href={moreHref} className={styles.ssUnderline}>
            {content.blogCta ?? 'Alla inlägg →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
