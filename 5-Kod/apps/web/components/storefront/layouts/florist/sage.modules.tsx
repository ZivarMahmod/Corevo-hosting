import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './sage.module.css'

/**
 * SAGE — mallens EGNA modul-vyer (goal-59, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varukorg, kassa) — den är oförändrad:
 * <AddToCart> är samma klientkomponent som den delade sektionen renderar, priserna
 * går genom formatShopPrice, leveranslöftet genom fulfilmentPromise, pausat läge
 * stänger köp-CTA:erna. Sage äger bara FORMEN.
 *
 *   BUTIKEN  galleri-grid (3 kolumner, samma .sgCardGrid-raster som hemmet), varje
 *            produkt en passepartout: tunn hårlinje-ram runt ETT 4/5-foto, spärrade
 *            versaler under, pris i accenten, och köp-rälsen i en egen fot under en
 *            hårlinje. Kortet är ALDRIG ett <a> runt allt — bild + namn länkar till
 *            /shop/{id}, så AddToCart-knappen förblir klickbar.
 *   BLOGGEN  stram lista av hårlinje-rader (datum-mikro · versal-rubrik · ingress ·
 *            litet 4/5-foto till höger) — inga kort, ingen skugga, ingen radie.
 */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function SageShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser för en tom (men live) butik → rendera inget alls: inga
  // "visas snart"-löften till besökare. Pausad butik visar alltid sin notis.
  if (typeof limit === 'number' && allProducts.length === 0 && !paused) return null

  return (
    <section
      className={styles.sgSection}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      <Reveal className={styles.sgSectionHead}>
        <p className={styles.sgEyebrow}>{content.shopEyebrow ?? '— Webshop'}</p>
        <h2 className={styles.sgSectionTitle}>{content.shopTitle ?? 'Butiken'}</h2>
        {/* LEVERANSLÖFTET — direkt under rubriken, som mallens lede. Kunden får veta
            hur blommorna når hen innan hen ser första priset. */}
        <p className={styles.sgLede}>{fulfilmentPromise(config)}</p>
        <p className={styles.sgShopPromise}>{SHOP_FULFILMENT_LABELS[config.fulfilment]}</p>
      </Reveal>

      {paused ? (
        <div className={styles.sgNotice} role="status">
          <p className={styles.sgNoticeLabel}>Stängt</p>
          <p className={styles.sgNoticeText}>
            Webshoppen är tillfälligt stängd för nya beställningar. Sortimentet visas som det
            är — vi öppnar igen snart.
          </p>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className={styles.sgEmpty}>
          <p className={styles.sgLede}>
            Sortimentet hos {tenantName} fylls på. Hör av dig så berättar vi vad som finns i
            butiken just nu.
          </p>
        </div>
      ) : (
        <ul className={styles.sgShopGrid}>
          {products.map((p, i) => (
            <li key={p.id} className={styles.sgShopItem}>
              <Reveal delay={Math.min(i, 8) * 50}>
                <div className={styles.sgShopFrame}>
                  {/* Bara bild + namn länkar — inte hela kortet (köpknappen måste förbli
                      klickbar). imageUrl kan vara null → färgplattan i --color-accent-soft
                      bär ramen, inget kraschar. */}
                  <a
                    href={`/shop/${p.id}`}
                    className={styles.sgShopLink}
                    aria-label={`${p.name} — visa produkt`}
                  >
                    <span
                      className={styles.sgShopImg}
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                      role="img"
                      aria-label={p.imageAlt ?? p.name}
                    />
                    <span className={styles.sgShopName}>{p.name}</span>
                  </a>
                  {p.description ? <p className={styles.sgShopDesc}>{p.description}</p> : null}
                  <p className={styles.sgShopPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                  {paused ? null : (
                    <div className={styles.sgShopBuy}>
                      <AddToCart product={p} fulfilment={config.fulfilment} />
                    </div>
                  )}
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
        <a href={moreHref} className={styles.sgBandCta}>
          {content.shopCta ?? 'Visa hela butiken'}
        </a>
      ) : null}
    </section>
  )
}

export function SageBlogg({ posts: allPosts, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  if (typeof limit === 'number' && allPosts.length === 0) return null

  return (
    <section className={styles.sgSection} data-module="blogg">
      <Reveal className={styles.sgSectionHead}>
        <p className={styles.sgEyebrow}>{content.blogEyebrow ?? '— Journalen'}</p>
        <h2 className={styles.sgSectionTitle}>{content.blogTitle ?? 'Från bloggen'}</h2>
        <p className={styles.sgLede}>Nyheter, tips och inspiration från {tenantName}.</p>
      </Reveal>

      {posts.length === 0 ? (
        <div className={styles.sgEmpty}>
          <p className={styles.sgLede}>Inga inlägg är publicerade än. Snart skriver vi här.</p>
        </div>
      ) : (
        <ul className={styles.sgPostList}>
          {posts.map((p, i) => (
            <li key={p.id} className={styles.sgPostRow}>
              <Reveal delay={Math.min(i, 8) * 50}>
                <SagePostLink post={p} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
        <a href={moreHref} className={styles.sgBandCta}>
          {content.blogCta ?? 'Läs hela bloggen'}
        </a>
      ) : null}
    </section>
  )
}

/** En rad i journalen. Inlägg UTAN slug renderas olänkade (legacy-rader) — formen
 *  är identisk, bara <a> byts mot <div>. */
function SagePostLink({ post }: { post: BloggPost }) {
  const date = formatPostDate(post.publishedAt)
  const inner = (
    <>
      <span className={styles.sgPostMain}>
        {date ? <span className={styles.sgPostDate}>{date}</span> : null}
        <span className={styles.sgPostTitle}>{post.title}</span>
        {post.excerpt ? <span className={styles.sgPostExcerpt}>{post.excerpt}</span> : null}
      </span>
      {post.coverImageUrl ? (
        <span
          className={styles.sgPostThumb}
          style={{ backgroundImage: `url(${post.coverImageUrl})` }}
          role="img"
          aria-label={post.coverImageAlt ?? post.title}
        />
      ) : null}
    </>
  )
  if (!post.slug) return <div className={styles.sgPostInner}>{inner}</div>
  return (
    <a href={`/blogg/${post.slug}`} className={styles.sgPostInner}>
      {inner}
    </a>
  )
}
