import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './solsalt.module.css'

/**
 * SOL & SALT — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart> och priset formateras alltid av formatShopPrice. Formen är mallens, exakt som
 * .dc.html ritar den:
 *
 *   BODEN (butik) — filens `showButik`: eyebrow "Sortiment" + H1 "Boden", sedan TRE kolumner
 *   med papperskort (24px radie, 2px solid "skugga" i #EADDBB), 1:1-bild, namn i DM Serif mot
 *   terrakotta-pris, och en kobolt fullbredds-pill som blir terrakotta vid hover.
 *   Filens kategori-pills (Allt/Buketter/Krukväxter/Enkla) är MOCK-state i .dc-filen och har
 *   ingen motsvarighet i shop-datan (produkterna bär ingen kategori) — de ritas därför inte
 *   alls hellre än som döda knappar.
 *
 *   FRÅN BODEN (blogg) — filens `showBlogg`: en 900px-spalt, inläggen som liggande papperskort
 *   med 250px-foto i 4:3 till vänster och "TAGG · DATUM" i terrakotta över rubriken.
 *
 * `paused` respekteras: katalogen förblir läsbar, men NOLL köpknappar ritas.
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ═════════════════════════════════ BODEN ══════════════════════════════════ */

export function SolSaltShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.slShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.slEyebrow}>{content.shopEyebrow ?? 'Sortiment'}</p>
      <h1 className={styles.slPageTitle}>{content.shopTitle ?? 'Boden'}</h1>

      {paused ? (
        <p role="status" className={styles.slNotice}>
          Boden är tillfälligt stängd för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.slEmpty}>Boden är tom just nu.</p>
      ) : (
        <ul className={styles.slGrid3}>
          {products.map((p) => (
            <li key={p.id} className={styles.slCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.slCardImg}
                aria-label={`${p.name} — visa varan`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.slSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.slCardBody}>
                <div className={styles.slCardHead}>
                  <h3 className={styles.slCardName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  <span className={styles.slCardPrice}>
                    {formatShopPrice(p.priceCents, p.currency)}
                  </span>
                </div>
                {p.description ? <p className={styles.slCardDesc}>{p.description}</p> : null}
                {/* Pausad butik → katalogen läsbar, NOLL köpknappar. */}
                {paused ? null : (
                  <div className={styles.slCardBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} compact />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={`${styles.slLink} ${styles.slMore}`}>
          {content.shopCta ?? 'Hela sortimentet →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════ FRÅN BODEN ═══════════════════════════════ */

export function SolSaltBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.slBlogg} data-module="blogg">
      <h1 className={styles.slPageTitle}>{content.blogTitle ?? 'Från boden'}</h1>

      {posts.length === 0 ? (
        <p className={styles.slEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.slPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            const href = p.slug ? `/blogg/${p.slug}` : null
            return (
              <li key={p.id}>
                <article className={styles.slPostRow}>
                  <div
                    className={styles.slPostImg}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                    role={p.coverImageUrl ? 'img' : undefined}
                    aria-label={p.coverImageUrl ? (p.coverImageAlt ?? p.title) : undefined}
                  />
                  <div className={styles.slPostBody}>
                    {date ? <p className={styles.slPostMeta}>{date}</p> : null}
                    <h2 className={styles.slPostTitle}>
                      {href ? <a href={href}>{p.title}</a> : p.title}
                    </h2>
                    {p.excerpt ? <p className={styles.slPostExcerpt}>{p.excerpt}</p> : null}
                    {href ? (
                      <a href={href} className={styles.slLink}>
                        Läs vidare →
                      </a>
                    ) : null}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={`${styles.slLink} ${styles.slMore}`}>
          {content.blogCta ?? 'Läs allt från boden →'}
        </a>
      ) : null}
    </section>
  )
}
