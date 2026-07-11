import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './eloria.module.css'

/**
 * ELORIA — MODUL-VYERNA (goal-59, vektor-regeln).
 *
 *   "mallens vektor är apex för modulens vektor, men komponenten och modulens
 *    funktion är densamma"
 *
 * Modulen äger FUNKTIONEN (data, livscykel, varukorg, kassa) och lämnar över FORMEN
 * hit. Butiken och bloggen är därför ritade i EXAKT samma tre grepp som Elorias hem:
 * den mörkgröna guldramade plattan, guld-ledaren/guldlinjen och det höga 4:5-kortet.
 * NOLL nya hex, noll delade .sf*-klasser, samma typskala (80/44/24/16/12), samma
 * radie (0 på struktur), samma rytm (12/20/32/48/sec) och samma hover (5px/400ms).
 *
 * Vyerna är SYNKRONA server-komponenter — all I/O är redan gjord av modulens loader.
 * AddToCart är modulens egen klientkomponent och renderas oförändrad för VARJE produkt
 * så länge butiken inte är pausad; en pausad butik får inga köp-CTA:er alls.
 */

/** Format an ISO timestamp as a Swedish post date ("3 juni 2026") — samma mönster som
 *  BloggSection. null in / ogiltigt datum → null ut, så raden kan utelämnas helt. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Länkar ett inlägg till /blogg/{slug}. Inlägg UTAN slug (äldre rader) renderas
 *  OLÄNKADE — aldrig en död länk. */
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
    <a href={`/blogg/${post.slug}`} className={className}>
      {children}
    </a>
  )
}

/* ─────────────────────────────── BUTIKEN ─────────────────────────────────────────
   Kort-anatomi (uppifrån och ned, mallens ENDA bildformat 4:5):
     foto (länk → /shop/{id}, färgplatta i blush när imageUrl saknas)
     namn (Playfair 24, länk → /shop/{id})
     GULDLINJEN — 2rem hårfin guldregel UNDER namnet (mallens signatur)
     beskrivning (brödtext 16/1.6)
     pris (guld, 600) — formatShopPrice
     AddToCart (modulens egen klientkomponent) — utelämnas helt när butiken är pausad
*/
export function EloriaShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser för en LIVE men TOM butik → rendera inget alls (inga
  // "visas snart"-löften till besökare). Modulens EGNA sida behåller tom-texten.
  if (typeof limit === 'number' && allProducts.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)

  return (
    <section className={styles.elShopSection} data-module="shop" data-fulfilment={config.fulfilment}>
      <Reveal className={styles.elSecHead}>
        <p className={styles.elEyebrow}>
          {content.shopEyebrow ?? `— Webshop · ${SHOP_FULFILMENT_LABELS[config.fulfilment]}`}
        </p>
        <h2 className={styles.elH2}>{content.shopTitle ?? 'Ur butiken'}</h2>
        {/* LEVERANSLÖFTET — direkt under sektionsrubriken, som ledet under varje annan
            Eloria-rubrik. Kunden vet HUR hen får blommorna innan hen ser första priset. */}
        <p className={`${styles.elBody} ${styles.elModLede}`}>{promise}</p>
      </Reveal>

      {paused ? (
        // Stängt läge — mörkgrön guldramad platta, heroplattans lilla syskon. Inga
        // köp-CTA:er renderas nedan; katalogen läses som en stängd butiks skyltfönster.
        <div className={styles.elClosedPlate} role="status">
          <span className={styles.elEyebrowDark}>— Stängt just nu</span>
          <p className={styles.elClosedText}>
            Webshoppen är tillfälligt stängd för nya beställningar. Sortimentet visas som
            skyltfönster — vi öppnar igen snart.
          </p>
        </div>
      ) : null}

      {products.length === 0 ? (
        <Reveal className={styles.elEmpty}>
          <p className={styles.elBody}>
            {paused
              ? `Sortimentet hos ${tenantName} visas här igen så snart butiken öppnar.`
              : `Sortimentet fylls på. Hör gärna av dig så berättar vi vad ${tenantName} kan binda åt dig.`}
          </p>
        </Reveal>
      ) : (
        <ul className={styles.elModGrid}>
          {products.map((p, i) => (
            <li key={p.id} className={styles.elModCard}>
              <Reveal delay={Math.min(i, 8) * 70}>
                {/* Bild + namn länkar till produktsidan — ALDRIG hela kortet, annars
                    fångar länken AddToCart-knappen nedanför. */}
                <a
                  href={`/shop/${p.id}`}
                  className={styles.elCard}
                  aria-label={`${p.name} — visa produkt`}
                >
                  <div
                    className={styles.elCardImgTall}
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    role="img"
                    aria-label={p.imageAlt ?? p.name}
                  />
                  <h3 className={styles.elCardName}>{p.name}</h3>
                </a>
                {/* GULDLINJEN under namnet — mallens signatur. */}
                <span className={styles.elCardRuleUnder} aria-hidden="true" />
                {p.description ? <p className={styles.elCardExcerpt}>{p.description}</p> : null}
                <p className={styles.elCardPrice}>{formatShopPrice(p.priceCents, p.currency)}</p>
                {paused ? null : (
                  <div className={styles.elModBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
        <Reveal className={styles.elSecFoot}>
          <a href={moreHref} className={styles.elMoreLink}>
            {content.shopCta ?? 'Visa hela butiken'} <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      ) : null}
    </section>
  )
}

/* ─────────────────────────────── BLOGGEN ─────────────────────────────────────────
   Klassiskt UPPSLAG i guldram (samma .elSpread-grepp som /om): första inlägget stort
   — foto 4:5 | datum, rubrik, guldlinje, ingress — därefter resten som samma höga
   4:5-kort som butiken. Ett inlägg utan slug renderas olänkat.
*/
export function EloriaBlogg({ posts: allPosts, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts
  if (typeof limit === 'number' && allPosts.length === 0) return null

  const [lead, ...rest] = posts
  const leadDate = lead ? formatPostDate(lead.publishedAt) : null

  return (
    <section className={styles.elCardSectionAlt} data-module="blogg">
      <Reveal className={styles.elSecHead}>
        <p className={styles.elEyebrow}>{content.blogEyebrow ?? '— Från bloggen'}</p>
        <h2 className={styles.elH2}>{content.blogTitle ?? 'Ord om blommor'}</h2>
      </Reveal>

      {!lead ? (
        <Reveal className={styles.elEmpty}>
          <p className={styles.elBody}>
            Här skriver {tenantName} om säsong, skötsel och hantverket bakom buketterna. Första
            inlägget publiceras inom kort.
          </p>
        </Reveal>
      ) : (
        <>
          {/* UPPSLAGET — en guldram runt hela ytan, foto | sättning. */}
          <Reveal className={styles.elSpread}>
            <PostLink post={lead} className={styles.elSpreadLink}>
              <div
                className={styles.elSpreadPhoto}
                style={lead.coverImageUrl ? { backgroundImage: `url(${lead.coverImageUrl})` } : undefined}
                role="img"
                aria-label={lead.coverImageAlt ?? lead.title}
              />
            </PostLink>
            <div className={styles.elSpreadCopy}>
              {leadDate ? <p className={styles.elEyebrow}>{leadDate}</p> : null}
              <PostLink post={lead} className={styles.elSpreadTitleLink}>
                <h3 className={styles.elSpreadTitle}>{lead.title}</h3>
              </PostLink>
              <span className={styles.elCardRuleUnder} aria-hidden="true" />
              {lead.excerpt ? <p className={styles.elCardExcerpt}>{lead.excerpt}</p> : null}
            </div>
          </Reveal>

          {rest.length > 0 ? (
            <ul className={`${styles.elModGrid} ${styles.elModGridAfterSpread}`}>
              {rest.map((post, i) => {
                const date = formatPostDate(post.publishedAt)
                return (
                  <li key={post.id} className={styles.elModCard}>
                    <Reveal delay={Math.min(i, 8) * 70}>
                      <PostLink post={post} className={styles.elCard}>
                        <div
                          className={styles.elCardImgTall}
                          style={
                            post.coverImageUrl
                              ? { backgroundImage: `url(${post.coverImageUrl})` }
                              : undefined
                          }
                          role="img"
                          aria-label={post.coverImageAlt ?? post.title}
                        />
                        {date ? <p className={styles.elCardDate}>{date}</p> : null}
                        <h3 className={styles.elCardName}>{post.title}</h3>
                        <span className={styles.elCardRuleUnder} aria-hidden="true" />
                        {post.excerpt ? <p className={styles.elCardExcerpt}>{post.excerpt}</p> : null}
                      </PostLink>
                    </Reveal>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )}

      {moreHref && typeof limit === 'number' && allPosts.length > 0 ? (
        <Reveal className={styles.elSecFoot}>
          <a href={moreHref} className={styles.elMoreLink}>
            {content.blogCta ?? 'Läs hela bloggen'} <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      ) : null}
    </section>
  )
}
