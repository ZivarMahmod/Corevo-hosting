import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './oliviathyme.module.css'

/**
 * OLIVIA & THYME — MODUL-VYER (goal-59, Zivars vektor-regel).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * Modulen äger FUNKTIONEN — datan, livscykeln (paused), köp-rälsen (<AddToCart>),
 * priserna (formatShopPrice) och leveranslöftet (fulfilmentPromise). Ingen rad här
 * ändrar den. Mallen äger FORMEN, och för den här mallen är formen KVARTERSBUTIKENS:
 *
 *   /shop   Butikens SKYLTFÖNSTER — TVÅ stora kort per rad i 4:5 (samma rutnät som
 *           hemmets .otShowcase), det första bär stjärn-badgen "Bäst säljare".
 *           Leveranslöftet hänger som en puderrosa notis-skylt under rubriken.
 *           Pausad butik → ingen köp-CTA renderas alls, katalogen läses som stängd
 *           bakom en tydlig stängt-notis (role="status").
 *   /blogg  Butikens POLAROID-VÄGG — samma uppklistrade kort som /om (creme ram,
 *           lätt lutning per bricka), nu med inläggens datum, titel och ingress.
 *
 * SYNKRONA server-komponenter: all I/O är redan gjord. AddToCart är klientkomponenten
 * som bär interaktionen — den importeras bara.
 */

/** Sidhuvud som modul-vyerna delar med undersidorna: butikens beige remsa. */
function OtModuleHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className={styles.otSubHead}>
      <Reveal className={styles.otCenter}>
        <p className={styles.otEyebrow}>{eyebrow}</p>
        <h1 className={styles.otSectionTitle}>{title}</h1>
      </Reveal>
    </header>
  )
}

/** Samma datumformat som modulens delade vy (sv-SE, "3 juni 2026"). */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function OliviaThymeShop({
  data,
  paused,
  limit,
  moreHref,
  content,
  tenantName,
}: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Startsidans teaser för en LIVE men TOM butik → rendera inget alls (inga
  // "visas snart"-löften till besökare). Modulens EGNA sida behåller tom-texten.
  if (teaser && allProducts.length === 0 && !paused) return null

  const eyebrow = content.shopEyebrow ?? '— Ur butiken'
  const title = teaser ? content.shopTitle ?? 'Butikens favoriter' : 'Handla hos oss'

  return (
    <section
      className={`${styles.otShop}${teaser ? ` ${styles.otShopTeaser}` : ''}`}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      {!teaser ? <OtModuleHead eyebrow={eyebrow} title={title} /> : null}

      <Reveal className={`${styles.otShopHead} ${styles.otCenter}`}>
        {teaser ? (
          <>
            <p className={styles.otEyebrow}>{eyebrow}</p>
            <h2 className={styles.otSectionTitle}>{title}</h2>
          </>
        ) : null}

        {/* LEVERANSLÖFTET — butikens hängande notis-skylt. Står direkt under rubriken,
            både i teasern och på butikens egen sida: kunden får veta HUR blommorna
            når hem innan hen ser första priset. */}
        <p className={styles.otPromise}>
          <span className={styles.otPromiseTag}>{SHOP_FULFILMENT_LABELS[config.fulfilment]}</span>
          <span className={styles.otPromiseDot} aria-hidden="true">
            ·
          </span>
          <span>{fulfilmentPromise(config)}</span>
        </p>
      </Reveal>

      {/* PAUSAD BUTIK — köp-CTA:erna renderas INTE nedan (se villkoret i kortet).
          Notisen står som butikens skylt i dörren. */}
      {paused ? (
        <div className={styles.otClosedNote} role="status">
          <span className={styles.otClosedTag}>Stängt just nu</span>
          <p className={styles.otClosedText}>
            {tenantName} tar inte emot nya beställningar för tillfället. Blommorna står kvar i
            fönstret — vi öppnar igen snart.
          </p>
        </div>
      ) : null}

      {products.length === 0 ? (
        /* Ärlig tom-text — mallen hittar ALDRIG på ett sortiment. */
        <p className={styles.otShopEmpty}>
          Sortimentet fylls på. Kom förbi disken, så berättar vi vad som är färskt just nu.
        </p>
      ) : (
        <ul className={styles.otShopGrid}>
          {products.map((p, i) => (
            <li key={p.id} className={styles.otShopCard}>
              <Reveal delay={i % 2 === 1 ? 110 : 0}>
                {/* Bild + namn länkar till produktsidan — ALDRIG hela kortet, så
                    köpknappen under förblir klickbar. */}
                <Link
                  href={`/shop/${p.id}`}
                  className={styles.otShopMedia}
                  aria-label={`${p.name} — visa produkt`}
                >
                  {i === 0 && !paused ? (
                    <span className={styles.otShopBadge}>
                      <span aria-hidden="true">★</span> Bäst säljare
                    </span>
                  ) : null}
                  {/* p.imageUrl kan vara null → färgplatta i puderrosa (--color-accent-soft),
                      aldrig en trasig <img>. */}
                  {p.imageUrl ? (
                    <div
                      className={styles.otShopImg}
                      style={{ backgroundImage: `url(${p.imageUrl})` }}
                      role="img"
                      aria-label={p.imageAlt ?? p.name}
                    />
                  ) : (
                    <div className={styles.otShopImg} />
                  )}
                </Link>
              </Reveal>

              <div className={styles.otShopInfo}>
                <Link href={`/shop/${p.id}`} className={`${styles.otCardTitle} ${styles.otShopName}`}>
                  {p.name}
                </Link>
                <span className={styles.otShopPrice}>
                  {formatShopPrice(p.priceCents, p.currency)}
                </span>
              </div>
              {p.description ? <p className={styles.otShopDesc}>{p.description}</p> : null}

              {/* KÖP-RÄLSEN — modulens egen klientkomponent. Pausad butik → ingen CTA. */}
              {paused ? null : (
                <div className={styles.otShopBuy}>
                  <AddToCart product={p} fulfilment={config.fulfilment} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.otShopMore}>
          <Link href={moreHref} className={`${styles.otMoreLink} ${styles.otFlush}`}>
            Se hela sortimentet <span aria-hidden="true">→</span>
          </Link>
        </p>
      ) : null}
    </section>
  )
}

/** Ett inlägg som polaroid. Inlägg UTAN slug renderas OLÄNKADE (legacy-rader). */
function OtPolaroidPost({ post, index }: { post: BloggPost; index: number }) {
  const date = formatPostDate(post.publishedAt)
  const inner = (
    <>
      {post.coverImageUrl ? (
        <div
          className={styles.otPostImg}
          style={{ backgroundImage: `url(${post.coverImageUrl})` }}
          role="img"
          aria-label={post.coverImageAlt ?? post.title}
        />
      ) : (
        <div className={styles.otPostImg} />
      )}
      <div className={styles.otPostBody}>
        {date ? <span className={styles.otPostDate}>{date}</span> : null}
        <h3 className={`${styles.otCardTitle} ${styles.otPostTitle}`}>{post.title}</h3>
        {post.excerpt ? <p className={styles.otPostExcerpt}>{post.excerpt}</p> : null}
      </div>
    </>
  )
  return (
    <Reveal as="li" delay={index * 80} className={styles.otPost}>
      {post.slug ? (
        <Link href={`/blogg/${post.slug}`} className={styles.otPostLink}>
          {inner}
        </Link>
      ) : (
        <div className={styles.otPostLink}>{inner}</div>
      )}
    </Reveal>
  )
}

export function OliviaThymeBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  const teaser = typeof limit === 'number'
  if (teaser && allPosts.length === 0) return null

  const eyebrow = content.blogEyebrow ?? '— Från bloggen'
  const title = teaser ? content.blogTitle ?? 'Tips, säsong & inspiration' : 'Från bloggen'

  return (
    <section
      className={`${styles.otBloggView}${teaser ? ` ${styles.otBloggTeaser}` : ''}`}
      data-module="blogg"
    >
      {!teaser ? <OtModuleHead eyebrow={eyebrow} title={title} /> : null}

      {teaser ? (
        <Reveal className={`${styles.otBloggHead} ${styles.otCenter}`}>
          <p className={styles.otEyebrow}>{eyebrow}</p>
          <h2 className={styles.otSectionTitle}>{title}</h2>
        </Reveal>
      ) : null}

      {posts.length === 0 ? (
        /* Ärlig tom-text — inga påhittade inlägg. */
        <p className={styles.otPostEmpty}>
          Här skriver vi om säsongens blommor. Första inlägget kommer snart.
        </p>
      ) : (
        <ul className={styles.otPostGrid}>
          {posts.map((p, i) => (
            <OtPolaroidPost key={p.id} post={p} index={i} />
          ))}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.otPostMore}>
          <Link href={moreHref} className={`${styles.otMoreLink} ${styles.otFlush}`}>
            {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
          </Link>
        </p>
      ) : null}
    </section>
  )
}
