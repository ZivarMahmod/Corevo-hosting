import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './viora.module.css'

/**
 * VIORA — mallens EGNA modul-vyer (goal-59, vektor-regeln).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * MODULEN äger FUNKTIONEN: datan är redan laddad, livscykeln (paused) redan gatad,
 * köpknappen är fortfarande <AddToCart> (klientkomponenten med variantval, stepper,
 * lager och varukorg). Priset formateras ALLTID via formatShopPrice, leveranslöftet
 * via fulfilmentPromise + SHOP_FULFILMENT_LABELS. Inget av det får en mall röra.
 *
 * MALLEN äger FORMEN: den violetta boutiquen fortsätter rakt in i butiken —
 * centrerat sektionshuvud (vioEyebrow + vioH2, exakt hemmets "Ur butiken"), STORA
 * 2-kolumners kort med mallens ENDA bildratio 4:5, raka hörn (--sf-radius = 0),
 * 5px-lyft på hover, och priset i kortets FOT på samma baslinje som namnet
 * (.vioShopBody-gesten från hemmet, nu med köpknappen under hårlinjen).
 *
 * Bloggen är mallens split-kort: bild (4:5) till vänster, text till höger — samma
 * split-möte som heron och /om-sidan, bara i kort-format.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

/** Samma datumformat som BloggSection.formatPostDate ("3 juni 2026"). */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═══════════════ BUTIK ═══════════════════════════════════════════════════════ */

export function VioraShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
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
      className={styles.vioShopView}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      <div className={styles.vioSecHead}>
        <p className={styles.vioEyebrow}>{content.shopEyebrow ?? '— Ur butiken'}</p>
        <h2 className={styles.vioH2}>
          {teaser ? (content.shopTitle ?? 'Handplockat till dig') : `Handla hos ${tenantName}`}
        </h2>
        {/* LEVERANSLÖFTET — direkt under rubriken, alltid synligt: violett versal-tagg
            (varianten) + löftet i klartext. Kunden vet HUR hen får blommorna. */}
        <p className={styles.vioShopPromise}>
          <span className={styles.vioShopPromiseTag}>{fulfilmentLabel}</span>
          <span className={styles.vioShopPromiseText}>{promise}</span>
        </p>
      </div>

      {paused ? (
        // STÄNGT — violett platta i hemmets closing-språk. Inga köp-CTA:er renderas.
        <p role="status" className={styles.vioShopClosed}>
          Butiken är tillfälligt stängd för nya beställningar. Du kan titta runt i
          sortimentet, men inget går att lägga i korgen just nu — vi öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={`${styles.vioEmpty} ${styles.vioBody}`}>
          Sortimentet fylls på. Hör av dig så binder vi något efter dina önskemål.
        </p>
      ) : (
        <ul className={styles.vioShopViewGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.vioShopViewCard}>
              {/* Bild + namn länkar till produktsidan — INTE hela kortet, så
                  AddToCart nedanför förblir klickbar. imageUrl null → färgplatta. */}
              <a
                href={`/shop/${p.id}`}
                aria-label={`${p.name} — visa produkt`}
                className={styles.vioShopImgLink}
              >
                <span
                  className={styles.vioShopImg}
                  style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                />
              </a>
              <div className={styles.vioShopBody}>
                <h3 className={styles.vioShopName}>
                  <a href={`/shop/${p.id}`} className={styles.vioShopNameLink}>
                    {p.name}
                  </a>
                </h3>
                {/* PRIS I KORTETS FOT — samma baslinje som namnet (hemmets gest). */}
                <span className={styles.vioShopPrice}>
                  {formatShopPrice(p.priceCents, p.currency)}
                </span>
              </div>
              {p.description ? <p className={styles.vioShopDesc}>{p.description}</p> : null}
              {/* KÖP-RÄLSEN — modulens egen klientkomponent, orörd. Pausad butik → ingen CTA. */}
              {paused ? null : (
                <div className={styles.vioShopBuy}>
                  <AddToCart product={p} fulfilment={config.fulfilment} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.vioModuleMore}>
          <a href={moreHref} className={styles.vioMoreLink}>
            {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═══════════════ BLOGG ═══════════════════════════════════════════════════════ */

function VioraPostInner({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <>
      <span
        className={styles.vioPostImg}
        style={post.coverImageUrl ? { backgroundImage: `url(${post.coverImageUrl})` } : undefined}
        role={post.coverImageUrl ? 'img' : undefined}
        aria-label={post.coverImageUrl ? (post.coverImageAlt ?? post.title) : undefined}
      />
      <span className={styles.vioPostText}>
        {date ? <span className={styles.vioPostDate}>{date}</span> : null}
        <span className={styles.vioPostTitle}>{post.title}</span>
        {post.excerpt ? <span className={styles.vioPostExcerpt}>{post.excerpt}</span> : null}
      </span>
    </>
  )
}

export function VioraBlogg({ posts: allPosts, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts
  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.vioBloggView} data-module="blogg">
      <div className={styles.vioSecHead}>
        <p className={styles.vioEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
        <h2 className={styles.vioH2}>
          {teaser
            ? (content.blogTitle ?? 'Säsong, tips & inspiration')
            : `Nytt från ${tenantName}`}
        </h2>
      </div>

      {posts.length === 0 ? (
        <p className={`${styles.vioEmpty} ${styles.vioBody}`}>
          Inga inlägg är publicerade än — vi skriver på.
        </p>
      ) : (
        <ul className={styles.vioPostList}>
          {posts.map((post) => (
            <li key={post.id} className={styles.vioPostCard}>
              {post.slug ? (
                <a href={`/blogg/${post.slug}`} className={styles.vioPostSplit}>
                  <VioraPostInner post={post} />
                </a>
              ) : (
                // Inlägg utan slug (äldre rader) renderas OLÄNKADE — aldrig en död länk.
                <div className={styles.vioPostSplit}>
                  <VioraPostInner post={post} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.vioModuleMore}>
          <a href={moreHref} className={styles.vioMoreLink}>
            {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
          </a>
        </p>
      ) : null}
    </section>
  )
}
