import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './mina.module.css'

/**
 * MINA — mallens EGNA modul-vyer (goal-59, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN och den är oförändrad: <AddToCart> är exakt samma
 * klientkomponent som den delade ShopSection renderar (variantval, qty-stepper,
 * korg, kassa), priserna går genom formatShopPrice, leveranslöftet genom
 * fulfilmentPromise + SHOP_FULFILMENT_LABELS, och `paused` stänger köp-CTA:erna.
 * Mina äger bara FORMEN — och formen är hemmets:
 *
 *   BUTIKEN  det TÄTA fyr-kolumners gridet med 12px gutter (mallens signatur:
 *            minsta korten i sviten), 4/5-foto utan radie, VERSALT mikro-namn
 *            (12px/600/1px spärr) och priset som CHIP — en rosa pill i accenten.
 *            Kortet är aldrig ett <a> runt allt: bild + namn länkar till
 *            /shop/{id}, köp-rälsen står fri i kortets fot.
 *   BLOGGEN  hemmets kompakta kort-grid (3 kolumner, 24px gutter, SAMMA 4/5-ratio
 *            som butiken) — datum i mikro, rubrik i Jost 28px, ingress i brödtext.
 *
 * SYNKRONA server-komponenter: all I/O är redan gjord.
 */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function MinaShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser för en LIVE men TOM butik → rendera inget alls (inga
  // "visas snart"-löften till besökare). Pausad butik visar alltid sin notis.
  if (typeof limit === 'number' && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.miModule} data-module="shop" data-fulfilment={config.fulfilment}>
      <Reveal className={styles.miModHead}>
        <div className={styles.miModHeadText}>
          <p className={styles.miEyebrow}>{content.shopEyebrow ?? '— Handla nu'}</p>
          <h2 className={styles.miSecTitle}>{content.shopTitle ?? 'Beställ något fint'}</h2>
          {/* LEVERANSLÖFTET — direkt under rubriken, som mallens lede, plus etiketten
              som en rosa pill. Kunden vet hur blommorna når hen före första priset. */}
          <p className={styles.miModLede}>{fulfilmentPromise(config)}</p>
          <span className={styles.miModTag}>{SHOP_FULFILMENT_LABELS[config.fulfilment]}</span>
        </div>
        {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
          <a href={moreHref} className={styles.miMore}>
            {content.shopCta ?? 'Visa hela sortimentet'} <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </Reveal>

      {paused ? (
        <div className={styles.miModNotice} role="status">
          <p className={styles.miModNoticeLabel}>Stängt</p>
          <p className={styles.miModNoticeText}>
            Webshoppen är tillfälligt stängd för nya beställningar. Sortimentet visas som det
            är — vi öppnar igen snart.
          </p>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className={styles.miModEmpty}>
          <p className={styles.miModEmptyText}>
            Sortimentet hos {tenantName} fylls på. Hör av dig så berättar vi vad som står i
            butiken just nu.
          </p>
        </div>
      ) : (
        <ul className={styles.miModGrid}>
          {products.map((p, i) => (
            <li key={p.id} className={styles.miModItem}>
              <Reveal delay={Math.min(i, 8) * 50}>
                {/* imageUrl kan vara null → --color-accent-soft bär plattan. */}
                <a
                  href={`/shop/${p.id}`}
                  className={styles.miModLink}
                  aria-label={`${p.name} — visa produkt`}
                >
                  <span
                    className={styles.miModImg}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    role="img"
                    aria-label={p.imageAlt ?? p.name}
                  />
                  <span className={styles.miModName}>{p.name}</span>
                </a>
                {p.description ? <p className={styles.miModDesc}>{p.description}</p> : null}
                <p className={styles.miPriceChip}>{formatShopPrice(p.priceCents, p.currency)}</p>
              </Reveal>
              {/* Pausat läge → INGEN köp-CTA (en stängd butik får inte gå att handla i). */}
              {paused ? null : (
                <div className={styles.miModBuy}>
                  <AddToCart product={p} fulfilment={config.fulfilment} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function MinaBlogg({ posts: allPosts, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  if (typeof limit === 'number' && allPosts.length === 0) return null

  return (
    <section className={styles.miModule} data-module="blogg">
      <Reveal className={styles.miModHead}>
        <div className={styles.miModHeadText}>
          <p className={styles.miEyebrow}>{content.blogEyebrow ?? '— Inspiration'}</p>
          <h2 className={styles.miSecTitle}>{content.blogTitle ?? 'Tips, säsong & idéer'}</h2>
          <p className={styles.miModLede}>Nyheter, tips och inspiration från {tenantName}.</p>
        </div>
        {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
          <a href={moreHref} className={styles.miMore}>
            {content.blogCta ?? 'Läs mer'} <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </Reveal>

      {posts.length === 0 ? (
        <div className={styles.miModEmpty}>
          <p className={styles.miModEmptyText}>
            Inga inlägg är publicerade än. Snart skriver vi här.
          </p>
        </div>
      ) : (
        <ul className={styles.miModPostGrid}>
          {posts.map((p, i) => (
            <li key={p.id} className={styles.miModPost}>
              <Reveal delay={Math.min(i, 8) * 50}>
                <MinaPostCard post={p} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Ett bloggkort. Inlägg UTAN slug renderas OLÄNKADE (legacy-rader) — formen är
 *  identisk, bara <a> byts mot <div>. */
function MinaPostCard({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  const inner = (
    <>
      <span
        className={styles.miModImg}
        style={post.coverImageUrl ? { backgroundImage: `url(${post.coverImageUrl})` } : undefined}
        role="img"
        aria-label={post.coverImageAlt ?? post.title}
      />
      {date ? <span className={styles.miModPostDate}>{date}</span> : null}
      <span className={styles.miModPostTitle}>{post.title}</span>
      {post.excerpt ? <span className={styles.miModPostExcerpt}>{post.excerpt}</span> : null}
    </>
  )
  if (!post.slug) return <div className={styles.miModLink}>{inner}</div>
  return (
    <a href={`/blogg/${post.slug}`} className={styles.miModLink}>
      {inner}
    </a>
  )
}
