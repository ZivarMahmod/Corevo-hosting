import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  fulfilmentPromise,
  formatShopPrice,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './seraphina.module.css'

/**
 * SERAPHINA — mallens EGNA modul-vyer (goal-59, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varukorg, kassa) — den är oförändrad:
 * <AddToCart> är samma klient-komponent som den delade sektionen renderar, priser
 * går genom formatShopPrice, leveranslöftet genom fulfilmentPromise, pausat läge
 * stänger köp-CTA:erna. Mallen äger bara FORMEN.
 *
 * FORMEN är bröllopsmagasinets:
 *   BUTIK  höga 4/5-kort (mallens ENDA bildratio) i guldmatta (.seraMat), namn och
 *          pris på EN rad med guld-ledare emellan, köpknappen under ramen. Samma
 *          3-kolumnsrutnät, samma 5px-lyft, samma pill-knapp som hemmets teasers.
 *   BLOGG  brud-magasin-uppslag: första inlägget som ett uppslag (4/5-porträtt i
 *          guldmatta + överlappande guldramat textkort — exakt /om-sidans grepp),
 *          resten som streckade rader med liten porträtt-tumnagel.
 *
 * SYNKRONA server-komponenter: ingen async, ingen 'use client'.
 */

/** "3 juni 2026" — samma formatPostDate-mönster som BloggSection. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ─────────────────────────────  BUTIK  ───────────────────────────── */
export function SeraphinaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const teaser = typeof limit === 'number'
  const products = teaser ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser + tom (ej pausad) butik → rendera inget alls (inga
  // "visas snart"-löften till besökare). Modulens egen sida behåller tom-texten.
  if (teaser && allProducts.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const eyebrow = content.shopEyebrow ?? `— Ur kollektionen · ${SHOP_FULFILMENT_LABELS[config.fulfilment]}`
  const title = content.shopTitle ?? (teaser ? 'Färdiga favoriter' : 'Handla hos oss')

  return (
    <section
      className={`${styles.seraRoot} ${styles.seraShopView}`}
      data-module="shop"
      data-fulfilment={config.fulfilment}
    >
      {teaser ? (
        <Reveal className={styles.seraHead}>
          <p className={styles.seraEyebrow}>{eyebrow}</p>
          <h2 className={styles.seraH2}>{title}</h2>
          {/* LEVERANSLÖFTET — direkt under rubriken, aldrig gömt. */}
          <p className={styles.seraPromise}>{promise}</p>
        </Reveal>
      ) : (
        <header className={styles.seraPageHead}>
          <Reveal>
            <p className={styles.seraEyebrow}>{eyebrow}</p>
            <h1 className={styles.seraPageTitle}>{title}</h1>
            {/* LEVERANSLÖFTET — sidans lede. */}
            <p className={styles.seraPageLede}>{promise}</p>
          </Reveal>
        </header>
      )}

      <div className={styles.seraModBody}>
        {paused ? (
          <p role="status" className={styles.seraNotice}>
            Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
          </p>
        ) : null}

        {products.length === 0 ? (
          <p className={styles.seraEmpty}>
            Sortimentet fylls på. Hör av er så binder vi något efter era önskemål.
          </p>
        ) : (
          <ul className={styles.seraModGrid}>
            {products.map((p, i) => (
              <li key={p.id} className={styles.seraShopItem}>
                <Reveal delay={i * 90} className={styles.seraShopItemInner}>
                  {/* Bild + namn länkar till produktsidan — INTE hela kortet, så
                      köpknappen under ramen förblir klickbar. */}
                  <Link
                    href={`/shop/${p.id}`}
                    className={styles.seraCard}
                    aria-label={`${p.name} — visa produkt`}
                  >
                    <div className={styles.seraMat}>
                      {/* p.imageUrl kan vara null → färgplattan (accentSoft) bär rutan. */}
                      <div
                        className={styles.seraImg}
                        style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                        role="img"
                        aria-label={p.imageAlt ?? p.name}
                      />
                    </div>
                    <span className={styles.seraShopInfo}>
                      <span className={styles.seraShopName}>{p.name}</span>
                      <span className={styles.seraShopLeader} aria-hidden="true" />
                      <span className={styles.seraShopPrice}>
                        {formatShopPrice(p.priceCents, p.currency)}
                      </span>
                    </span>
                  </Link>

                  {p.description ? <p className={styles.seraShopDesc}>{p.description}</p> : null}

                  {/* Köp-rälsen: modulens egen klient-komponent, oförändrad.
                      Pausad butik → INGEN köp-CTA renderas alls. */}
                  {paused ? null : (
                    <div className={styles.seraShopBuy}>
                      <AddToCart product={p} fulfilment={config.fulfilment} />
                    </div>
                  )}
                </Reveal>
              </li>
            ))}
          </ul>
        )}

        {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
          <Reveal className={styles.seraFoot}>
            <Link href={moreHref} className={styles.seraMore}>
              {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        ) : null}
      </div>
    </section>
  )
}

/* ─────────────────────────────  BLOGG  ───────────────────────────── */

/** Inlägg UTAN slug renderas OLÄNKADE (legacy-rader) — aldrig en trasig länk. */
function PostLink({
  post,
  className,
  children,
}: {
  post: BloggPost
  className?: string
  children: React.ReactNode
}) {
  if (!post.slug) return <div className={className}>{children}</div>
  return (
    <Link href={`/blogg/${post.slug}`} className={className}>
      {children}
    </Link>
  )
}

export function SeraphinaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts
  if (teaser && allPosts.length === 0) return null

  const eyebrow = content.blogEyebrow ?? '— Journalen'
  const title = content.blogTitle ?? 'Inspiration & bröllopstips'
  const lead = posts[0]
  const rest = posts.slice(1)

  return (
    <section className={`${styles.seraRoot} ${styles.seraBloggView}`} data-module="blogg">
      {teaser ? (
        <Reveal className={styles.seraHead}>
          <p className={styles.seraEyebrow}>{eyebrow}</p>
          <h2 className={styles.seraH2}>{title}</h2>
        </Reveal>
      ) : (
        <header className={styles.seraPageHead}>
          <Reveal>
            <p className={styles.seraEyebrow}>{eyebrow}</p>
            <h1 className={styles.seraPageTitle}>{title}</h1>
            <p className={styles.seraPageLede}>
              Nyheter, tips och inspiration från oss — ur våra bröllop och vardagar.
            </p>
          </Reveal>
        </header>
      )}

      <div className={styles.seraModBody}>
        {posts.length === 0 ? (
          <p className={styles.seraEmpty}>
            Inga inlägg är publicerade ännu. Vi återkommer med tips och bilder ur våra bröllop.
          </p>
        ) : (
          <>
            {/* UPPSLAGET — porträtt i guldmatta + överlappande guldramat textkort. */}
            {lead ? (
              <PostLink post={lead} className={styles.seraLead}>
                <Reveal className={styles.seraSpreadMat}>
                  <div
                    className={styles.seraImg}
                    style={
                      lead.coverImageUrl ? { backgroundImage: `url(${lead.coverImageUrl})` } : undefined
                    }
                    role="img"
                    aria-label={lead.coverImageAlt ?? lead.title}
                  />
                </Reveal>
                <Reveal delay={120} className={styles.seraSpreadCard}>
                  {formatPostDate(lead.publishedAt) ? (
                    <p className={styles.seraDate}>{formatPostDate(lead.publishedAt)}</p>
                  ) : null}
                  <h3 className={styles.seraLeadTitle}>{lead.title}</h3>
                  {lead.excerpt ? <p className={styles.seraBody}>{lead.excerpt}</p> : null}
                </Reveal>
              </PostLink>
            ) : null}

            {rest.length > 0 ? (
              <div className={styles.seraContainer}>
                <ul className={styles.seraRows}>
                  {rest.map((p) => {
                    const date = formatPostDate(p.publishedAt)
                    return (
                      <li key={p.id}>
                        <PostLink post={p} className={styles.seraRow}>
                          <span className={styles.seraRowMain}>
                            {date ? <span className={styles.seraDate}>{date}</span> : null}
                            <span className={styles.seraBlogName}>{p.title}</span>
                            {p.excerpt ? <span className={styles.seraBlogMeta}>{p.excerpt}</span> : null}
                          </span>
                          <span className={styles.seraRowThumb}>
                            <span
                              className={styles.seraImg}
                              style={
                                p.coverImageUrl
                                  ? { backgroundImage: `url(${p.coverImageUrl})` }
                                  : undefined
                              }
                              role="img"
                              aria-label={p.coverImageAlt ?? p.title}
                            />
                          </span>
                        </PostLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}

        {moreHref && teaser && allPosts.length > 0 ? (
          <Reveal className={styles.seraFoot}>
            <Link href={moreHref} className={styles.seraMore}>
              {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        ) : null}
      </div>
    </section>
  )
}
