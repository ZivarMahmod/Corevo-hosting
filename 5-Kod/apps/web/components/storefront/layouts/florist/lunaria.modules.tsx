import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   SALONGEN (butik) — filens `showButik`: centrerad eyebrow ("Kollektion VII") + 52px
 *   Poiret One-rubrik, sedan TRE kolumner med inramade kort (silverram som guldnar vid
 *   hover), 4:5-bild, namn i display, beskrivning i tunn grotesk, pris i guld och den
 *   INRAMADE guldknappen. Inga skuggor, inga rundade hörn.
 *
 *   KRÖNIKAN (blogg) — filens `showBlogg`: en 900px-spalt med inlägg under varandra,
 *   240px-bild i 4:3 till vänster och texten till höger, allt i en silverram som guldnar.
 *
 * PAUSAD BUTIK: katalogen är läsbar, men NOLL köpknappar (annars kan en kund handla i en
 * stängd butik). SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ════════════════════════════════ SALONGEN ════════════════════════════════ */

export function LunariaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.lnShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.lnPageEyebrow}>{content.shopEyebrow ?? 'Kollektion VII'}</p>
      <h1 className={styles.lnPageTitle}>{content.shopTitle ?? 'Salongen'}</h1>

      {paused ? (
        <p role="status" className={styles.lnNotice}>
          Salongen tar för närvarande inte emot nya beställningar. Vi öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.lnEmpty}>Salongen är tom just nu.</p>
      ) : (
        <ul className={styles.lnGrid3}>
          {products.map((p) => (
            <li key={p.id}>
              <div className={styles.lnCard}>
                <a
                  href={`/shop/${p.id}`}
                  className={styles.lnCardImg}
                  aria-label={`${p.name} — visa verket`}
                  style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                >
                  <span className={styles.lnSrOnly}>{p.imageAlt ?? p.name}</span>
                </a>
                <div className={styles.lnCardBody}>
                  <h3 className={styles.lnCardName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  {p.description ? <p className={styles.lnCardDesc}>{p.description}</p> : null}
                  <p className={styles.lnCardPrice}>
                    {formatShopPrice(p.priceCents, p.currency)}
                  </p>
                  {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} compact />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.lnMore}>
          <a href={moreHref} className={styles.lnUnderline}>
            {content.shopCta ?? 'Hela samlingen →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ════════════════════════════════ KRÖNIKAN ════════════════════════════════ */

export function LunariaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.lnBlogg} data-module="blogg">
      <h1 className={styles.lnPageTitle}>{content.blogTitle ?? 'Krönikan'}</h1>

      {posts.length === 0 ? (
        <p className={styles.lnEmpty}>Inga krönikor är publicerade ännu.</p>
      ) : (
        <ul className={styles.lnPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a className={styles.lnPost} href={p.slug ? `/blogg/${p.slug}` : '/blogg'}>
                  <span
                    className={styles.lnPostImg}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  >
                    <span className={styles.lnSrOnly}>{p.coverImageAlt ?? p.title}</span>
                  </span>
                  <span className={styles.lnPostBody}>
                    {date ? <span className={styles.lnPostMeta}>{date}</span> : null}
                    <span className={styles.lnPostTitle}>{p.title}</span>
                    {p.excerpt ? <span className={styles.lnPostExcerpt}>{p.excerpt}</span> : null}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.lnMore}>
          <a href={moreHref} className={styles.lnUnderline}>
            {content.blogCta ?? 'Hela krönikan →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
