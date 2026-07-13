import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './kalla.module.css'

/**
 * KÄLLA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   APOTEKET (butik) — filens `showButik`: eyebrow "Det vi använder i behandlingarna",
 *   rubrik "Apoteket", tre kolumner med 1:1-bilder i kort på sandvit yta, kategori i spärrad
 *   mikroversal, namn i Marcellus, pris i teal, och "Lägg i varukorg" som konturknapp.
 *   Filens kategorifilter är INTE en handling utan en vy-växling — och plattformens butik
 *   har ingen kategorimodell för produkter, så raden utelämnas hellre än fejkas.
 *
 *   ANTECKNINGAR (blogg) — filens `showJournal`: liggande kort, 220px bild till vänster,
 *   datum i teal-mikroversal, rubrik i Marcellus, ingress i Karla.
 *
 * PAUSAD BUTIK: katalogen är läsbar, NOLL köpknappar (annars kunde en kund handla i en
 * stängd butik). SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ═════════════════════════════════ APOTEKET ═══════════════════════════════ */

export function KallaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.kaPageShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.kaPageHead}>
        <p className={styles.kaEyebrow}>
          {content.shopEyebrow ?? 'Det vi använder i behandlingarna'}
        </p>
        <h1 className={styles.kaPageTitle}>{content.shopTitle ?? 'Apoteket'}</h1>
      </div>

      {paused ? (
        <p role="status" className={styles.kaNotice}>
          Apoteket är tillfälligt stängt för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.kaEmpty}>Apoteket är litet men noga utvalt — hyllan fylls snart.</p>
      ) : (
        <ul className={styles.kaShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.kaShopCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.kaShopImg}
                aria-label={`${p.name} — visa produkten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.kaSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.kaShopBody}>
                <h3 className={styles.kaShopName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </h3>
                {p.description ? <p className={styles.kaShopDesc}>{p.description}</p> : null}
                <p className={styles.kaShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                {paused ? null : (
                  <div className={styles.kaShopBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={`${styles.kaGhost} ${styles.kaShopMore}`}>
          {content.shopCta ?? 'Till apoteket'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════ ANTECKNINGAR ═════════════════════════════ */

export function KallaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.kaPage} data-module="blogg">
      <div className={styles.kaPageHead}>
        <h1 className={styles.kaPageTitle}>{content.blogTitle ?? 'Anteckningar'}</h1>
      </div>

      {posts.length === 0 ? (
        <p className={styles.kaEmpty}>Inga anteckningar är publicerade ännu.</p>
      ) : (
        <ul className={styles.kaBloggList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.kaBloggCard}>
                  <div
                    className={styles.kaBloggImg}
                    role={p.coverImageAlt ? 'img' : undefined}
                    aria-label={p.coverImageAlt ?? undefined}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  />
                  <div className={styles.kaBloggBody}>
                    {date ? <p className={styles.kaBloggDate}>{date}</p> : null}
                    <h2 className={styles.kaBloggTitle}>{p.title}</h2>
                    {p.excerpt ? <p className={styles.kaBloggExcerpt}>{p.excerpt}</p> : null}
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={`${styles.kaTextLink} ${styles.kaShopMore}`}>
          {content.blogCta ?? 'Alla →'}
        </a>
      ) : null}
    </section>
  )
}
