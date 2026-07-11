import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './aurora.module.css'

/**
 * AURORA — mallens EGNA modul-vyer (goal-59, vektor-regeln).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * MODULEN äger funktionen: datan är redan laddad, livscykeln (paused) redan gatad,
 * köpknappen är fortfarande <AddToCart> (klientkomponenten med variantval, stepper,
 * lager och varukorg). Priset formateras ALLTID via formatShopPrice, leveranslöftet
 * via fulfilmentPromise + SHOP_FULFILMENT_LABELS. Inget av det får en mall röra.
 *
 * MALLEN äger formen: samma korall-boutique som hemmet — förskjuten (masonry-aktig)
 * grid av HÖGA rundade 3:4-kort, en rund korall-CTA-cirkel per kort som ekar hemmets
 * "Handla nu"-cirkel, priset i primaryD, leveranslöftet som ett rosa piller i
 * sektionshuvudet. Bloggen får mallens valv-bågar (999px-topp) — samma gest som
 * hemmets collage och om-fotot.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

/** Ärendets datumformat (samma mönster som BloggSection.formatPostDate). */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═══════════ BUTIK ═══════════════════════════════════════════════════════════ */

export function AuroraShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const teaser = typeof limit === 'number'
  const products = teaser ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length

  // Startsidans teaser + tom LIVE-butik → rendera inget alls (inga "visas snart"-löften).
  if (teaser && allProducts.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const fulfilmentLabel = SHOP_FULFILMENT_LABELS[config.fulfilment]

  return (
    <section
      className={`${styles.auRoot} ${styles.auSection}`}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      <div className={styles.auSecHead}>
        <p className={styles.auEyebrow}>{content.shopEyebrow ?? `— Butiken hos ${tenantName}`}</p>
        <h2 className={styles.auH2}>{content.shopTitle ?? 'Handla blommor hem'}</h2>
        {/* LEVERANSLÖFTET — rosa piller direkt under rubriken, alltid synligt. */}
        <p className={styles.auShopPromise}>
          <span className={styles.auShopPromiseTag}>{fulfilmentLabel}</span>
          <span className={styles.auShopPromiseText}>{promise}</span>
        </p>
      </div>

      {paused ? (
        <p role="status" className={styles.auShopClosed}>
          Butiken är tillfälligt stängd för nya beställningar — du kan titta runt, men
          inget går att lägga i korgen just nu. Vi öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.auEmpty}>
          Sortimentet fylls på just nu — hör gärna av dig, så binder vi något efter dina önskemål.
        </p>
      ) : (
        <ul className={styles.auShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.auShopCard}>
              <a
                className={styles.auShopCardMedia}
                href={`/shop/${p.id}`}
                aria-label={`${p.name} — visa produkt`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                {/* Rund korall-cirkel — ekar hemmets "Handla nu" ovanpå heron. */}
                <span className={styles.auShopCardCircle} aria-hidden="true">
                  Se mer
                </span>
              </a>
              <div className={styles.auShopCardBody}>
                <h3 className={styles.auCardName}>
                  <a className={styles.auShopCardLink} href={`/shop/${p.id}`}>
                    {p.name}
                  </a>
                </h3>
                {p.description ? <p className={styles.auCardMeta}>{p.description}</p> : null}
                <p className={styles.auShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                {/* KÖP-RÄLSEN — modulens egen klientkomponent, orörd. */}
                {paused ? null : (
                  <div className={styles.auShopBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.auModuleMore}>
          <a className={styles.auBandCta} href={moreHref}>
            {content.shopCta ?? 'Visa hela butiken →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═══════════ BLOGG ═══════════════════════════════════════════════════════════ */

function AuroraPostInner({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <>
      <span
        className={styles.auPostMedia}
        style={post.coverImageUrl ? { backgroundImage: `url(${post.coverImageUrl})` } : undefined}
        role={post.coverImageUrl ? 'img' : undefined}
        aria-label={post.coverImageUrl ? (post.coverImageAlt ?? post.title) : undefined}
      />
      <span className={styles.auPostBody}>
        {date ? <span className={styles.auPostDate}>{date}</span> : null}
        <span className={styles.auPostTitle}>{post.title}</span>
        {post.excerpt ? <span className={styles.auPostExcerpt}>{post.excerpt}</span> : null}
      </span>
    </>
  )
}

export function AuroraBlogg({ posts: allPosts, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts
  if (teaser && allPosts.length === 0) return null

  return (
    <section className={`${styles.auRoot} ${styles.auSection}`} data-module="blogg">
      <div className={styles.auSecHead}>
        <p className={styles.auEyebrow}>{content.blogEyebrow ?? '— Journalen'}</p>
        <h2 className={styles.auH2}>{content.blogTitle ?? `Nytt från ${tenantName}`}</h2>
      </div>

      {posts.length === 0 ? (
        <p className={styles.auEmpty}>Inga inlägg är publicerade än — vi skriver på.</p>
      ) : (
        <ul className={styles.auPostGrid}>
          {posts.map((post) =>
            post.slug ? (
              <li key={post.id} className={styles.auPostCard}>
                <a className={styles.auPostInner} href={`/blogg/${post.slug}`}>
                  <AuroraPostInner post={post} />
                </a>
              </li>
            ) : (
              // Inlägg utan slug (äldre rader) renderas OLÄNKADE — aldrig en död länk.
              <li key={post.id} className={styles.auPostCard}>
                <div className={styles.auPostInner}>
                  <AuroraPostInner post={post} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.auModuleMore}>
          <a className={styles.auBandCta} href={moreHref}>
            {content.blogCta ?? 'Läs hela bloggen →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
