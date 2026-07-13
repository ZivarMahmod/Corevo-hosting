import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './eloria.module.css'

/**
 * ELORIA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   KATALOGEN (butik) — filens `showKatalog`: centrerad rubrik + lede, sedan TRE spalter
 *   med 4:5-foton, namn i garamond, en 36px guld-hårlinje under namnet, beskrivning, pris
 *   i guld, och "Lägg till beställning" som understruken mikroversal. Inga kort, inga
 *   skuggor, inga rundade hörn.
 *
 *   JOURNALEN (blogg) — filens `showJournal`: en smal spalt (820px), inlägg under varandra
 *   med 64px luft, 2:1-foto överst, kursivt datum, garamond-rubrik, "Läs vidare".
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

/** Filens datum-form är månad + år ("Juni 2026") — inte ett fullt datum. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ════════════════════════════════ KATALOGEN ═══════════════════════════════ */

export function EloriaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.elPage} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.elBandEyebrow}>{content.shopEyebrow ?? 'Katalogen'}</p>
      <h1 className={styles.elPageTitle}>{content.shopTitle ?? 'Kompositioner efter säsong'}</h1>
      <p className={styles.elPageLede}>
        Katalogen är vägledande — varje komposition binds efter dagens bästa snitt. Beställ
        genom en förfrågan, så återkommer vi inom en timme under öppettid.
      </p>

      {/* Pausad modul: katalogen är LÄSBAR, men noll köpknappar. */}
      {paused ? (
        <p role="status" className={styles.elNotice}>
          Katalogen är tillfälligt stängd för nya beställningar.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.elEmpty}>Katalogen är tom just nu.</p>
      ) : (
        <ul className={styles.elCatalog}>
          {products.map((p) => (
            <li key={p.id} className={styles.elCatalogItem}>
              <a
                href={`/shop/${p.id}`}
                className={styles.elCatalogImg}
                aria-label={`${p.name} — visa kompositionen`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.elSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <p className={styles.elCatalogName}>
                <a href={`/shop/${p.id}`}>{p.name}</a>
              </p>
              <div className={styles.elCatalogHair} />
              {p.description ? <p className={styles.elCatalogDesc}>{p.description}</p> : null}
              <p className={styles.elCatalogPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
              {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.elBandFoot}>
          <a href={moreHref} className={styles.elBtnLine}>
            {content.shopCta ?? 'Se hela katalogen'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ════════════════════════════════ JOURNALEN ═══════════════════════════════ */

export function EloriaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.elJournal} data-module="blogg">
      <p className={styles.elBandEyebrow}>{content.blogEyebrow ?? 'Journalen'}</p>
      <h1 className={styles.elPageTitle}>{content.blogTitle ?? 'Ord om blommor'}</h1>

      {posts.length === 0 ? (
        <p className={styles.elEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.elJournalPosts}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <article>
                  {p.coverImageUrl ? (
                    <div
                      className={styles.elPostImg}
                      style={{ backgroundImage: `url(${p.coverImageUrl})` }}
                      role="img"
                      aria-label={p.coverImageAlt ?? p.title}
                    />
                  ) : null}
                  {date ? <p className={styles.elPostDate}>{date}</p> : null}
                  <h2 className={styles.elPostTitle}>{p.title}</h2>
                  {p.excerpt ? <p className={styles.elPostExcerpt}>{p.excerpt}</p> : null}
                  {p.slug ? (
                    <a href={`/blogg/${p.slug}`} className={styles.elBtnUnder}>
                      Läs vidare
                    </a>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.elBandFoot}>
          <a href={moreHref} className={styles.elBtnLine}>
            {content.blogCta ?? 'Läs hela journalen'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
