import { AddToCart } from '../../shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './aurora.module.css'

/**
 * AURORA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart> och priset formateras alltid av formatShopPrice. Formen är mallens, exakt som
 * .dc.html ritar den:
 *
 *   BUTIKEN (showButik) — centrerat huvud ("Handbundet, varje morgon"), tre kolumner,
 *   4:5-bilder utan radie, namn + pris på samma baslinje, och en INRAMAD "Lägg i korgen"
 *   som fylls terracotta vid hover. Inga kort, inga skuggor.
 *
 *   BLOGGEN (showBlogg) — vita rader i en smal spalt (1000px): 260px-bild till vänster,
 *   datum i spärrad terracotta, rubrik i Lora, och "läs mer →" i kursiv. Raden lyfter med
 *   en varm skugga vid hover.
 *
 * PAUSAD BUTIK: katalogen förblir läsbar, köpknapparna försvinner. En kund ska aldrig kunna
 * handla i en stängd butik.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═════════════════════════════════ BUTIKEN ════════════════════════════════ */

export function AuroraShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.auShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.auPageHead}>
        <p className={styles.auEyebrow}>{content.shopEyebrow ?? 'Butiken'}</p>
        <h1 className={styles.auPageTitle}>{content.shopTitle ?? 'Handbundet, varje morgon'}</h1>
        <p className={styles.auPageLede}>
          Lägg det du vill ha i korgen — vi binder allt samma dag som det levereras.
        </p>
      </div>

      {paused ? (
        <p role="status" className={styles.auNotice}>
          Butiken är tillfälligt stängd för nya beställningar. Vi öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.auEmpty}>Butiken är tom just nu.</p>
      ) : (
        <ul className={styles.auShopGrid}>
          {products.map((p) => (
            <li key={p.id}>
              <a
                href={`/shop/${p.id}`}
                className={styles.auProdImg}
                aria-label={`${p.name} — visa buketten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.auSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.auProdRow}>
                <p className={styles.auProdName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </p>
                <p className={styles.auProdPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
              </div>
              {p.description ? <p className={styles.auProdDesc}>{p.description}</p> : null}
              {paused ? null : (
                <div className={styles.auBuyFramed}>
                  <AddToCart product={p} fulfilment={config.fulfilment} compact />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.auSecFoot}>
          <a href={moreHref} className={styles.auBtnOutline}>
            {content.shopCta ?? 'Hela sortimentet'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ BLOGGEN ════════════════════════════════ */

export function AuroraBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.auBlogg} data-module="blogg">
      <div className={styles.auPageHead}>
        <p className={styles.auEyebrow}>{content.blogEyebrow ?? 'Bloggen'}</p>
        <h1 className={styles.auPageTitle}>{content.blogTitle ?? 'Från studion'}</h1>
      </div>

      {posts.length === 0 ? (
        <p className={styles.auEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.auPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a
                  href={p.slug ? `/blogg/${p.slug}` : '/blogg'}
                  className={styles.auPostCardWide}
                >
                  <span
                    className={styles.auPostImg}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  />
                  <span>
                    {date ? (
                      <span className={styles.auPostDate} style={{ display: 'block' }}>
                        {date}
                      </span>
                    ) : null}
                    <span className={styles.auPostTitleWide} style={{ display: 'block' }}>
                      {p.title}
                    </span>
                    {p.excerpt ? (
                      <span className={styles.auPostExcerptWide} style={{ display: 'block' }}>
                        {p.excerpt}
                      </span>
                    ) : null}
                    <span className={styles.auPostMore}>läs mer →</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.auSecFoot}>
          <a href={moreHref} className={styles.auBtnOutline}>
            {content.blogCta ?? 'Läs fler inlägg'}
          </a>
        </p>
      ) : null}
    </section>
  )
}
