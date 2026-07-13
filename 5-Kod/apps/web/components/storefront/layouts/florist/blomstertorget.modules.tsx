import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './blomstertorget.module.css'

/**
 * BLOMSTERTORGET — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   TORGPRISER (butik) — filens `showButik`: en NOTERINGSLISTA, inte ett kortrutnät.
 *   96px-miniatyr · namn (versal) + kursiv beskrivning · pris i Archivo 900 · "Lägg i korg".
 *   3px-linje över listan, 1px mellan raderna, och finstilten om bunt/utkörning under.
 *
 *   NOTISER (blogg) — filens `showBlogg`: tvåspaltig notissättning (column-count: 2),
 *   prickad linje under varje notis, etikett + datum i rött. Ingen bild — notisen ÄR text.
 *
 * PAUSAD BUTIK: katalogen är läsbar, noll köpknappar (annars kan en kund handla i ett
 * stängt stånd). SYNKRONA server-komponenter — ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ═════════════════════════════════ TORGPRISER ═════════════════════════════ */

export function BlomstertorgetShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.btShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <h1 className={styles.btPageTitle}>{content.shopTitle ?? 'Torgpriser'}</h1>
      <p className={styles.btLede}>
        Satta 06:45 i morse. Beställ här eller kom till ståndet — samma pris, ingen skillnad.
      </p>

      {paused ? (
        <p role="status" className={styles.btNotice}>
          Ståndet är stängt för beställningar just nu — priserna står kvar, korgen är låst.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.btEmpty}>Inga varor är noterade i dagens tidning.</p>
      ) : (
        <ul className={styles.btPriceList}>
          {products.map((p) => (
            <li key={p.id} className={styles.btPriceRow}>
              <a
                href={`/shop/${p.id}`}
                className={styles.btPriceImg}
                aria-label={`${p.name} — visa varan`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.btSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div>
                <p className={styles.btPriceName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </p>
                {p.description ? <p className={styles.btPriceDesc}>{p.description}</p> : null}
              </div>
              <p className={styles.btPriceTal}>{formatShopPrice(p.priceCents, p.currency)}</p>
              {paused ? <span /> : <AddToCart product={p} fulfilment={config.fulfilment} />}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={styles.btMoreLink}>
          {content.shopCta ?? 'Till torgpriserna →'}
        </a>
      ) : (
        <p className={styles.btShopNote}>
          Bunt = torgets standardmått · Utkörning inom tullarna 49 kr · Beställ före 14:00
        </p>
      )}
    </section>
  )
}

/* ═══════════════════════════════════ NOTISER ══════════════════════════════ */

export function BlomstertorgetBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.btBlogg} data-module="blogg">
      <h1 className={styles.btPageTitle}>{content.blogTitle ?? 'Notiser'}</h1>
      <p className={styles.btLede}>Smått och gott från torget, i kronologisk oordning.</p>

      {posts.length === 0 ? (
        <p className={styles.btEmpty}>Inga notiser är införda ännu.</p>
      ) : (
        <ul className={styles.btBloggList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id} className={styles.btPost}>
                <article>
                  <p className={styles.btPostTag}>
                    {content.blogEyebrow ?? 'Notis'}
                    {date ? ` · ${date}` : ''}
                  </p>
                  <h2 className={styles.btPostTitle}>{p.title}</h2>
                  {p.excerpt ? <p className={styles.btPostExcerpt}>{p.excerpt}</p> : null}
                  {p.slug ? (
                    <a href={`/blogg/${p.slug}`} className={styles.btItalicLink}>
                      {content.blogCta ?? 'läs mer →'}
                    </a>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={styles.btMoreLink}>
          {content.blogCta ?? 'läs mer →'}
        </a>
      ) : null}
    </section>
  )
}
