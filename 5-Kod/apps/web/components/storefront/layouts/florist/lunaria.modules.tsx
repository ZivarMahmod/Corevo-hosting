import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — MODUL-VYER (goal-59, vektor-regeln).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * Modulen äger FUNKTIONEN: datan är redan laddad, livscykeln redan gatad, köp-rälsen
 * är fortfarande <AddToCart> (klientkomponenten, variant + qty + korg). Ingenting av
 * det rörs här. Det som är Lunarias är FORMEN:
 *
 *   BUTIKEN — samma OFFSET-GRID som hemmets "Ur butiken" (.lnOffsetGrid: kort 2 sänks
 *   ett helt sektionssteg, kort 3 ett halvt), samma 1:1-bildratio, samma 0-radie och
 *   1px --color-line-kant. Priset är däremot inte hemmets lilla mikrotal utan en STOR
 *   display-siffra i Italiana — samma gest som tjänstelistans .lnPriceValue. Kortet
 *   får en hårlinje mellan text och köp-räls så knappen läser som en egen zon.
 *
 *   BLOGGEN — Lunarias överlappande textplatta (samma grammatik som .lnHeroCard och
 *   /kontakt-kortet): fotot ligger i en 16:10-panorama-remsa och textplattan skjuter
 *   ut över dess nedre kant, växelvis från vänster och höger. Inlägg utan omslag blir
 *   en ren platta på vetefärgad botten — ingen tom bildruta.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

/** Samma sv-SE-datum som modulens delade vy (formatPostDate-mönstret). */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ══════════════════════════════ BUTIKEN ═══════════════════════════════════ */

export function LunariaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Startsidans teaser + tom (och inte pausad) butik → rendera ingenting alls.
  // Inga "visas snart"-löften till en besökare (S12).
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section
      className={styles.lnCardSection}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      <div className={styles.lnSecHead}>
        <p className={styles.lnEyebrow}>
          {content.shopEyebrow ?? `— Ur butiken · ${SHOP_FULFILMENT_LABELS[config.fulfilment]}`}
        </p>
        <h2 className={styles.lnSecTitle}>{content.shopTitle ?? 'Handla hos oss'}</h2>
        {/* LEVERANSLÖFTET — direkt under rubriken, i mallens ingress-roll. Kunden ska
            veta hur hen får blommorna innan hen tittar på första kortet. */}
        <p className={styles.lnModuleLede}>{fulfilmentPromise(config)}</p>
      </div>

      {paused ? (
        <p role="status" className={styles.lnClosedNotice}>
          Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.lnEmpty}>
          Sortimentet är tomt just nu — hör gärna av dig, vi binder gärna något för hand åt dig.
        </p>
      ) : (
        <ul className={styles.lnOffsetGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.lnOffsetCell}>
              <article className={styles.lnShopCard}>
                {/* Bild + namn länkar till produktsidan — INTE hela kortet, så
                    AddToCart-knappen nedanför förblir klickbar. */}
                <a
                  href={`/shop/${p.id}`}
                  className={styles.lnShopMedia}
                  aria-label={`${p.name} — visa produkt`}
                  style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                >
                  {/* p.imageUrl === null → .lnShopMedia:s vetefärgade platta står kvar. */}
                  <span className={styles.lnSrOnly}>{p.imageAlt ?? p.name}</span>
                </a>
                <div className={styles.lnShopBody}>
                  <h3 className={styles.lnCardName}>
                    <a href={`/shop/${p.id}`} className={styles.lnPlainLink}>
                      {p.name}
                    </a>
                  </h3>
                  {p.description ? <p className={styles.lnCardMeta}>{p.description}</p> : null}
                  {/* STORT PRIS — display-siffran, samma gest som tjänstelistan. */}
                  <p className={styles.lnShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  {paused ? null : (
                    <div className={styles.lnShopBuy}>
                      <AddToCart product={p} fulfilment={config.fulfilment} />
                    </div>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={styles.lnBandCta}>
          {content.shopCta ?? 'Visa hela butiken'}
        </a>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════ BLOGGEN ═══════════════════════════════════ */

/** Ett inlägg: 16:10-panorama + överlappande textplatta (växelvis sida). Inlägg
 *  UTAN slug renderas OLÄNKADE (legacy-rader) — exakt som modulens delade vy. */
function LunariaPost({ post, flip }: { post: BloggPost; flip: boolean }) {
  const date = formatPostDate(post.publishedAt)
  const body = (
    <>
      {date ? <p className={styles.lnPostDate}>{date}</p> : null}
      <h3 className={styles.lnPostTitle}>{post.title}</h3>
      {post.excerpt ? <p className={styles.lnCardMeta}>{post.excerpt}</p> : null}
      {post.slug ? <span className={styles.lnPostMore}>Läs inlägget</span> : null}
    </>
  )

  return (
    <li className={`${styles.lnPostSpread} ${flip ? styles.lnPostFlip : ''}`}>
      <div
        className={styles.lnPostPhoto}
        style={post.coverImageUrl ? { backgroundImage: `url(${post.coverImageUrl})` } : undefined}
        role={post.coverImageUrl ? 'img' : undefined}
        aria-label={post.coverImageUrl ? (post.coverImageAlt ?? post.title) : undefined}
      />
      {post.slug ? (
        <a href={`/blogg/${post.slug}`} className={styles.lnPostCard}>
          {body}
        </a>
      ) : (
        <div className={styles.lnPostCard}>{body}</div>
      )}
    </li>
  )
}

export function LunariaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  // Teaser + noll publicerade inlägg → rendera ingenting (S12).
  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.lnCardSection} data-module="blogg">
      <div className={styles.lnSecHead}>
        <p className={styles.lnEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
        <h2 className={styles.lnSecTitle}>{content.blogTitle ?? 'Tankar & säsong'}</h2>
        <p className={styles.lnModuleLede}>Nyheter, tips och inspiration från oss.</p>
      </div>

      {posts.length === 0 ? (
        <p className={styles.lnEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.lnPostList}>
          {posts.map((p, i) => (
            <LunariaPost key={p.id} post={p} flip={i % 2 === 1} />
          ))}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={styles.lnBandCta}>
          {content.blogCta ?? 'Läs hela bloggen'}
        </a>
      ) : null}
    </section>
  )
}
